# EnergyOS AI Data Room Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert EnergyOS-IA from a monthly energy-data analyst into a contract-aware, evidence-aware consultative agent that uses the private Data Room safely.

**Architecture:** EnergyOS principal remains the system of record and permission boundary. EnergyOS-IA consumes a compact, authorized `ai-context` package, combines it with deterministic energy metrics, runs rule-based consultative checks, and uses the LLM only to interpret, prioritize, and communicate. Private client data must never be read directly from the frontend or mixed across NEMOs.

**Tech Stack:** React/Vite, Supabase Auth, Supabase Edge Functions, Railway Postgres, Hono, TypeScript, Zod, postgres-js, Supabase JS, OpenAI/Anthropic providers.

---

## 1. Strategic Direction

The next implementation must not start with "better prompts". The strategic move is to make the agent data-complete and permission-safe.

Current state:
- EnergyOS-IA can analyze public/system energy data: consumption, cost, exposure, coverage, renewable compliance, history, findings, recommendations.
- EnergyOS principal now has a private Data Room foundation: contracts UI, `client_private` schema, `client-data-room` Edge Function, NEMO-based authorization, contract versioning, and tables prepared for sites, invoices, DTE, forecasts, claims, SMEC, documents, responsibles, and tasks.

Target state:
- EnergyOS principal owns private data capture, validation, evidence, and authorization.
- EnergyOS-IA owns reasoning, deterministic checks, confidence, recommendations, chat, reports, and action plans.
- The bridge is a secure `ai-context` endpoint that returns only the compact private context needed for analysis.

Do not let the AI service query private Railway tables directly in v1. Use the Edge Function permission boundary.

---

## 2. Non-Negotiable Product Rules

1. Structured fields beat documents.
   - If `base_price`, `valid_from`, `valid_to`, `monthly_energy_mwh`, or `renewal_deadline` exists in structured Data Room fields, the agent must use those fields.
   - Documents are evidence and traceability, not the primary source of truth.

2. Code calculates; AI interprets.
   - Contract coverage, expiration, missing fields, forecast deltas, invoice deltas, and risk scores must be calculated by deterministic code.
   - The LLM may explain what the deterministic outputs mean.

3. NEMO is the private-data partition.
   - Never query private data only by `user_id`.
   - Every private context read must prove the requested NEMO is allowed for the current Supabase JWT.

4. No silent currency conversion.
   - Do not convert ARS/USD unless a versioned exchange-rate source is added.
   - If values are in different currencies, return "not comparable without FX source".

5. No autonomous external action.
   - The agent can recommend tasks, claims, or contract reviews.
   - It must not submit claims, change contracts, approve invoices, or notify external parties without human confirmation.

6. Confidence must reflect data readiness.
   - Draft contracts, missing documents, missing monthly commitments, missing invoice data, and missing responsibles lower confidence.

---

## 3. Recommended Build Order

Build in this order:

1. `ai-context` endpoint in EnergyOS principal.
2. Authentication and request contract in EnergyOS-IA.
3. Data Room client and tool in EnergyOS-IA.
4. Contract-aware deterministic checks.
5. Merge metrics plus private context in `analyze-period`.
6. Chat endpoint with private context.
7. Reports and action plans.
8. Additional Data Room CRUD/importers: sites, invoices/DTE, forecasts, claims, SMEC, documents.

This order creates value with contracts immediately, while leaving room for the rest of the Data Room to arrive incrementally.

---

## 4. Phase 0: Alignment and Contracts

### Task 0.1: Freeze v1 boundaries

**Files:**
- Reference: `E:/Proyectos/GitHub/EnergyOS/docs/data_room_private_contexto_ia.md`
- Reference: `E:/Proyectos/GitHub/Energyos-IA/energyos_data_analyst_agent_spec.md`
- Modify or create if desired: `E:/Proyectos/GitHub/EnergyOS/docs/plans/2026-05-17-ai-context-design.md`

**Decision:**
V1 private context includes:
- NEMO.
- Data Room completeness by block.
- Latest contracts.
- Contract readiness warnings.
- Active contract deadlines.
- Missing data list.
- Evidence metadata only, not full document contents.

