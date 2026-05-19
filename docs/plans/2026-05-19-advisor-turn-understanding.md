# Advisor Turn Understanding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make EnergyOS Advisor understand complete user turns, including mixed social openings plus real help requests, without relying on one-off phrase patches.

**Architecture:** Add a turn-understanding layer before intent routing. This layer produces a structured decision from the full message: social opener, user role, pain/business context, data-literacy need, requested help, domain intent, whether to run analysis, and the response mode. The existing orchestrator then routes only true lightweight conversation to the conversational responder; guided help and analytic requests go through snapshot, metrics, specialists, and a response writer mode that speaks like a human energy advisor.

**Tech Stack:** TypeScript, Node/tsx tests, existing Gemini provider abstraction, existing Advisor orchestrator, Railway data snapshot, existing conversation memory.

---

## Root Cause

The current flow has two architectural faults:

1. `classifyAdvisorIntent()` returns only a broad intent such as `conversation`, without preserving the full meaning of the user turn.
2. `conversationResponder.getConversationAct()` promotes `como estas` to `greeting` and stops there, so a message like:

```text
Como estas ? mira yo soy el director de esta empresa y pague por este sistema.
se que tengo problemas con las finanzas energeticas pero no se leer los datos. ayudame
```

is reduced to:

```text
Bien, listo para ayudarte...
```

That is wrong because the message contains a social opener plus a business-help request, role disclosure, low data-literacy signal, and an implicit need for guided diagnosis.

The solution is not adding this sentence as a special case. The solution is changing the pipeline so social openers never erase the rest of the turn.

---

### Task 1: Add failing tests for mixed social plus help request

**Files:**
- Modify: `test_advisor_orchestrator.ts`
- Modify: `test_advisor_intent_and_specialists.ts`

**Step 1: Add orchestrator failing test**

Add a test that sends:

```ts
const noviceDirectorQuestion = 'Como estas ? mira yo soy el dirtecto de esata emprsa y page por este este sistema. se que tengo algunso rpobelmas con las finzas enegeticas pero no se leer los datos. ayudame';
```

Expected behavior:

- It must not return the generic greeting.
- It must acknowledge that the user needs help understanding energy/financial data.
- It must either run a guided starter diagnosis or explicitly offer the first guided step.
- It must not ask a vague `Decime que queres revisar`.
- It must preserve the selected company context.

Suggested assertions:

```ts
assert.notEqual(result.intent, 'greeting');
assert.doesNotMatch(result.response, /^Bien, listo para ayudarte/i);
assert.doesNotMatch(result.response, /Decime que queres revisar y voy directo al punto/i);
assert.match(result.response, /te ayudo|vamos a ordenar|empezamos/i);
assert.match(result.response, /costos|facturas|consumo|finanzas|datos/i);
```

**Step 2: Run test to verify it fails**

Run:

```bash
node --import tsx test_advisor_orchestrator.ts
```

Expected: FAIL because the current responder treats the message as a greeting.

---

### Task 2: Introduce structured turn understanding

**Files:**
- Create: `src/advisor/turnUnderstanding.ts`
- Create: `test_advisor_turn_understanding.ts`

**Step 1: Write failing tests**

Test these categories:

- Pure greeting:

```text
Hola, como estas?
```

Expected:

```ts
{
  socialOpener: true,
  primaryAct: 'social_only',
  shouldRunAnalysis: false,
  responseMode: 'social'
}
```

- Identity question:

```text
Cual es tu fuicnion?
```

Expected:

```ts
{
  primaryAct: 'identity',
  shouldRunAnalysis: false,
  responseMode: 'identity'
}
```

- Mixed social plus help request:

```text
Como estas? soy el director, pague por este sistema, tengo problemas con las finanzas energeticas y no se leer los datos. ayudame
```

Expected:

```ts
{
  socialOpener: true,
  primaryAct: 'guided_help',
  userRole: 'director',
  dataLiteracyNeed: true,
  businessPain: true,
  shouldRunAnalysis: true,
  domainIntent: 'guided_diagnosis',
  responseMode: 'guided_onboarding'
}
```

**Step 2: Run test to verify it fails**

Run:

```bash
node --import tsx test_advisor_turn_understanding.ts
```

Expected: FAIL because `turnUnderstanding.ts` does not exist.

**Step 3: Implement minimal deterministic understanding**

Create `understandAdvisorTurn(input)` with:

