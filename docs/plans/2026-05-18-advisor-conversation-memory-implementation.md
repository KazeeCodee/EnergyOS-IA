# EnergyOS Advisor Conversation And Memory Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add production-grade persistent conversations and structured memory to EnergyOS Advisor without mixing data across users, NEMOs, companies, or chat threads.

**Architecture:** Railway Postgres stores Advisor conversations, messages, summaries, and memory items. Supabase Auth remains the identity provider. Every API request validates JWT, NEMO authorization, and conversation ownership before loading only the current conversation context into the Advisor orchestrator.

**Tech Stack:** TypeScript, Hono, Node 22, postgres.js, Railway Postgres, Supabase Auth/JWT, Zod, React/Vite, root-level tsx test scripts.

---

### Task 1: Add Railway conversation and memory migration

**Files:**
- Create: `src/db/migrations/002_advisor_conversation_memory.sql`
- Modify: `scripts/apply-migration.ts`
- Test: `test_advisor_migration_sql.ts`

**Step 1: Write the failing test**

Create `test_advisor_migration_sql.ts` that reads `002_advisor_conversation_memory.sql` and asserts it contains:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('src/db/migrations/002_advisor_conversation_memory.sql', 'utf8');

for (const table of [
  'advisor_conversations',
  'advisor_messages',
  'advisor_memory_items',
]) {
  assert.match(sql, new RegExp(`create table if not exists public.${table}`, 'i'));
}

assert.match(sql, /conversation_id uuid not null/i);
assert.match(sql, /user_id uuid not null/i);
assert.match(sql, /nemo text not null/i);
assert.match(sql, /status text not null/i);

console.log('advisor migration sql tests passed');
```

Run:

```bash
node --import tsx test_advisor_migration_sql.ts
```

Expected: FAIL because the migration does not exist.

**Step 2: Create the migration**

Create `src/db/migrations/002_advisor_conversation_memory.sql`:

```sql
create table if not exists public.advisor_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  company_id uuid not null,
  nemo text not null check (nemo ~ '^[A-Z0-9]{8}$'),
  title text not null default 'Nueva conversacion',
  status text not null default 'active'
    check (status in ('active', 'archived', 'deleted')),
  summary text null,
  summary_updated_at timestamptz null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists advisor_conversations_user_nemo_last_idx
  on public.advisor_conversations(user_id, nemo, last_message_at desc);

create index if not exists advisor_conversations_user_id_idx
  on public.advisor_conversations(user_id, id);

create table if not exists public.advisor_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.advisor_conversations(id) on delete cascade,
  user_id uuid not null,
  company_id uuid not null,
  nemo text not null check (nemo ~ '^[A-Z0-9]{8}$'),
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  intent text null,
  metadata jsonb not null default '{}'::jsonb,
  run_id uuid null,
  created_at timestamptz not null default now()
);

create index if not exists advisor_messages_conversation_created_idx
  on public.advisor_messages(conversation_id, created_at);

create table if not exists public.advisor_memory_items (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('user', 'nemo', 'conversation')),
  user_id uuid not null,
  company_id uuid null,
  nemo text null check (nemo is null or nemo ~ '^[A-Z0-9]{8}$'),
  conversation_id uuid null references public.advisor_conversations(id) on delete set null,
  type text not null check (type in ('preference', 'confirmed_fact', 'decision', 'open_issue', 'task_context')),
  content text not null,
  confidence text not null default 'medium' check (confidence in ('low', 'medium', 'high')),
  source_message_id uuid null references public.advisor_messages(id) on delete set null,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'archived', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists advisor_memory_user_nemo_status_idx
  on public.advisor_memory_items(user_id, nemo, status, updated_at desc);