V1 private context excludes:
- Full PDF text.
- Full contract clause text unless specifically requested later.
- Direct invoice reconciliation, unless invoice data CRUD/importers already exist.
- Mutating task creation.

**Acceptance criteria:**
- Everyone agrees `ai-context` is read-only.
- Everyone agrees EnergyOS-IA receives private context through authorized backend flow only.
- Everyone agrees contract data can improve confidence but does not replace invoice/DTE reconciliation.

---

## 5. Phase 1: EnergyOS Principal - `ai-context`

### Task 1.1: Add route dispatch to `client-data-room`

**Files:**
- Modify: `E:/Proyectos/GitHub/EnergyOS/supabase/functions/client-data-room/index.ts`
- Test: existing Edge Function smoke test pattern or add a focused script under `E:/Proyectos/GitHub/EnergyOS/scripts/`

**Implementation details:**
- Keep existing `GET /client-data-room?nemo=...` behavior unchanged.
- Add a route branch for:

```text
GET /client-data-room/ai-context?nemo=<NEMO>
```

If Supabase Edge Functions do not route path segments cleanly in the current setup, support:

```text
GET /client-data-room?mode=ai-context&nemo=<NEMO>
```

Prefer path-based routing if it is already supported by the function.

**Security:**
- Reuse current JWT validation.
- Reuse `current_user_nemos`.
- Normalize NEMO to uppercase.
- Return 401 without token.
- Return 403 if NEMO is not authorized.
- Return 400 if multiple NEMOs exist and no NEMO is requested.

**Acceptance criteria:**
- Unauthenticated request returns 401.
- Authorized request for owned NEMO returns 200.
- Authorized request for another NEMO returns 403.
- Existing GET/POST contract flows still work.

### Task 1.2: Define `AiContextResponse`

**Files:**
- Modify or create shared type: `E:/Proyectos/GitHub/EnergyOS/src/types/dataRoom.ts`
- Mirror later in: `E:/Proyectos/GitHub/Energyos-IA/src/schemas/clientPrivateContext.schema.ts`

**Response shape:**

```ts
type AiContextResponse = {
  nemo: string;
  generatedAt: string;
  completeness: {
    sites: ReadinessBlock;
    contracts: ReadinessBlock;
    invoices: ReadinessBlock;
    forecast: ReadinessBlock;
    claims: ReadinessBlock;
    smec: ReadinessBlock;
    responsibles: ReadinessBlock;
    documents: ReadinessBlock;
  };
  contracts: AiContractSummary[];
  activeDeadlines: AiDeadline[];
  openClaims: AiClaimSummary[];
  auditObservations: AiAuditObservationSummary[];
  missingData: AiMissingData[];
  evidence: AiEvidenceSummary[];
  warnings: AiContextWarning[];
};
```

Use compact summaries. Do not return raw table dumps.

**Acceptance criteria:**
- The response is stable enough for EnergyOS-IA to validate with Zod.
- Unknown future blocks can be omitted only if the schema marks them optional.
- Missing data is explicit and user-readable.

### Task 1.3: Query latest contracts

**Files:**
- Modify: `E:/Proyectos/GitHub/EnergyOS/supabase/functions/client-data-room/index.ts`

**Data source:**
- `client_private.v_contracts_latest`

**Return fields:**
- `id`
- `versionId`
- `versionNumber`
- `contractName`
- `contractType`
- `status`
- `buyerNemo`
- `sellerNemo`
- `generatorGroup`
- `marketerNemo`
- `startDate`
- `endDate`
- `signedDate`
- `monthlyEnergyMwh`
- `annualEnergyMwh`
- `contractedPowerMw`
- `priceCurrency`
- `basePrice`
- `priceType`
- `renewable`
- `technology`
- `internalOwnerEmail`
- `renewalDeadline`
- `adjustmentIndex`
- `adjustmentFrequency`
- `sourceDocumentName`
- `savedAt`

**Derived warnings:**
- `contract_status_draft` if status is `borrador`.
- `contract_missing_price` if `basePrice` is missing or zero.
- `contract_missing_energy` if both monthly and annual energy are missing or zero.
- `contract_missing_validity` if start or end date is missing.
- `contract_missing_evidence` if `sourceDocumentName` is missing.
- `contract_renewal_due_soon` if `renewalDeadline` is within 90 days.
- `contract_expiring_soon` if `endDate` is within 120 days.
- `contract_expired` if `endDate` is in the past and status is not `vencido` or `rescindido`.
- `contract_indexation_incomplete` if price type is `indexado` or `formula` and adjustment fields are missing.
- `renewable_contract_missing_technology` if renewable is true and technology is missing.