```ts
export type AdvisorPrimaryAct =
  | 'social_only'
  | 'identity'
  | 'thanks'
  | 'acknowledgement'
  | 'guided_help'
  | 'analytic_request'
  | 'generic_conversation';

export type AdvisorResponseMode =
  | 'social'
  | 'identity'
  | 'guided_onboarding'
  | 'analysis'
  | 'conversation';

export type AdvisorTurnUnderstanding = {
  socialOpener: boolean;
  primaryAct: AdvisorPrimaryAct;
  domainIntent: AdvisorIntent | 'guided_diagnosis' | null;
  responseMode: AdvisorResponseMode;
  shouldRunAnalysis: boolean;
  userRole: 'director' | 'manager' | 'operator' | null;
  dataLiteracyNeed: boolean;
  businessPain: boolean;
};
```

Rules must score the whole message, not stop at the first signal:

- Detect social opener, but never classify as `social_only` unless the remaining content is empty or only social.
- Detect help-seeking using broad normalized stems such as `ayud`, `no se`, `no entiendo`, `leer los datos`, `problema`, `finanz`, `energet`.
- Detect role disclosure with broad stems such as `director`, `dueno`, `gerente`, `responsable`.
- If `dataLiteracyNeed` or `businessPain` plus help-seeking is present, classify as `guided_help`.
- `guided_help` maps to `shouldRunAnalysis: true` and `domainIntent: guided_diagnosis`.

**Step 4: Run test to verify it passes**

Run:

```bash
node --import tsx test_advisor_turn_understanding.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/advisor/turnUnderstanding.ts test_advisor_turn_understanding.ts
git commit -m "feat: understand complete advisor turns"
```

---

### Task 3: Route by turn understanding, not by greeting token

**Files:**
- Modify: `src/advisor/intentRouter.ts`
- Modify: `src/advisor/orchestrator.ts`
- Modify: `test_advisor_intent_and_specialists.ts`
- Modify: `test_advisor_orchestrator.ts`

**Step 1: Add `guided_diagnosis` intent**

Extend `AdvisorIntent`:

```ts
| 'guided_diagnosis'
```

**Step 2: Make router return both intent and understanding**

Add:

```ts
export function routeAdvisorTurn(input: IntentInput): {
  intent: AdvisorIntent;
  understanding: AdvisorTurnUnderstanding;
}
```

Keep `classifyAdvisorIntent()` as a compatibility wrapper:

```ts
export function classifyAdvisorIntent(input: IntentInput): AdvisorIntent {
  return routeAdvisorTurn(input).intent;
}
```

**Step 3: Modify orchestrator**

Use `routeAdvisorTurn()` once.

Only use `conversationResponder` when:

```ts
understanding.shouldRunAnalysis === false
```

For `guided_diagnosis`, go through:

- snapshot
- metrics
- specialists
- response writer
- QA validator

**Step 4: Run tests**

```bash
node --import tsx test_advisor_turn_understanding.ts
node --import tsx test_advisor_intent_and_specialists.ts
node --import tsx test_advisor_orchestrator.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/advisor/intentRouter.ts src/advisor/orchestrator.ts test_advisor_intent_and_specialists.ts test_advisor_orchestrator.ts
git commit -m "feat: route advisor by turn understanding"
```

---

### Task 4: Add guided onboarding response mode

**Files:**
- Modify: `src/advisor/responseWriter.ts`
- Modify: `src/advisor/orchestrator.ts`
- Modify: `test_advisor_response_writer.ts`
- Modify: `test_advisor_orchestrator.ts`

**Step 1: Write failing response tests**

For `guided_diagnosis`, response must:

- Speak to a non-expert business user.
- Acknowledge the user context without sounding fake.
- Avoid dumping a full technical report.
- Explain the first step in business terms.
- Use actual snapshot metrics only if analysis is being run.
- Avoid generic “decime qué querés revisar”.

Required shape:

```text
Te ayudo. Lo vamos a leer en términos de negocio, no de tabla técnica.
Para empezar, miré el último período disponible de [empresa] y voy a ordenar el diagnóstico en: costo, consumo, facturas/contratos y riesgos.
[1-3 concise business findings if data exists]
Siguiente paso: [one concrete action/question]
```

**Step 2: Implement prompt/mode**

Add `responseMode` or `intent === 'guided_diagnosis'` handling in `responseWriter.ts`.

The system prompt for this mode must say:

- Do not over-explain.
- Do not use `Limitaciones de la informacion` as a heading.
- If data is missing, say what to complete in EnergyOS/Data Room in plain language.
- Use “te ayudo / empecemos / vamos a ordenar” style.
- Do not invent values.