```

**Step 3: Fix migration runner**

Modify `scripts/apply-migration.ts` so it:

- uses `RAILWAY_DATABASE_URL`;
- accepts a migration filename argument;
- does not contain hardcoded database credentials;
- defaults to `src/db/migrations/002_advisor_conversation_memory.sql`.

Run:

```bash
node --import tsx test_advisor_migration_sql.ts
npm run build
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/db/migrations/002_advisor_conversation_memory.sql scripts/apply-migration.ts test_advisor_migration_sql.ts
git commit -m "feat: add advisor conversation memory schema"
```

### Task 2: Add conversation schemas

**Files:**
- Modify: `src/schemas/advisor.schema.ts`
- Test: `test_advisor_conversation_schema.ts`

**Step 1: Write the failing test**

Create tests for:

- `AdvisorConversationCreateInput`
- `AdvisorConversationListQuery`
- `AdvisorMessageOutput`
- `ConversationContext`
- `AdvisorChatInput.conversationId`

Run:

```bash
node --import tsx test_advisor_conversation_schema.ts
```

Expected: FAIL because schemas are missing.

**Step 2: Implement schemas**

Add Zod schemas and exported types:

```ts
export const AdvisorConversationCreateInputSchema = z.object({
  companyId: z.string().uuid(),
  companyName: z.string().trim().min(1).max(200).optional(),
  nemo: z.string().trim().regex(/^[A-Za-z0-9]{8}$/).transform((value) => value.toUpperCase()),
  title: z.string().trim().min(1).max(120).optional(),
});

export const AdvisorConversationOutputSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  nemo: z.string().regex(/^[A-Z0-9]{8}$/),
  title: z.string(),
  status: z.enum(['active', 'archived', 'deleted']),
  summary: z.string().nullable(),
  lastMessageAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