Use the server date in Argentina timezone only for display. Store comparisons using ISO dates.

**Acceptance criteria:**
- Contract warnings are deterministic.
- Warnings include `contractId`, `versionId`, `field`, `severity`, and `message`.

### Task 1.4: Compute Data Room completeness server-side

**Files:**
- Reference frontend logic: `E:/Proyectos/GitHub/EnergyOS/src/services/dataRoom.validation.ts`
- Modify: `E:/Proyectos/GitHub/EnergyOS/supabase/functions/client-data-room/index.ts`

**Rationale:**
Frontend readiness is useful for UI, but AI context must be generated server-side so the agent does not depend on UI state.

**V1 calculation:**
- `contracts`: complete if at least one active contract has validity, energy, price, owner, and evidence; partial if at least one contract exists; pending otherwise.
- `sites`: complete only if active sites exist; partial if table has rows missing power or responsible; pending if none.
- `invoices`: complete if validated invoices exist for last 12 periods; partial if some exist; pending if none.
- `forecast`: complete if budget/provision exists for current or target period; partial if older forecast exists; pending if none.
- `claims`: complete if claim tracking exists or explicitly no open claims is recorded later; v1 can mark partial if table exists with rows, pending if none.
- `smec`: complete if no open observations or all observations closed; partial if open observations exist; pending if no data.
- `responsibles`: complete if energia and finanzas contacts exist; partial if at least one active responsible exists; pending if none.
- `documents`: complete if linked evidence exists for active contracts and latest invoices; partial if unlinked documents exist; pending if none.

**Acceptance criteria:**
- Each block returns `status`, `pct`, and `detail`.
- The agent can explain why confidence is low without inventing reasons.

### Task 1.5: Add tests or smoke script for `ai-context`

**Files:**
- Create: `E:/Proyectos/GitHub/EnergyOS/scripts/smoke_ai_context.ts` or use existing project convention.

**Scenarios:**
- No token -> 401.
- Valid token and NEMO -> 200.
- Wrong NEMO -> 403.
- Empty Data Room -> 200 with pending blocks.
- One contract -> contract returned and warnings computed.

**Commands:**
- Run existing EnergyOS build command.
- Run Edge Function smoke script with test credentials.

**Acceptance criteria:**
- Smoke script cleans temporary data.
- No private data is printed except test NEMO and status summaries.

---

## 6. Phase 2: EnergyOS-IA - Auth and Request Model

### Task 2.1: Add auth middleware to IA API

**Files:**
- Modify: `E:/Proyectos/GitHub/Energyos-IA/src/index.ts`
- Create: `E:/Proyectos/GitHub/Energyos-IA/src/api/auth.ts`
- Modify: `E:/Proyectos/GitHub/Energyos-IA/src/config/env.ts`

**Problem:**
Current Hono API exposes agent endpoints without authentication and uses permissive CORS. That is acceptable only for local MVP, not for private Data Room integration.

**Implementation:**
- Read `Authorization: Bearer <jwt>` on private endpoints.
- Validate JWT through Supabase Auth using existing Supabase URL/service role or anon validation pattern.
- Store auth context in Hono context:

```ts
type AuthContext = {
  userId: string;
  token: string;
};
```

- Keep `/health` public.
- Require auth for:
  - `POST /agent/analyze-period`
  - future `POST /agent/ask`
  - future report/action endpoints
  - history endpoints unless they are internal-only.

**Acceptance criteria:**
- Missing token returns 401.
- Invalid token returns 401.
- Valid token reaches route handler.
- Existing local tests can use an explicit bypass only under `NODE_ENV=test`.

### Task 2.2: Update analyze-period input

**Files:**
- Modify: `E:/Proyectos/GitHub/Energyos-IA/src/schemas/api.schema.ts`
- Modify: `E:/Proyectos/GitHub/Energyos-IA/src/api/analyze-period.ts`
- Modify: `E:/Proyectos/GitHub/Energyos-IA/src/orchestrator/analyzePeriod.ts`