**Step 3: Add deterministic fallback**

If no provider is configured, `buildDeterministicResponse()` must have a guided diagnosis branch.

**Step 4: Run tests**

```bash
node --import tsx test_advisor_response_writer.ts
node --import tsx test_advisor_orchestrator.ts
npm run build
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/advisor/responseWriter.ts src/advisor/orchestrator.ts test_advisor_response_writer.ts test_advisor_orchestrator.ts
git commit -m "feat: add guided advisor onboarding response"
```

---

### Task 5: Add conversation response QA so content is not dropped again

**Files:**
- Create: `src/advisor/conversationQa.ts`
- Create: `test_advisor_conversation_qa.ts`
- Modify: `src/advisor/conversationResponder.ts`
- Modify: `src/advisor/orchestrator.ts`

**Step 1: Write failing tests**

Cases:

- Long message with social opener and help request cannot receive a short social-only response.
- Message with `ayudame`, `no se leer datos`, or business pain cannot receive `Decime que queres revisar`.
- If provider returns a social-only answer for a guided/help message, reject it.

**Step 2: Implement validator**

Create:

```ts
export function validateConversationResponse(input: {
  question: string;
  understanding: AdvisorTurnUnderstanding;
  response: string;
}): { passed: boolean; reason?: string }
```

Rules:

- If `understanding.primaryAct === 'guided_help'`, response must acknowledge help/problem/data understanding.
- If question has more than one sentence and non-social content, response must not be pure greeting.
- Reject canned phrases that ask vague follow-up when user already gave the reason.

**Step 3: Apply it**

Use it after provider conversation output and before returning lightweight responses.

**Step 4: Run tests**

```bash
node --import tsx test_advisor_conversation_qa.ts
node --import tsx test_advisor_conversation_responder.ts
node --import tsx test_advisor_orchestrator.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/advisor/conversationQa.ts src/advisor/conversationResponder.ts src/advisor/orchestrator.ts test_advisor_conversation_qa.ts
git commit -m "feat: validate advisor conversation replies"
```

---

### Task 6: Store useful user context as memory

**Files:**
- Modify: `src/advisor/memoryExtractor.ts`
- Modify: `test_advisor_memory_extractor.ts`

**Step 1: Add failing tests**

For the director message, memory extractor should create candidates:

- `preference`: wants plain-language explanation.
- `profile`: user role is director or decision maker.
- `open_issue`: user reports energy-finance problems and difficulty reading data.

**Step 2: Implement extraction**

Use broad semantic signals:

- role disclosure
- data-literacy need
- business pain

Scope:

- `user` for preference/profile.
- `conversation` or `nemo` for the open issue, depending on available company context.

**Step 3: Run tests**

```bash
node --import tsx test_advisor_memory_extractor.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/advisor/memoryExtractor.ts test_advisor_memory_extractor.ts
git commit -m "feat: remember advisor user context"
```

---

### Task 7: Full verification and deploy

**Files:**
- No new files unless tests expose issues.

**Step 1: Run focused tests**

```bash
node --import tsx test_advisor_turn_understanding.ts
node --import tsx test_advisor_conversation_qa.ts
node --import tsx test_advisor_conversation_responder.ts
node --import tsx test_advisor_intent_and_specialists.ts
node --import tsx test_advisor_response_writer.ts
node --import tsx test_advisor_orchestrator.ts
node --import tsx test_advisor_memory_extractor.ts
```

**Step 2: Run Advisor suite**

Run the existing Advisor test set with local environment variables loaded.

**Step 3: Build**

```bash
npm run build
```

**Step 4: Manual reproduction**

Run the exact failing message through `runAdvisorChat()` and confirm:

- Not greeting.
- Not vague.
- Acknowledges help/data-literacy/business problem.
- Uses company context.
- Uses analysis only through the guided diagnosis path.

**Step 5: Push**

```bash
git push origin codex/advisor-conversation-memory
git push origin HEAD:main
```

**Step 6: Railway smoke**

```bash
curl.exe -i https://energyos-ia-production.up.railway.app/health
```

Expected: `200 OK`.

---

## Product Rule To Preserve

The Advisor must behave like one product with multiple internal capabilities:

- A pure greeting gets a human greeting.
- A question about identity gets identity/function.
- A user asking for help because they cannot read energy data gets guided onboarding.
- A concrete analysis request gets analysis.
- A document upload gets document intake.
- A report/action request gets the right specialist.

Social wording at the start of a message is never allowed to erase the actual request that follows.