```

Also add `conversationId`, `messageId`, and `assistantMessageId` to `AdvisorRunOutputSchema` as optional fields.

**Step 3: Verify**

```bash
node --import tsx test_advisor_conversation_schema.ts
npm run build
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/schemas/advisor.schema.ts test_advisor_conversation_schema.ts
git commit -m "feat: add advisor conversation schemas"
```

### Task 3: Implement conversation store

**Files:**
- Create: `src/advisor/conversationStore.ts`
- Test: `test_advisor_conversation_store.ts`

**Step 1: Write failing store tests**

Use a fake postgres client and assert:

- `createConversation` inserts `user_id`, `company_id`, `nemo`, `title`.
- `getConversationForUser` rejects mismatched user/company/NEMO.
- `appendMessage` writes the correct `conversation_id`.
- `loadConversationContext` returns only messages for that conversation.

Run:

```bash
node --import tsx test_advisor_conversation_store.ts
```

Expected: FAIL because store is missing.

**Step 2: Implement store**

Create functions:

```ts
export async function createConversation(input: CreateConversationInput): Promise<AdvisorConversationOutput>
export async function listConversations(input: ListConversationsInput): Promise<AdvisorConversationOutput[]>
export async function getConversationForUser(input: GetConversationInput): Promise<AdvisorConversationRecord | null>
export async function appendMessage(input: AppendMessageInput): Promise<AdvisorMessageOutput>
export async function loadConversationContext(input: LoadConversationContextInput): Promise<ConversationContext>
export async function updateConversationTitle(input: UpdateConversationTitleInput): Promise<void>
export async function softDeleteConversation(input: DeleteConversationInput): Promise<void>
```

Use `createRailwaySql()` by default and dependency injection for tests.

**Step 3: Verify**

```bash
node --import tsx test_advisor_conversation_store.ts
npm run build
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/advisor/conversationStore.ts test_advisor_conversation_store.ts
git commit -m "feat: add advisor conversation store"
```

### Task 4: Add conversation API routes

**Files:**
- Create: `src/api/advisor-conversations.ts`
- Modify: `src/index.ts`
- Test: `test_advisor_conversations_api.ts`

**Step 1: Write failing API tests**

Test:

- unauthenticated request returns `401` when auth is required;
- `POST /advisor/conversations` creates a conversation;
- `GET /advisor/conversations?nemo=...` lists only that user's NEMO;
- `GET /advisor/conversations/:id/messages` returns only messages from that conversation;
- mismatched NEMO returns `403` or `409`.

Run:

```bash
node --import tsx test_advisor_conversations_api.ts
```

Expected: FAIL because route does not exist.

**Step 2: Implement route**

Add Hono route:

```ts
app.get('/', ...)
app.post('/', ...)
app.get('/:id/messages', ...)
app.patch('/:id', ...)
app.delete('/:id', ...)
```

Reuse `requireAuthorizedNemoIfConfigured`.

**Step 3: Mount route**

Modify `src/index.ts`:

```ts
import advisorConversationsApi from './api/advisor-conversations.js';
app.route('/advisor/conversations', advisorConversationsApi);
```

**Step 4: Verify**

```bash
node --import tsx test_advisor_conversations_api.ts
npm run build
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/api/advisor-conversations.ts src/index.ts test_advisor_conversations_api.ts
git commit -m "feat: expose advisor conversations api"
```

### Task 5: Integrate chat endpoint with persistent history

**Files:**
- Modify: `src/api/advisor-chat.ts`
- Modify: `src/advisor/orchestrator.ts`
- Modify: `src/advisor/responseWriter.ts`
- Test: `test_advisor_chat_persistence.ts`
- Test: `test_advisor_orchestrator.ts`

**Step 1: Write failing tests**

Test:

- chat without `conversationId` creates a conversation;
- chat with `conversationId` validates ownership;
- user message and assistant message are saved;
- orchestrator receives only the current conversation context;
- lightweight interactions still avoid snapshot loading;
- analytic interactions use context plus snapshot.

Run:

```bash
node --import tsx test_advisor_chat_persistence.ts
node --import tsx test_advisor_orchestrator.ts
```

Expected: FAIL.

**Step 2: Add `ConversationContext` to orchestrator options**

Extend `AdvisorOrchestratorOptions`:

```ts
conversationContext?: ConversationContext;
```

Extend `AdvisorResponseWriterInput`:

```ts
conversationContext?: ConversationContext;
```

Update `buildAdvisorWriterMessages` to include:

- conversation summary;
- recent messages;
- memory items.

Add strict instruction: conversation context can clarify the user's request, but operational metrics must come from the current snapshot.

**Step 3: Persist messages in route**

In `src/api/advisor-chat.ts`:

1. validate auth/NEMO;
2. resolve or create conversation;
3. append user message;
4. load conversation context;
5. call `runAdvisorChat`;
6. append assistant message with intent and output metadata;
7. return output with message ids.

**Step 4: Verify**

```bash
node --import tsx test_advisor_chat_persistence.ts
node --import tsx test_advisor_orchestrator.ts
npm run build
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/api/advisor-chat.ts src/advisor/orchestrator.ts src/advisor/responseWriter.ts test_advisor_chat_persistence.ts test_advisor_orchestrator.ts
git commit -m "feat: persist advisor chat history"
```

### Task 6: Add summary service

**Files:**
- Create: `src/advisor/conversationSummary.ts`
- Modify: `src/advisor/conversationStore.ts`
- Test: `test_advisor_conversation_summary.ts`

**Step 1: Write failing tests**

Test:

- no summary under threshold;
- summary is requested when message count exceeds threshold;
- summary preserves decisions and open issues;
- summary does not claim metrics as source of truth.

Run:

```bash
node --import tsx test_advisor_conversation_summary.ts
```

Expected: FAIL.

**Step 2: Implement summary service**

Initial threshold:

- summarize when more than 20 messages;
- keep last 12 messages;
- max summary length 2500 characters.

Use deterministic fallback if no AI provider exists:

```txt
Conversation summary unavailable; using recent messages only.
```

**Step 3: Integrate after assistant response**

After appending assistant message, call `maybeUpdateConversationSummary`.

**Step 4: Verify**

```bash
node --import tsx test_advisor_conversation_summary.ts
npm run build
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/advisor/conversationSummary.ts src/advisor/conversationStore.ts test_advisor_conversation_summary.ts
git commit -m "feat: summarize long advisor conversations"
```

### Task 7: Add memory store and extractor

**Files:**
- Create: `src/advisor/memoryStore.ts`
- Create: `src/advisor/memoryExtractor.ts`
- Create: `src/api/advisor-memory.ts`
- Modify: `src/index.ts`
- Test: `test_advisor_memory_store.ts`
- Test: `test_advisor_memory_extractor.ts`
- Test: `test_advisor_memory_api.ts`

**Step 1: Write failing memory tests**

Test:

- greetings do not create memory;
- "prefiero reportes ejecutivos" creates a `preference`;
- "decidimos revisar el contrato MATER" creates a `decision`;
- memory is scoped to `user_id + nemo`;
- memory from another NEMO is not loaded.

Run:

```bash
node --import tsx test_advisor_memory_store.ts
node --import tsx test_advisor_memory_extractor.ts
node --import tsx test_advisor_memory_api.ts
```

Expected: FAIL.

**Step 2: Implement memory store**

Functions:

```ts
listMemoryItems(input)
createMemoryItem(input)
archiveMemoryItem(input)
deleteMemoryItem(input)
loadRelevantMemory(input)
```

**Step 3: Implement conservative extractor**

Start deterministic. Do not use LLM for the first version.

Patterns:

- `prefiero ...` -> `preference`
- `decidimos ...` -> `decision`
- `queda pendiente ...` -> `open_issue`
- `confirmo que ...` -> `confirmed_fact`

Ignore:

- greetings;
- thanks;
- analytic outputs;
- ungrounded assistant statements.

**Step 4: Add memory API**

Routes:

```txt
GET    /advisor/memory?nemo=...
PATCH  /advisor/memory/:id
DELETE /advisor/memory/:id
```

**Step 5: Integrate with chat**

After a successful assistant response, extract memory from the user message and store allowed items.

**Step 6: Verify**

```bash
node --import tsx test_advisor_memory_store.ts
node --import tsx test_advisor_memory_extractor.ts
node --import tsx test_advisor_memory_api.ts
npm run build
```

Expected: PASS.

**Step 7: Commit**

```bash
git add src/advisor/memoryStore.ts src/advisor/memoryExtractor.ts src/api/advisor-memory.ts src/index.ts test_advisor_memory_store.ts test_advisor_memory_extractor.ts test_advisor_memory_api.ts
git commit -m "feat: add advisor structured memory"
```

### Task 8: Update frontend service types

**Files:**
- Modify: `E:/Proyectos/GitHub/EnergyOS/src/types/energyosAgent.ts`
- Modify: `E:/Proyectos/GitHub/EnergyOS/src/services/energyosAgent.ts`
- Modify: `E:/Proyectos/GitHub/EnergyOS/src/services/energyosAgent.test.ts`

**Step 1: Write failing service tests**

Add endpoint builder tests for:

- `/advisor/conversations`
- `/advisor/conversations/:id/messages`
- `/advisor/memory`

Add type-level usage for:

- `AgentConversation`
- `AgentMessage`
- `AgentMemoryItem`

Run:

```bash
node --experimental-strip-types src/services/energyosAgent.test.ts
```

Expected: FAIL.

**Step 2: Implement service functions**

Add:

```ts
listAdvisorConversations(nemo: string)
createAdvisorConversation(input)
listAdvisorMessages(conversationId: string, nemo: string)
updateAdvisorConversation(input)
deleteAdvisorConversation(conversationId: string, nemo: string)
listAdvisorMemory(nemo: string)
archiveAdvisorMemory(memoryId: string, nemo: string)
deleteAdvisorMemory(memoryId: string, nemo: string)
```

Also include `conversationId` in `askEnergyAgent`.

**Step 3: Verify**

```bash
node --experimental-strip-types src/services/energyosAgent.test.ts
npm run build
```

Expected: PASS.

**Step 4: Commit**

```bash
git add E:/Proyectos/GitHub/EnergyOS/src/types/energyosAgent.ts E:/Proyectos/GitHub/EnergyOS/src/services/energyosAgent.ts E:/Proyectos/GitHub/EnergyOS/src/services/energyosAgent.test.ts
git commit -m "feat: add advisor conversation client"
```

### Task 9: Replace localStorage chat source in Analizador

**Files:**
- Modify: `E:/Proyectos/GitHub/EnergyOS/src/pages/app/Analizador.tsx`

**Step 1: Add API-backed loading states**

Add states:

```ts
const [conversationsLoading, setConversationsLoading] = useState(false);
const [messagesLoading, setMessagesLoading] = useState(false);
const [backendAvailable, setBackendAvailable] = useState(true);
```

**Step 2: Load conversations from backend**

On `agente.id/nemo` change:

- call `listAdvisorConversations`;
- if empty, create a new conversation;
- if API fails, fall back to existing localStorage behavior.

**Step 3: Load messages per conversation**

When active conversation changes:

- call `listAdvisorMessages`;
- render backend messages.

**Step 4: Send conversationId in chat**

When calling `askEnergyAgent`, include:

```ts
conversationId: activeConversation.id
```

If response returns a different/new `conversationId`, update local state.

**Step 5: Keep local fallback only as fallback**

Do not persist successful backend conversations into localStorage as source of truth.

**Step 6: Verify**

```bash
node --experimental-strip-types src/services/energyosAgent.test.ts
npm run build
```

Expected: PASS.

**Step 7: Commit**

```bash
git add E:/Proyectos/GitHub/EnergyOS/src/pages/app/Analizador.tsx
git commit -m "feat: use persistent advisor conversations"
```

### Task 10: Add memory UI controls

**Files:**
- Modify: `E:/Proyectos/GitHub/EnergyOS/src/pages/app/Analizador.tsx`

**Step 1: Add compact memory drawer/panel**

Add a compact panel in the right sidebar or thread header showing active memory:

- preferences;
- decisions;
- open issues.

No marketing text. Keep it operational.

**Step 2: Add archive/delete controls**

Each memory item gets:

- archive button;
- delete button;
- short source label if available.

**Step 3: Verify**

```bash
npm run build
```

Expected: PASS.

**Step 4: Commit**

```bash
git add E:/Proyectos/GitHub/EnergyOS/src/pages/app/Analizador.tsx
git commit -m "feat: show advisor memory controls"
```

### Task 11: Full verification and deploy

**Files:**
- No code changes expected.

**Step 1: Backend full verification**

Run:

```bash
node --import tsx test_advisor_snapshot.ts
node --import tsx test_energyos_snapshot_builder.ts
node --import tsx test_advisor_metrics_v2.ts
node --import tsx test_advisor_intent_and_specialists.ts
node --import tsx test_advisor_qa.ts
node --import tsx test_document_intake.ts
node --import tsx test_advisor_response_writer.ts
node --import tsx test_advisor_run_store.ts
node --import tsx test_advisor_task_store.ts
node --import tsx test_nemo_authorization.ts
node --import tsx test_advisor_api_validation.ts
node --import tsx test_advisor_conversation_schema.ts
node --import tsx test_advisor_conversation_store.ts
node --import tsx test_advisor_conversations_api.ts
node --import tsx test_advisor_chat_persistence.ts
node --import tsx test_advisor_conversation_summary.ts
node --import tsx test_advisor_memory_store.ts
node --import tsx test_advisor_memory_extractor.ts
node --import tsx test_advisor_memory_api.ts
npm run build
```

Expected: all PASS.

**Step 2: Frontend verification**

Run from `E:/Proyectos/GitHub/EnergyOS`:

```bash
node --experimental-strip-types src/services/energyosAgent.test.ts
npm run build
```

Expected: PASS.

**Step 3: Apply Railway migration**

Run in `E:/Proyectos/GitHub/Energyos-IA` after confirming `RAILWAY_DATABASE_URL` points to production:

```bash
node --import tsx scripts/apply-migration.ts src/db/migrations/002_advisor_conversation_memory.sql
```

Expected: migration applied once, idempotent on repeat.

**Step 4: Deploy backend**

Deploy from a clean clone:

```bash
railway up --project 54d30130-bc24-4246-982b-2de5c639a48a --environment production --service EnergyOS-IA --detach --message "Deploy Advisor conversation memory"
```

**Step 5: Deploy frontend**

Deploy from a clean clone:

```bash
railway up --project 54d30130-bc24-4246-982b-2de5c639a48a --environment production --service EnergyOS --detach --message "Deploy Advisor persistent conversations"
```

**Step 6: Production smoke**

Run:

```bash
curl.exe -i https://energyos-ia-production.up.railway.app/health
```

Expected: `200 OK`.

Manual logged-in smoke in EnergyOS:

- open Analizador;
- create chat A;
- ask "que podes hacer?";
- create chat B;
- ask "resumime el ultimo mes";
- return to chat A and verify it did not inherit B's analysis;
- add "prefiero reportes ejecutivos";
- verify memory panel shows the preference;
- archive/delete memory item.

**Step 7: Commit deploy docs if any**

Only if deployment notes changed:

```bash
git add docs/plans/2026-05-18-advisor-conversation-memory-implementation.md
git commit -m "docs: update advisor conversation memory rollout"
```
