-- ============================================================================
-- EnergyOS Data Analyst Agent — Tablas del agente
-- Fase 1: agent_runs, agent_findings, agent_recommendations
-- ============================================================================

-- 1. Ejecuciones del agente ─────────────────────────────────────────────────

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  period text not null,
  task_type text not null,
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb null,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  model_used text null,
  tokens_used integer null,
  cost_estimate numeric null,
  confidence text null
    check (confidence is null or confidence in ('low', 'medium', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_runs_company_period_idx
  on public.agent_runs(company_id, period);

create index if not exists agent_runs_status_idx
  on public.agent_runs(status);

create index if not exists agent_runs_created_at_idx
  on public.agent_runs(created_at desc);

comment on table public.agent_runs is
  'Registro de cada ejecución del agente de análisis energético.';

-- 2. Hallazgos detectados ──────────────────────────────────────────────────

create table if not exists public.agent_findings (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  company_id uuid not null,
  period text not null,
  type text not null,
  title text not null,
  severity text not null
    check (severity in ('low', 'medium', 'high', 'critical')),
  evidence_json jsonb not null default '{}'::jsonb,
  interpretation text null,
  likely_causes_json jsonb null,
  missing_data_json jsonb null,
  confidence text not null
    check (confidence in ('low', 'medium', 'high')),
  status text not null default 'detected'
    check (status in ('detected', 'confirmed', 'dismissed', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_findings_company_period_idx
  on public.agent_findings(company_id, period);

create index if not exists agent_findings_run_idx
  on public.agent_findings(agent_run_id);

create index if not exists agent_findings_severity_idx
  on public.agent_findings(severity);

comment on table public.agent_findings is
  'Hallazgos (anomalías, alertas, oportunidades) detectados por el agente.';

-- 3. Recomendaciones ───────────────────────────────────────────────────────

create table if not exists public.agent_recommendations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  period text not null,
  finding_id text null,
  title text not null,
  priority text not null
    check (priority in ('low', 'medium', 'high', 'critical')),
  reason text not null,
  action text not null,
  expected_impact text null,
  required_data_json jsonb null,
  confidence text not null
    check (confidence in ('low', 'medium', 'high')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'in_progress', 'completed', 'obsolete')),
  feedback_comment text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_recommendations_company_idx
  on public.agent_recommendations(company_id);

create index if not exists agent_recommendations_status_idx
  on public.agent_recommendations(status);

create index if not exists agent_recommendations_priority_idx
  on public.agent_recommendations(priority);

comment on table public.agent_recommendations is
  'Recomendaciones accionables generadas por el agente, con lifecycle de aceptación.';

-- 4. RLS ───────────────────────────────────────────────────────────────────

alter table public.agent_runs enable row level security;
alter table public.agent_findings enable row level security;
alter table public.agent_recommendations enable row level security;

-- Política: service_role puede todo (el agente usa service_role key)
-- Los usuarios autenticados pueden leer sus propios datos (futuro)

drop policy if exists agent_runs_service_all on public.agent_runs;
create policy agent_runs_service_all
  on public.agent_runs for all
  to service_role
  using (true) with check (true);

drop policy if exists agent_findings_service_all on public.agent_findings;
create policy agent_findings_service_all
  on public.agent_findings for all
  to service_role
  using (true) with check (true);

drop policy if exists agent_recommendations_service_all on public.agent_recommendations;
create policy agent_recommendations_service_all
  on public.agent_recommendations for all
  to service_role
  using (true) with check (true);

-- Lectores autenticados: pueden leer análisis de su empresa
-- (se vincula vía user_profiles → agentes_monitoreados en una fase posterior)
drop policy if exists agent_runs_authenticated_read on public.agent_runs;
create policy agent_runs_authenticated_read
  on public.agent_runs for select
  to authenticated
  using (true);

drop policy if exists agent_findings_authenticated_read on public.agent_findings;
create policy agent_findings_authenticated_read
  on public.agent_findings for select
  to authenticated
  using (true);

drop policy if exists agent_recommendations_authenticated_read on public.agent_recommendations;
create policy agent_recommendations_authenticated_read
  on public.agent_recommendations for select
  to authenticated
  using (true);