**Current input:**

```json
{
  "companyId": "uuid",
  "period": "2026-04",
  "analysisType": "monthly_diagnosis"
}
```

**New v1 input:**

```json
{
  "companyId": "uuid",
  "nemo": "ABCDEFGH",
  "period": "2026-04",
  "analysisType": "monthly_diagnosis",
  "includePrivateContext": true
}
```

Rules:
- `companyId` remains supported for existing system metrics.
- `nemo` is required when `includePrivateContext` is true.
- The route must not trust `nemo` locally. It forwards the user JWT to `client-data-room/ai-context`, which enforces authorization.
- If `includePrivateContext` is false or the endpoint is unavailable, analysis still runs with public/system data and lowers confidence.

**Acceptance criteria:**
- Backward compatibility for old callers if `includePrivateContext` is omitted.
- Private context is never fetched without JWT.
- Private context fetch failures are surfaced as limitations, not silent success.

### Task 2.3: Add IA environment config

**Files:**
- Modify: `E:/Proyectos/GitHub/Energyos-IA/src/config/env.ts`
- Modify: `E:/Proyectos/GitHub/Energyos-IA/.env.example`

**New env vars:**

```text
ENERGYOS_DATA_ROOM_FUNCTION_URL=
ENERGYOS_PRIVATE_CONTEXT_TIMEOUT_MS=8000
ENABLE_PRIVATE_CONTEXT=true
```

Do not add private Railway credentials for this purpose.

**Acceptance criteria:**
- App starts if private context is disabled.
- App fails clearly if enabled but URL is missing.
- Timeout is configurable.

---

## 7. Phase 3: EnergyOS-IA - Client Private Context Tool

### Task 3.1: Add Zod schema for private context

**Files:**
- Create: `E:/Proyectos/GitHub/Energyos-IA/src/schemas/clientPrivateContext.schema.ts`

**Schema contents:**
- `AiContextResponseSchema`
- `AiContractSummarySchema`
- `AiDeadlineSchema`
- `AiMissingDataSchema`
- `AiEvidenceSummarySchema`
- `AiContextWarningSchema`
- `ReadinessBlockSchema`

**Validation rules:**
- NEMO: uppercase 8 chars.
- Periods: `YYYY-MM`.
- Dates: ISO date strings or nullable.
- Currency: `ARS` or `USD`.
- Warnings severity: `low`, `medium`, `high`, `critical`.

**Acceptance criteria:**
- Unknown fields are stripped or ignored safely.
- Invalid private context fails closed and is reported as unavailable.

### Task 3.2: Add private context retriever

**Files:**
- Create: `E:/Proyectos/GitHub/Energyos-IA/src/tools/clientPrivateContext.ts`

**Function:**

```ts
export async function getClientPrivateContext(input: {
  nemo: string;
  userToken: string;
}): Promise<ClientPrivateContextResult>
```

**Behavior:**
- Calls `ENERGYOS_DATA_ROOM_FUNCTION_URL`.
- Sends `Authorization: Bearer <userToken>`.
- Sends `nemo` as query param.
- Applies timeout.
- Validates response with Zod.
- Returns typed data plus warnings.

**Failure modes:**
- 401/403 -> private context unavailable due auth; do not retry.
- 404 -> endpoint missing; record limitation.
- Timeout -> record limitation.
- Invalid schema -> record limitation and log internally.

**Acceptance criteria:**
- No token or NEMO is logged.
- Only response status and safe summary counts are logged.

### Task 3.3: Expose tool to agentic loop

**Files:**
- Modify: `E:/Proyectos/GitHub/Energyos-IA/src/tools/definitions.ts`
- Modify: `E:/Proyectos/GitHub/Energyos-IA/src/tools/executor.ts`

**Tool name:**

```text
get_client_private_context
```

**Description:**
Fetches authorized private Data Room context for a NEMO: contracts, completeness, deadlines, missing data, evidence summaries, and warnings.

**Inputs:**
- `nemo`

Do not expose `userToken` to the LLM. The executor should receive the token through execution context, not tool arguments.

