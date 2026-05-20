# EnergyOS Advisor Product Correction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corregir EnergyOS Advisor para que funcione como un asistente conversacional experto, contextual, seguro por usuario/NEMO y conectado al sistema principal sin respuestas plantilla ni flujos duplicados.

**Architecture:** El producto debe tener un solo camino conversacional real: frontend `Analizador` -> backend `/advisor/chat` -> autorizacion -> conversacion/memoria backend -> director de turno -> analisis o respuesta conversacional -> QA -> respuesta con metadata segura. `/agent/ask` queda como compatibilidad legacy y no debe tener reglas propias que contradigan al Advisor. Gemini debe ser proveedor real con timeout, trazabilidad y fallback observable, no una caja negra.

**Tech Stack:** TypeScript, Hono, Zod, Gemini REST API, Railway Postgres, Supabase Auth/JWT, React/Vite, local tests with `tsx`/`tsc`.

---

## Non-Negotiable Product Rules

1. El usuario nunca elige cliente dentro del chat. El cliente/NEMO vienen del contexto autorizado de EnergyOS.
2. Un saludo, pregunta humana o pedido de confianza no dispara analisis energetico.
3. Una pregunta analitica si debe usar los datos reales de EnergyOS, Data Room si aplica, especialistas, metricas y QA.
4. Cada usuario tiene sus conversaciones aisladas por `user_id + company_id + nemo + conversation_id`.
5. La memoria mejora la experiencia, pero no se muestra como cartel de producto.
6. Si Gemini falla, el sistema puede degradar, pero debe registrar y devolver metadata segura para saber que paso.
7. No se guardan secretos ni tokens en logs, DB ni responses.
8. El frontend no debe simular memoria con `localStorage` como fuente principal.

---

## Task 1: Add Safe Runtime Metadata To Advisor Output

