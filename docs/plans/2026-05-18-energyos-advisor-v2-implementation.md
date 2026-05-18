# EnergyOS Advisor V2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build EnergyOS Advisor V2 as a production-grade orchestrated expert agent that uses Railway snapshots as source of truth, deterministic metrics, specialist modules, file intake, and evidence validation.

**Architecture:** The user sees one Advisor, but the backend runs a coded orchestrator. Each request validates auth/NEMO, builds an EnergyOS snapshot from Railway and Data Room, computes metrics deterministically, routes intent, invokes specialists only when useful, and validates the final answer against evidence.

**Tech Stack:** TypeScript, Hono, Node 22, postgres.js, Supabase Auth, Gemini/OpenAI/Anthropic provider abstraction, Zod schemas, root-level tsx test scripts.

---

### Task 1: Add V2 schemas and fixtures

**Files:**
- Create: `src/schemas/advisor.schema.ts`
- Create: `test_advisor_snapshot.ts`

**Step 1: Write failing tests**

Add tests proving:

- A snapshot with consumo, exposicion, DTE and compliance parses.
- Data availability reports `available: true` for populated domains.
- The schema supports files in chat input.

Run:

```bash
node --import tsx test_advisor_snapshot.ts
```

Expected: FAIL because `advisor.schema.ts` does not exist.

**Step 2: Implement schemas**

Create Zod schemas and types for:

- `AdvisorFile`
- `AdvisorChatInput`
- `EnergySnapshot`
- `SnapshotDataAvailability`
- `AdvisorMetrics`
- `AdvisorRunOutput`
- `EvidenceRef`

**Step 3: Verify**

Run:

```bash
node --import tsx test_advisor_snapshot.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/schemas/advisor.schema.ts test_advisor_snapshot.ts
git commit -m "feat: add advisor v2 schemas"
```

### Task 2: Build Railway snapshot provider

**Files:**
- Create: `src/context/energyosSnapshot.ts`
- Create: `test_energyos_snapshot_builder.ts`

**Step 1: Write failing tests**

Add tests with an injected fake SQL function proving:

- `buildEnergySnapshot` returns current period data for `ACINVCSZ / 2026-03`.
- It maps `demanda_real_mwh`, `compra_spot_mwh`, `factura_total_pesos`, `costo_dte_pesos_mwh`.
- It marks missing domains without erasing available domains.

Run:

```bash
node --import tsx test_energyos_snapshot_builder.ts
```

Expected: FAIL because builder is missing.

**Step 2: Implement builder**

Use dependency injection:

```ts
buildEnergySnapshot({ companyId, companyName, nemo, period, includePrivateContext, userToken, sqlFactory })
```

Default `sqlFactory` uses `createRailwaySql`.

Read Railway views:

- `cammesa_agentes_mem`
- `vw_consumo_gu_mensual`
- `vw_exposicion_spot_mensual`
- `vw_factura_dte_resumen_mensual`
- `factura_dte_conceptos_mensual`
- `vw_compliance_27191_mensual`
- `vw_factor_carga_mensual`
- `vw_historia_resumen_agente`
- `vw_mercado_resumen_mensual`

Use `getClientPrivateContext` for Data Room when requested.

**Step 3: Verify**

Run:

```bash
node --import tsx test_energyos_snapshot_builder.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/context/energyosSnapshot.ts test_energyos_snapshot_builder.ts
git commit -m "feat: build railway energy snapshots"
```

### Task 3: Add Metrics Engine V2

**Files:**
- Create: `src/advisor/metricsV2.ts`
- Create: `test_advisor_metrics_v2.ts`

**Step 1: Write failing tests**

Test that metrics from snapshot calculate:

- `totalConsumptionMwh`
- `spotExposurePct`
- `contractCoveragePct`
- `invoiceTotalPesos`
- `costDtePesosMwh`
- `renewableYtdPct`
- `riskScore`

Run:

```bash
node --import tsx test_advisor_metrics_v2.ts
```

Expected: FAIL because module is missing.

**Step 2: Implement deterministic metrics**

Do not use LLM. Convert string/numeric values safely. Keep nulls when data is absent.

**Step 3: Verify**

Run:

```bash
node --import tsx test_advisor_metrics_v2.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/advisor/metricsV2.ts test_advisor_metrics_v2.ts
git commit -m "feat: add advisor deterministic metrics"
```

### Task 4: Add intent router and specialists

**Files:**
- Create: `src/advisor/intentRouter.ts`
- Create: `src/advisor/specialists.ts`
- Create: `test_advisor_intent_and_specialists.ts`

**Step 1: Write failing tests**

Test:

- Greeting intent does not ask for client.
- "resumen del ultimo mes" routes to monthly summary.
- "factura" routes to invoice.
- "contrato" routes to contract.
- "ley 27191" routes to compliance.
- Specialists produce findings from snapshot/metrics without LLM.

Run:

```bash
node --import tsx test_advisor_intent_and_specialists.ts
```

Expected: FAIL because modules are missing.

**Step 2: Implement router and deterministic specialists**

Specialists return structured findings, recommendations, missing data and evidence references.

**Step 3: Verify**

Run:

```bash
node --import tsx test_advisor_intent_and_specialists.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/advisor/intentRouter.ts src/advisor/specialists.ts test_advisor_intent_and_specialists.ts
git commit -m "feat: route advisor intents to specialists"
```

### Task 5: Add QA validator

**Files:**
- Create: `src/advisor/qaValidator.ts`
- Create: `test_advisor_qa.ts`

**Step 1: Write failing tests**

Test:

- A response saying "no hay datos" fails when snapshot has current consumption.
- A response with another NEMO fails.
- A valid summary passes.

Run:

```bash
node --import tsx test_advisor_qa.ts
```

Expected: FAIL because validator is missing.

**Step 2: Implement validator**

Return `{ passed, issues, correctedResponse? }`. For contradiction about missing data, replace with a safe deterministic summary.

**Step 3: Verify**

Run:

```bash
node --import tsx test_advisor_qa.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/advisor/qaValidator.ts test_advisor_qa.ts
git commit -m "feat: validate advisor responses against evidence"
```

### Task 6: Add orchestrator and V2 chat API

**Files:**
- Create: `src/advisor/orchestrator.ts`
- Create: `src/api/advisor-chat.ts`
- Modify: `src/index.ts`
- Modify: `src/schemas/api.schema.ts`
- Create: `test_advisor_orchestrator.ts`

**Step 1: Write failing tests**

Test:

- Greeting includes company name/NEMO.
- Monthly summary with populated snapshot mentions actual consumption and invoice values.
- File payloads are accepted and classified.
- QA correction prevents "no hay datos" contradiction.

Run:

```bash
node --import tsx test_advisor_orchestrator.ts
```

Expected: FAIL because orchestrator/API are missing.

**Step 2: Implement orchestrator**

Implement:

- `runAdvisorChat`
- snapshot build
- metrics V2
- intent routing
- specialist execution
- optional LLM report writer
- QA validation
- structured output

**Step 3: Implement API**

Add `POST /advisor/chat` and route it in `src/index.ts`. Keep legacy `/agent/ask`.

**Step 4: Verify**

Run:

```bash
node --import tsx test_advisor_orchestrator.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/advisor/orchestrator.ts src/api/advisor-chat.ts src/index.ts src/schemas/api.schema.ts test_advisor_orchestrator.ts
git commit -m "feat: add advisor v2 orchestrator"
```

### Task 7: Wire legacy ask endpoint to V2

**Files:**
- Modify: `src/api/ask.ts`
- Modify: `test_chat_intent.ts`
- Create: `test_legacy_ask_schema_files.ts`

**Step 1: Write failing tests**

Test:

- `AskInputSchema` accepts `files`.
- Legacy ask can delegate to `runAdvisorChat`.

Run:

```bash
node --import tsx test_legacy_ask_schema_files.ts
```

Expected: FAIL before schema/API changes.

**Step 2: Modify legacy ask**

For non-greeting questions, call V2 orchestrator. Keep existing provider fallback only where needed.

**Step 3: Verify**

Run:

```bash
node --import tsx test_legacy_ask_schema_files.ts
node --import tsx test_chat_intent.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/api/ask.ts src/schemas/api.schema.ts test_legacy_ask_schema_files.ts test_chat_intent.ts
git commit -m "feat: route legacy ask through advisor v2"
```

### Task 8: Full verification and deploy readiness

**Files:**
- Modify only if verification finds issues.

**Step 1: Run focused tests**

```bash
node --import tsx test_advisor_snapshot.ts
node --import tsx test_energyos_snapshot_builder.ts
node --import tsx test_advisor_metrics_v2.ts
node --import tsx test_advisor_intent_and_specialists.ts
node --import tsx test_advisor_qa.ts
node --import tsx test_advisor_orchestrator.ts
node --import tsx test_legacy_ask_schema_files.ts
node --import tsx test_chat_intent.ts
```

**Step 2: Run build**

```bash
npm run build
```

**Step 3: Check git diff**

```bash
git status --short
git diff --stat
```

**Step 4: Commit fixes if needed**

Commit only files touched by Advisor V2. Do not stage unrelated `tsconfig.json` or `Dockerfile` unless intentionally modified by this plan.