**Required executor change:**
`executeTool` currently receives only `toolName` and `args`. Update it to accept context:

```ts
executeTool(toolName, args, { userToken })
```

**Acceptance criteria:**
- LLM cannot choose or spoof the token.
- Tool returns compact context, not raw private tables.

---

## 8. Phase 4: Contract-Aware Deterministic Analysis

### Task 4.1: Add contract risk analyzer

**Files:**
- Create: `E:/Proyectos/GitHub/Energyos-IA/src/tools/contractRiskAnalyzer.ts`
- Test: `E:/Proyectos/GitHub/Energyos-IA/src/tools/contractRiskAnalyzer.test.ts` if test runner is added, or `test_contract_risk.ts` following current repo style.

**Inputs:**
- `period`
- `metrics`
- `clientPrivateContext`

**Outputs:**
- `contractFindings`
- `contractRecommendations`
- `privateContextLimitations`

**Rules v1:**
- Active contract missing price -> high finding.
- Active contract missing energy -> high finding.
- Contract expires in 120 days -> medium/high depending period proximity.
- Renewal deadline in 90 days -> high if no owner, medium if owner exists.
- Draft contract used for analysis -> confidence medium at most.
- Renewable compliance gap and no active renewable contract -> high.
- Renewable compliance gap and renewable contract exists but missing annual energy -> medium/high missing data finding.
- Contracted monthly energy materially below demand -> exposure/cobertura risk.
- Contracted monthly energy materially above demand -> overcontracting/take-or-pay review warning, only if clause data exists or price type suggests commitment.
- Price currency differs from invoice/forecast currency -> comparison blocked without FX source.
- Missing evidence for active contract -> lower confidence.

Thresholds:
- Coverage shortfall warning if contracted monthly energy is less than 80% of current consumption.
- Overcoverage warning if contracted monthly energy is greater than 120% of current consumption.
- Do not apply those thresholds if consumption is missing.

**Acceptance criteria:**
- Every finding has evidence fields.
- Every recommendation has required data and confidence.
- No rule uses LLM.

### Task 4.2: Merge findings in analyze-period

**Files:**
- Modify: `E:/Proyectos/GitHub/Energyos-IA/src/orchestrator/analyzePeriod.ts`
- Modify if needed: `E:/Proyectos/GitHub/Energyos-IA/src/schemas/agentOutput.schema.ts`

**Behavior:**
- Run existing deterministic metrics/anomaly detector.
- Fetch private context when enabled.
- Run contract risk analyzer.
- Merge findings and recommendations.
- Sort by:
  1. severity,
  2. estimated economic impact if present,
  3. deadline proximity,
  4. confidence.

**Output additions:**
- Add `privateContextUsed: boolean`.
- Add `privateContextSummary`.
- Add `evidence`.
- Keep backward compatibility if consumers ignore new fields.

**Acceptance criteria:**
- Existing deterministic mode still works without private context.
- Private context improves `dataUsed`.
- Missing private context appears in `limitations`.

### Task 4.3: Update prompts for private context

**Files:**
- Modify: `E:/Proyectos/GitHub/Energyos-IA/src/prompts/system.ts`

**Add rules:**
- Use private Data Room fields as evidence when provided.
- Do not infer contract terms from documents if structured fields exist.
- Explicitly say when contract status is draft.
- Mention version and source document name if present.
- Do not convert currencies.
- Separate:
  - facts from EnergyOS metrics,
  - facts from Data Room,
  - hypotheses,
  - missing data.

**Acceptance criteria:**
- Prompt does not encourage the model to invent invoice or contract details.
- Prompt tells the model to ask for missing Data Room fields when confidence is limited.

---

## 9. Phase 5: Chat Endpoint

### Task 5.1: Add `/agent/ask`

**Files:**
- Create: `E:/Proyectos/GitHub/Energyos-IA/src/api/ask.ts`
- Modify: `E:/Proyectos/GitHub/Energyos-IA/src/index.ts`
- Modify: `E:/Proyectos/GitHub/Energyos-IA/src/schemas/api.schema.ts`

**Input:**

```json
{
  "companyId": "uuid",
  "nemo": "ABCDEFGH",
  "period": "2026-04",
  "question": "Por que subio el costo este mes?",
  "includePrivateContext": true
}
```