**Files:**
- Modify: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/src/schemas/advisor.schema.ts`
- Modify: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/src/advisor/orchestrator.ts`
- Modify: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/src/advisor/conversationResponder.ts`
- Test: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/test_advisor_orchestrator.ts`
- Test: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/test_advisor_conversation_responder.ts`

**Step 1: Write failing schema test**

Add assertions that every Advisor output can include:

```ts
runtime: {
  responseSource: 'llm' | 'deterministic_fallback';
  provider: 'gemini' | 'openai' | 'anthropic' | 'energyos' | null;
  model: string | null;
  fallbackReason: string | null;
  routerSource: 'llm' | 'deterministic';
}
```

Expected initial result: FAIL because `AdvisorRunOutputSchema` does not allow `runtime`.

**Step 2: Implement schema**

Add:

```ts
export const AdvisorRuntimeSchema = z.object({
  responseSource: z.enum(['llm', 'deterministic_fallback']),
  provider: z.enum(['gemini', 'openai', 'anthropic', 'energyos']).nullable(),
  model: z.string().nullable(),
  fallbackReason: z.string().nullable(),
  routerSource: z.enum(['llm', 'deterministic']),
});
```

Then add `runtime: AdvisorRuntimeSchema` to `AdvisorRunOutputSchema`.

**Step 3: Populate runtime for lightweight turns**

Change conversation responder return type from `string` to an object:

```ts
type AdvisorConversationResponse = {
  text: string;
  runtime: AdvisorRuntime;
};
```

Do not hide fallback reasons. Use safe values only:
- `provider_unavailable`
- `provider_error`
- `analytic_output_rejected`
- `qa_rejected:<reason>`
- `empty_llm_response`

**Step 4: Populate runtime for analytic turns**

When `createAdvisorLlmResponseWriterFromEnv()` is used, set:
- `responseSource: 'llm'`
- `provider/model` from provider

When deterministic writer is used, set:
- `responseSource: 'deterministic_fallback'`
- `provider: 'energyos'`
- `model: null`
- `fallbackReason: 'writer_unavailable'`

**Step 5: Run tests**

Run:

```bash
node --import tsx test_advisor_conversation_responder.ts
node --import tsx test_advisor_orchestrator.ts
npm run build
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/schemas/advisor.schema.ts src/advisor/orchestrator.ts src/advisor/conversationResponder.ts test_advisor_conversation_responder.ts test_advisor_orchestrator.ts
git commit -m "chore: add advisor runtime metadata"
```

---

## Task 2: Pass Conversation Context Into Lightweight Conversation

**Files:**
- Modify: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/src/advisor/orchestrator.ts:216`
- Modify: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/src/advisor/conversationResponder.ts:6`
- Test: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/test_advisor_orchestrator.ts`
- Test: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/test_advisor_conversation_responder.ts`

**Step 1: Write failing test**

In `test_advisor_orchestrator.ts`, create a lightweight user turn with `conversationContext` containing previous messages:

```ts
const context = {
  conversationId,
  summary: 'El usuario pregunto si realmente lo vamos a ayudar.',
  recentMessages: [
    userMessage('Si me vas a ayudar?'),
    assistantMessage('Si, estoy aca para ayudarte.'),
  ],
  memory: [{
    id: memoryId,
    scope: 'user',
    type: 'task_context',
    content: 'El usuario necesita una respuesta humana antes de analizar datos.',
    confidence: 'high',
  }],
};
```

Use a fake `conversationResponder` that asserts `input.conversationContext` exists.

Expected initial result: FAIL because the orchestrator does not pass context.

**Step 2: Extend responder input**

Add `conversationContext?: ConversationContext` to `AdvisorConversationResponderInput`.

**Step 3: Pass context**

Change:

```ts
const response = await conversationResponder({ input, intent, understanding });
```

to:

```ts
const response = await conversationResponder({
  input,
  intent,
  understanding,
  conversationContext: options.conversationContext,
});
```

**Step 4: Include context in LLM conversation prompt**

In `conversationResponder.ts`, send compact context to Gemini:

```ts
conversationContext: input.conversationContext ? {
  summary: input.conversationContext.summary,
  recentMessages: input.conversationContext.recentMessages.slice(-8).map(m => ({
    role: m.role,
    content: m.content,
    intent: m.intent,
  })),
  memory: input.conversationContext.memory,
} : null
```

Do not include tokens, secrets, raw auth headers or hidden system details.

**Step 5: Run tests**

Run:

```bash
node --import tsx test_advisor_orchestrator.ts
node --import tsx test_advisor_conversation_responder.ts
npm run build
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/advisor/orchestrator.ts src/advisor/conversationResponder.ts test_advisor_orchestrator.ts test_advisor_conversation_responder.ts
git commit -m "fix: pass conversation context to advisor responder"
```

---

## Task 3: Replace Regex-First Routing With LLM Turn Director

**Files:**
- Create: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/src/advisor/turnDirector.ts`
- Modify: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/src/advisor/orchestrator.ts`
- Modify: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/src/advisor/turnUnderstanding.ts`
- Test: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/test_advisor_turn_director.ts`
- Test: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/test_advisor_orchestrator.ts`

**Step 1: Write failing tests**

Add cases where no hardcoded phrase should be needed:

```ts
assert.equal(result.shouldRunAnalysis, false); // "Necesito saber si estas conmigo antes de mirar numeros"
assert.equal(result.primaryAct, 'reassurance');

assert.equal(result.shouldRunAnalysis, false); // "Cual es tu funcion en este sistema?"
assert.equal(result.primaryAct, 'identity');

assert.equal(result.shouldRunAnalysis, true); // "Ayudame a entender por que mi costo energetico viene mal"
assert.equal(result.responseMode, 'guided_onboarding');
```

Expected initial result: FAIL because there is no LLM director.

**Step 2: Define structured output**

In `turnDirector.ts`, define a Zod schema:

```ts
const TurnDirectorOutputSchema = z.object({
  primaryAct: z.enum([
    'social_only',
    'identity',
    'reassurance',
    'thanks',
    'acknowledgement',
    'guided_help',
    'analytic_request',
    'generic_conversation',
  ]),
  domainIntent: z.enum([
    'monthly_summary',
    'invoice',
    'contract',
    'compliance',
    'document_intake',
    'action_plan',
    'report',
    'general_question',
  ]).nullable(),
  shouldRunAnalysis: z.boolean(),
  responseMode: z.enum(['brief_conversation', 'guided_onboarding', 'technical_analysis']),
  confidence: z.enum(['low', 'medium', 'high']),
  reason: z.string().max(300),
});
```

**Step 3: Build director prompt**

The system prompt must say:

```text
Sos el director de turnos de EnergyOS Advisor.
Decidis si el turno requiere analisis de datos o solo respuesta conversacional.
No ejecutes analisis.
No clasifiques saludos, dudas humanas, identidad o pedidos de confianza como analisis.
Solo marca shouldRunAnalysis=true cuando el usuario pide entender, calcular, revisar, resumir, comparar, auditar o decidir sobre datos energeticos.
Devolve exclusivamente JSON valido.
```

**Step 4: Implement provider path with deterministic fallback**

`resolveAdvisorTurn()` should:
1. Use LLM director if provider exists.
2. Parse JSON strictly.
3. If parse fails or provider fails, use existing deterministic `routeAdvisorTurn`.
4. Return `routerSource: 'llm' | 'deterministic'`.

**Step 5: Wire orchestrator**

Before running analysis, call `resolveAdvisorTurn` instead of raw `routeAdvisorTurn`.

**Step 6: Run tests**

Run:

```bash
node --import tsx test_advisor_turn_director.ts
node --import tsx test_advisor_turn_understanding.ts
node --import tsx test_advisor_orchestrator.ts
npm run build
```

Expected: PASS.

**Step 7: Commit**

```bash
git add src/advisor/turnDirector.ts src/advisor/orchestrator.ts src/advisor/turnUnderstanding.ts test_advisor_turn_director.ts test_advisor_orchestrator.ts
git commit -m "feat: add llm advisor turn director"
```

---

## Task 4: Make Conversation Responder LLM-First And QA Non-Brittle

**Files:**
- Modify: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/src/advisor/conversationResponder.ts`
- Modify: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/src/advisor/conversationQa.ts`
- Test: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/test_advisor_conversation_responder.ts`
- Test: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/test_advisor_conversation_qa.ts`

**Step 1: Write failing tests for natural answers**

Good answers must pass even if they do not repeat exact template phrases:

```ts
response: 'Claro. Estoy con vos para ordenar esto paso a paso, sin tirarte tablas encima.'
```

Expected initial result: FAIL if QA demands exact wording.

**Step 2: Change QA philosophy**

QA should reject only dangerous or clearly wrong behavior:
- It runs energy analysis when not asked.
- It asks the user to choose client/NEMO.
- It ignores a direct identity/reassurance question.
- It exposes internals/secrets.
- It is empty or nonsensical.

QA should not require exact phrase "Soy EnergyOS Advisor" for every identity answer.

**Step 3: Improve system prompt**

Conversation responder prompt must include:

```text
Responde al mensaje actual y al historial breve.
Si el usuario pide confianza, responde confianza.
Si pregunta que sos, explica tu funcion.
Si necesita ayuda para entender datos pero aun no pidio analisis, propones un primer paso sin ejecutar metricas.
No devuelvas checklist generico si el usuario hizo una pregunta humana directa.
Maximo 3 oraciones, salvo que el usuario pida detalle.
```

**Step 4: Keep deterministic fallback but make it product-quality**

Fallback should be short, human and specific to act:
- Identity: explain role.
- Reassurance: confirm help and next step.
- Greeting: natural greeting only.
- Guided help: ask permission to empezar con diagnostico guiado, without dumping metrics.

