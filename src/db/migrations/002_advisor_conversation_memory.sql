-- ============================================================================
-- EnergyOS Advisor - Conversaciones persistentes y memoria estructurada
-- ============================================================================

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

create index if not exists advisor_conversations_nemo_company_idx
  on public.advisor_conversations(nemo, company_id);

comment on table public.advisor_conversations is
  'Chats persistentes del EnergyOS Advisor, aislados por usuario y NEMO.';

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

create index if not exists advisor_messages_user_nemo_created_idx
  on public.advisor_messages(user_id, nemo, created_at desc);

comment on table public.advisor_messages is
  'Mensajes persistentes de cada conversacion del EnergyOS Advisor.';

create table if not exists public.advisor_memory_items (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('user', 'nemo', 'conversation')),
  user_id uuid not null,
  company_id uuid null,
  nemo text null check (nemo is null or nemo ~ '^[A-Z0-9]{8}$'),
  conversation_id uuid null references public.advisor_conversations(id) on delete set null,
  type text not null check (type in ('preference', 'confirmed_fact', 'decision', 'open_issue', 'task_context')),
  content text not null,
  confidence text not null default 'medium'
    check (confidence in ('low', 'medium', 'high')),
  source_message_id uuid null references public.advisor_messages(id) on delete set null,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'active'
    check (status in ('active', 'archived', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists advisor_memory_user_nemo_status_idx
  on public.advisor_memory_items(user_id, nemo, status, updated_at desc);

create index if not exists advisor_memory_conversation_status_idx
  on public.advisor_memory_items(conversation_id, status);

create index if not exists advisor_memory_scope_type_status_idx
  on public.advisor_memory_items(scope, type, status);

comment on table public.advisor_memory_items is
  'Memoria estructurada persistente del EnergyOS Advisor con scope y fuente.';