**Behavior:**
- Require auth.
- Classify question lightly:
  - metrics/current period,
  - contract/private context,
  - recommendation/action,
  - history/follow-up,
  - unsupported.
- Fetch only required context.
- Use agentic loop with tools.
- Return answer plus `dataUsed`, `missingData`, `confidence`, `limitations`.

**Acceptance criteria:**
- Questions about contracts fetch private context.
- Questions about metrics can run without private context if disabled.
- Unsupported questions do not hallucinate.

### Task 5.2: Add conversation memory later, not now

**Decision:**
Do not build full `agent_conversations` and `agent_messages` in this phase unless required by product.

**Rationale:**
The current priority is correctness, security, and data context. Chat memory can come after the first secure question-answer loop.

---

## 10. Phase 6: Reports and Action Plans

### Task 6.1: Add report generator service

**Files:**
- Create: `E:/Proyectos/GitHub/Energyos-IA/src/reports/reportGenerator.ts`
- Create: `E:/Proyectos/GitHub/Energyos-IA/src/api/generate-report.ts`
- Modify: `E:/Proyectos/GitHub/Energyos-IA/src/index.ts`

**V1 output:**
JSON report structure only:
- executive summary,
- key metrics,
- findings,
- recommendations,
- contract context,
- missing data,
- evidence,
- limitations.

Do not generate PDF in v1. PDF can be a later renderer once content is stable.

### Task 6.2: Add action plan generator

**Files:**
- Create: `E:/Proyectos/GitHub/Energyos-IA/src/actionPlan/actionPlanGenerator.ts`
- Create: `E:/Proyectos/GitHub/Energyos-IA/src/api/generate-action-plan.ts`

**Behavior:**
- Convert recommendations into action items.
- Use `internalOwnerEmail`, `responsibles`, or fallback owner missing.
- Suggest due date based on severity and deadlines.
- Do not write tasks to EnergyOS automatically in v1.

**Acceptance criteria:**
- Critical actions have due dates.
- Actions tied to contracts include contract id/version id.
- Missing responsible becomes a missing data item.

---

## 11. Phase 7: Expand EnergyOS Principal Data Capture

This phase can run in parallel after `ai-context` v1.

Priority order:

1. Sites and supply points.
   - Needed for plant-level deviation and impact attribution.
   - Build CRUD UI and API.
   - Connect contracts to sites through `contract_supply_points`.

2. Invoices, DTE, and invoice lines.
   - Needed for real reconciliation.
   - Build importer first for CSV/XLS/manual normalized rows.
   - PDF extraction can come later.

3. Forecasts and provisions.
   - Needed for finance value: budget vs real, cash impact, provision alerts.

4. Claims.
   - Needed to track recoveries, disputes, and operational follow-through.

5. SMEC/audit observations.
   - Needed for compliance and measurement risk.

6. Documents and evidence links.
   - Needed for traceability.
   - Prioritize metadata and links before full document parsing.

7. Tasks.
   - Needed once action plans are trusted enough to become workflow.
   - Keep human approval before task creation.

---

## 12. Phase 8: Invoice/DTE Reconciliation Later

Do not fake this early.

Required data:
- Contracts and monthly commitments.
- Invoice imports and invoice lines.
- DTE/liquidation lines.
- Site/supply point mapping.
- Currency and period consistency.
- Optional FX source if cross-currency comparison is required.

Deterministic checks:
- Factured energy vs contracted energy.
- Factured price vs contract price/formula.
- Factured total vs recalculated total.
- DTE amount vs invoice amount.
- Spot residual vs exposure data.
- Suspicious new charge concepts.
- Period mismatch.

V1 reconciliation output:
- `reconciled`, `difference_detected`, `insufficient_data`.
- difference amount in original currency.
- suspected cause.
- required confirmation data.
- recommended action.

---

## 13. Testing Strategy

### Unit tests

EnergyOS principal:
- `ai-context` completeness with no data.
- completeness with one draft contract.
- completeness with one active complete contract.
- warning generation for expiring contract.
- warning generation for missing price/energy/evidence.