No fallback should include "Decime que queres revisar" if the user already asked something concrete.

**Step 5: Run tests**

Run:

```bash
node --import tsx test_advisor_conversation_qa.ts
node --import tsx test_advisor_conversation_responder.ts
npm run build
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/advisor/conversationResponder.ts src/advisor/conversationQa.ts test_advisor_conversation_responder.ts test_advisor_conversation_qa.ts
git commit -m "fix: make advisor conversation responses natural"
```

---

## Task 5: Harden Gemini Provider

**Files:**
- Modify: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/src/providers/gemini.ts`
- Modify: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/src/config/env.ts`
- Test: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/test_gemini_provider.ts`

**Step 1: Write failing tests**

Test:
- timeout aborts request
- non-2xx error includes safe message
- empty response throws safe error
- response text still parses normally

Expected initial result: FAIL for timeout.

**Step 2: Add env vars**

Add:

```ts
GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
GEMINI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(4096),
```

**Step 3: Add AbortController**

Wrap `fetch`:

```ts
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
try {
  const response = await fetch(url, { ...request, signal: controller.signal });
} finally {
  clearTimeout(timeout);
}
```

**Step 4: Do not log API keys**

All errors must include status/model/provider but never key or request body with secrets.

**Step 5: Run tests**

Run:

```bash
node --import tsx test_gemini_provider.ts
npm run build
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/providers/gemini.ts src/config/env.ts test_gemini_provider.ts
git commit -m "fix: harden gemini provider timeouts"
```

---

## Task 6: Make `/agent/ask` A Legacy Wrapper, Not A Separate Brain

**Files:**
- Modify: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/src/api/ask.ts`
- Modify: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/src/utils/chatIntent.ts`
- Test: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/test_chat_intent.ts`
- Test: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/test_agent.ts`

**Step 1: Write failing test**

`POST /agent/ask` with "Hola, como estas?" must not use `buildGreetingResponse`. It should call the same Advisor orchestrator.

Expected initial result: FAIL because `ask.ts` has a direct greeting bypass.

**Step 2: Remove direct greeting bypass**

Delete:

```ts
if (isSimpleGreeting(question)) {
  return c.json({ response: buildGreetingResponse(...) });
}
```

**Step 3: Keep response shape for legacy frontend**

Return:

```ts
{
  response: result.response,
  model: result.runtime.model ?? 'advisor-v2',
  provider: result.runtime.provider ?? 'energyos',
  advisor: result,
}
```

**Step 4: Deprecate `chatIntent.ts`**

Keep exports only if old tests need them, but mark as legacy. Do not use it in new Advisor flow.

**Step 5: Run tests**

Run:

```bash
node --import tsx test_chat_intent.ts
node --import tsx test_agent.ts
npm run build
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/api/ask.ts src/utils/chatIntent.ts test_chat_intent.ts test_agent.ts
git commit -m "fix: route legacy ask through advisor"
```

---

## Task 7: Add Frontend Advisor Chat Client

**Files:**
- Modify: `E:/Proyectos/GitHub/EnergyOS/src/services/energyosAgent.ts`
- Modify: `E:/Proyectos/GitHub/EnergyOS/src/types/energyosAgent.ts`
- Test: `E:/Proyectos/GitHub/EnergyOS/src/services/energyosAgent.test.ts`

**Step 1: Write failing service tests**

Add tests for:
- `chatWithAdvisor()` calls `/advisor/chat`
- Authorization header is preserved
- payload includes `conversationId` when available
- files are included
- response includes `conversationId`, `assistantMessageId`, `runtime`

Expected initial result: FAIL because service has no `/advisor/chat` client.

**Step 2: Extend endpoint type**

Add:

```ts
| "/advisor/chat"
| "/advisor/conversations"
```

If `requestAgent` only supports POST, create `requestAgentGet<T>()` for conversation list/messages.

**Step 3: Add types**

Add:

```ts
export type AgentAdvisorRuntime = {
  responseSource: "llm" | "deterministic_fallback";
  provider: "gemini" | "openai" | "anthropic" | "energyos" | null;
  model: string | null;
  fallbackReason: string | null;
  routerSource: "llm" | "deterministic";
};
```

Add `conversationId`, `messageId`, `assistantMessageId`, `runtime` to `AgentAdvisorRunOutput`.

**Step 4: Add functions**

```ts
export function chatWithAdvisor(input: AgentAdvisorChatRequest): Promise<AgentAdvisorRunOutput> {
  return requestAgent<AgentAdvisorRunOutput>("/advisor/chat", withPrivateContext(input));
}
```

Also add:
- `listAdvisorConversations({ nemo })`
- `loadAdvisorConversationMessages({ conversationId, companyId, nemo })`
- optional `createAdvisorConversation({ companyId, companyName, nemo, title })`

**Step 5: Run tests**

Run:

```bash
node --experimental-strip-types src/services/energyosAgent.test.ts
npm run build
```

Expected: PASS.

**Step 6: Commit in EnergyOS repo**

```bash
cd E:/Proyectos/GitHub/EnergyOS
git add src/services/energyosAgent.ts src/types/energyosAgent.ts src/services/energyosAgent.test.ts
git commit -m "feat: add advisor chat api client"
```

---

## Task 8: Replace LocalStorage Chat With Backend Conversations In Analizador

**Files:**
- Modify: `E:/Proyectos/GitHub/EnergyOS/src/pages/app/Analizador.tsx`
- Modify: `E:/Proyectos/GitHub/EnergyOS/src/types/energyosAgent.ts`
- Test manually with browser after build.

**Step 1: Remove local fake conversation model as source of truth**

Stop using:
- `STORAGE_PREFIX`
- `loadConversations`
- `saveConversations`
- local `newId("thread")` as backend conversation id

Local optimistic messages are allowed only while request is pending.

**Step 2: Load backend conversations**

On selected `agente.nemo`, call:

```ts
listAdvisorConversations({ nemo })
```

If empty, show an empty chat state with no fake memory/status banner.

**Step 3: Start conversation through backend or first message**

Two acceptable paths:
1. Create conversation explicitly with `POST /advisor/conversations`.
2. Let `/advisor/chat` create it on first message and return `conversationId`.

Recommended: path 2 for fewer UI states.

**Step 4: Send all free-text chat through `/advisor/chat`**

Replace:

```ts
askEnergyAgent({ ...agentRequest!, question, files })
```

with:

```ts
chatWithAdvisor({
  ...agentRequest!,
  question,
  files,
  conversationId: activeConversation?.id,
})
```

After response, update active conversation id from `response.conversationId`.

**Step 5: Keep action buttons explicit**

Buttons may either:
- keep legacy endpoints for reports/action plans, or
- send natural prompts to `/advisor/chat`.

Recommended now:
- Free chat: `/advisor/chat`
- Report/action/conciliate buttons: keep specialized endpoints until they are migrated.

But the displayed assistant message must be normalized into the same conversation thread.

**Step 6: Remove user-facing memory/debug labels**

Do not render:
- "Memoria disponible..."
- provider/model/fallback reason in normal UI
- raw metadata by default

Keep developer/debug details only behind a non-prominent `Ver datos` section for internal testing, or hide behind environment flag.

**Step 7: Run build**

Run:

```bash
cd E:/Proyectos/GitHub/EnergyOS
npm run build
```

Expected: PASS.

**Step 8: Manual verification**

In browser:
1. Open EnergyOS Advisor.
2. Send: `Holaaaa. como estas??????`
   Expected: social response, no metrics.
3. Send: `Que sos?`
   Expected: explains function.
4. Send: `Cual es tu funcion?`
   Expected: answers function, not repeated greeting.
5. Send: `Necesito saber si realmente me vas a ayudar`
   Expected: reassurance.
6. Send: `soy director y no se leer los datos, ayudame`
   Expected: guided onboarding, no full report unless user asks.
7. Send: `Dame un resumen del ultimo mes`
   Expected: analysis with metrics and no fake missing-data contradiction.

**Step 9: Commit in EnergyOS repo**

```bash
cd E:/Proyectos/GitHub/EnergyOS
git add src/pages/app/Analizador.tsx src/types/energyosAgent.ts
git commit -m "feat: connect advisor screen to backend conversations"
```

---

## Task 9: Add Protected Diagnostics For Production Debugging

**Files:**
- Modify: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/src/api/advisor-chat.ts`
- Modify: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/src/advisor/runStore.ts`
- Test: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/test_advisor_chat_persistence.ts`