EnergyOS-IA:
- Zod schema accepts valid context.
- Zod schema rejects invalid NEMO/currency.
- private context client handles 401/403/timeout.
- contract risk analyzer handles shortfall, expiry, draft, missing evidence, currency mismatch.
- analyze-period works with and without private context.

### Integration tests

- User with one NEMO calls `ai-context`.
- User with multiple NEMOs must specify NEMO.
- User cannot request unauthorized NEMO.
- IA endpoint forwards JWT and receives private context.
- IA output includes Data Room limitations when context is unavailable.

### Regression checks

Run in EnergyOS-IA:

```text
npm run typecheck
```

Run in EnergyOS principal:

```text
npm run build
```

Plus existing local validation tests for Data Room.

---

## 14. Observability and Privacy

### Logs

Allowed:
- request id,
- endpoint,
- status,
- elapsed ms,
- NEMO hash or redacted NEMO,
- counts: contracts count, warnings count, missing data count.

Not allowed:
- contract prices,
- customer names,
- invoice totals,
- source document names if they include sensitive names,
- JWT,
- Railway connection strings.

### Metrics

Track:
- private context fetch success rate,
- private context latency,
- auth failures,
- schema validation failures,
- average token usage,
- analysis runs with private context vs without,
- top missing data categories.

---

## 15. Rollout Plan

### Stage 1: Internal dev

- Build `ai-context`.
- Build IA private context client.
- Run smoke tests with temporary user/NEMO.
- Validate no direct private DB access from frontend.

### Stage 2: One test customer/NEMO

- Load one real or sanitized MATER contract.
- Run analyze-period with and without private context.
- Compare output quality.
- Confirm the agent does not overstate certainty.

### Stage 3: Controlled beta

- Enable for selected users.
- Show Data Room readiness in UI.
- Make missing data actionable.
- Collect feedback on recommendations.

### Stage 4: Expand domains

- Add sites.
- Add invoices/DTE.
- Add forecast.
- Add claims and SMEC.
- Only then add reconciliation and formal report exports.

---

## 16. Definition of Done

V1 is done when:
- `client-data-room/ai-context` returns authorized compact private context.
- EnergyOS-IA requires auth for private-context analysis.
- EnergyOS-IA can fetch Data Room context using the user JWT.
- Analyze-period merges system metrics with contract context.
- Contract-aware findings and recommendations are deterministic.
- The agent clearly states data used, evidence, missing data, confidence, and limitations.
- The agent does not convert currencies silently.
- Unauthorized NEMO access is impossible in smoke tests.
- Existing deterministic analysis still works when private context is disabled.

---

## 17. Implementation Tasks Summary

1. Create `ai-context` route in EnergyOS principal.
2. Add server-side Data Room completeness.
3. Add contract warnings and active deadlines.
4. Add smoke tests for `ai-context`.
5. Add IA auth middleware.
6. Update analyze-period input for `nemo` and `includePrivateContext`.
7. Add IA env vars for Data Room function URL and timeout.
8. Add IA Zod schemas for private context.
9. Add IA private context client.
10. Add `get_client_private_context` tool.
11. Add execution context support so tools can access user token without exposing it to LLM.
12. Add contract risk analyzer.
13. Merge contract findings into analyze-period.
14. Update system prompt for Data Room evidence rules.
15. Add `/agent/ask`.
16. Add JSON report generator.
17. Add action plan generator.
18. Expand EnergyOS principal CRUD/importers by priority: sites, invoices/DTE, forecasts, claims, SMEC, documents, tasks.

---

## 18. Main Risk Register

Risk: The agent receives private context without validating NEMO authorization.
Mitigation: Only fetch through Edge Function using user JWT; add 403 smoke tests.

Risk: The LLM invents contract terms from document names.
Mitigation: Prompt rule plus deterministic structured fields only; documents are evidence metadata.

Risk: Currency comparisons are wrong.
Mitigation: Block cross-currency comparisons until FX source exists.

Risk: Too much Data Room data bloats prompts.
Mitigation: `ai-context` returns summaries, warnings, and missing data, not full tables.

Risk: Users think draft contracts are verified.
Mitigation: Draft status lowers confidence and is visible in limitations.

Risk: Building all Data Room CRUD delays the first useful IA integration.
Mitigation: Start with contracts and `ai-context`; add domains incrementally.