**Step 1: Store runtime in assistant message metadata**

Already metadata stores `result`. Verify it includes `runtime`.

**Step 2: Add server logs without secrets**

For each chat request log:

```ts
console.info('advisor_chat_completed', {
  conversationId,
  runId,
  nemo,
  intent: result.intent,
  responseSource: result.runtime.responseSource,
  provider: result.runtime.provider,
  model: result.runtime.model,
  fallbackReason: result.runtime.fallbackReason,
  qaPassed: result.qa.passed,
});
```

No token. No API key. No full message content.

**Step 3: Test metadata persistence**

Assert assistant message metadata contains runtime.

**Step 4: Run tests**

Run:

```bash
node --import tsx test_advisor_chat_persistence.ts
npm run build
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/api/advisor-chat.ts src/advisor/runStore.ts test_advisor_chat_persistence.ts
git commit -m "chore: log advisor runtime diagnostics"
```

---

## Task 10: End-To-End Production Smoke Checklist

**Files:**
- Modify: `C:/Users/quime/.config/superpowers/worktrees/Energyos-IA/advisor-conversation-memory/docs/plans/2026-05-20-advisor-product-correction.md` only if results must be recorded.

**Step 1: Verify backend health after deploy**

Run:

```bash
curl https://<railway-energyos-ia-url>/health
```

Expected:

```json
{
  "status": "ok",
  "ai": {
    "configured": true,
    "provider": "gemini",
    "model": "gemini-2.5-flash",
    "advisorLlmWriterEnabled": true
  }
}
```

**Step 2: Verify frontend env**

Confirm `VITE_ENERGYOS_AGENT_URL` points to the Railway public URL for EnergyOS-IA.

**Step 3: Authenticated manual flow**

From EnergyOS UI with a real logged-in user:
- open Advisor
- send social messages
- send identity/function messages
- send guided-help message
- send monthly summary request
- reload page
- confirm messages persist
- start another conversation
- confirm old conversation does not contaminate new one

**Step 4: Cross-user/NEMO isolation**

Use two users or two authorized NEMOs:
- User A/NEMO A should never see User B/NEMO B conversation or memory.
- Unauthorized NEMO should return 403.

**Step 5: Production acceptance**

Accept only if:
- free chat goes to `/advisor/chat`
- no greeting triggers unsolicited metrics
- `Que sos?` and `Cual es tu funcion?` answer the question
- analysis uses real EnergyOS metrics
- fallback is visible in metadata/logs
- no secret appears in response/logs

---

## Execution Order

1. Backend runtime metadata.
2. Backend conversation context into lightweight response.
3. LLM turn director.
4. Natural conversation responder and QA cleanup.
5. Gemini timeout/hardening.
6. Legacy `/agent/ask` cleanup.
7. Frontend API client.
8. Frontend `Analizador` backend conversations.
9. Diagnostics/logging.
10. Production smoke.

Do not start with UI polish. The correction only works if the frontend stops using the wrong endpoint and the backend stops hiding fallbacks.

