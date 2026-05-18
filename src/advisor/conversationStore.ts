import type { SnapshotSql } from '../context/energyosSnapshot.js';
import {
  AdvisorConversationOutputSchema,
  AdvisorMessageOutputSchema,
  ConversationContextSchema,
  type AdvisorConversationOutput,
  type AdvisorMessageOutput,
  type ConversationContext,
} from '../schemas/advisor.schema.js';

export type ConversationSql = SnapshotSql;

export type ConversationSqlFactory = () => ConversationSql;

export type AdvisorConversationRecord = AdvisorConversationOutput;

type ConversationRow = {
  id: string;
  company_id: string;
  nemo: string;
  title: string;
  status: 'active' | 'archived' | 'deleted';
  summary: string | null;
  last_message_at: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  intent: string | null;
  metadata: Record<string, unknown> | null;
  run_id?: string | null;
  created_at: string | Date;
};

type MemoryRow = {
  id: string;
  scope: 'user' | 'nemo' | 'conversation';
  type: 'preference' | 'confirmed_fact' | 'decision' | 'open_issue' | 'task_context';
  content: string;
  confidence: 'low' | 'medium' | 'high';
};

export type CreateConversationInput = {
  userId: string;
  companyId: string;
  nemo: string;
  title?: string;
  sqlFactory?: ConversationSqlFactory;
};

export type ListConversationsInput = {
  userId: string;
  nemo: string;
  limit?: number;
  sqlFactory?: ConversationSqlFactory;
};

export type GetConversationInput = {
  conversationId: string;
  userId: string;
  companyId: string;
  nemo: string;
  sqlFactory?: ConversationSqlFactory;
};

export type AppendMessageInput = {
  conversationId: string;
  userId: string;
  companyId: string;
  nemo: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  intent?: string | null;
  metadata?: Record<string, unknown>;
  runId?: string | null;
  sqlFactory?: ConversationSqlFactory;
};

export type LoadConversationContextInput = GetConversationInput & {
  limit?: number;
};

export type UpdateConversationTitleInput = GetConversationInput & {
  title: string;
};

export type UpdateConversationInput = GetConversationInput & {
  title?: string;
  status?: 'active' | 'archived';
};

export type DeleteConversationInput = GetConversationInput;

function normalizeNemo(nemo: string): string {
  return nemo.trim().toUpperCase().slice(0, 8);
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function trimTitle(value: string | undefined): string {
  const clean = value?.trim();
  if (!clean) return 'Nueva conversacion';
  return clean.length > 120 ? clean.slice(0, 120) : clean;
}

function mapConversation(row: ConversationRow): AdvisorConversationOutput {
  return AdvisorConversationOutputSchema.parse({
    id: row.id,
    companyId: row.company_id,
    nemo: normalizeNemo(row.nemo),
    title: row.title,
    status: row.status,
    summary: row.summary,
    lastMessageAt: toIso(row.last_message_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  });
}

function mapMessage(row: MessageRow): AdvisorMessageOutput {
  return AdvisorMessageOutputSchema.parse({
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    intent: row.intent,
    metadata: row.metadata ?? {},
    runId: row.run_id ?? null,
    createdAt: toIso(row.created_at),
  });
}

async function createDefaultSql(): Promise<ConversationSql> {
  const { createRailwaySql } = await import('../db/client.js');
  return createRailwaySql() as ConversationSql;
}

async function withSql<T>(
  sqlFactory: ConversationSqlFactory | undefined,
  fn: (sql: ConversationSql) => Promise<T>,
): Promise<T> {
  const sql = sqlFactory ? sqlFactory() : await createDefaultSql();
  try {
    return await fn(sql);
  } finally {
    await sql.end?.({ timeout: 5 });
  }
}

export async function createConversation(input: CreateConversationInput): Promise<AdvisorConversationOutput> {
  const nemo = normalizeNemo(input.nemo);
  const title = trimTitle(input.title);

  return withSql(input.sqlFactory, async (sql) => {
    const rows = await sql<ConversationRow[]>`
      insert into public.advisor_conversations (
        user_id,
        company_id,
        nemo,
        title
      )
      values (
        ${input.userId},
        ${input.companyId},
        ${nemo},
        ${title}
      )
      returning id, company_id, nemo, title, status, summary, last_message_at, created_at, updated_at
    `;

    if (!rows[0]) throw new Error('No se pudo crear la conversacion del advisor');
    return mapConversation(rows[0]);
  });
}

export async function listConversations(input: ListConversationsInput): Promise<AdvisorConversationOutput[]> {
  const nemo = normalizeNemo(input.nemo);
  const limit = input.limit ?? 40;

  return withSql(input.sqlFactory, async (sql) => {
    const rows = await sql<ConversationRow[]>`
      select id, company_id, nemo, title, status, summary, last_message_at, created_at, updated_at
      from public.advisor_conversations
      where user_id = ${input.userId}
        and nemo = ${nemo}
        and status <> 'deleted'
      order by last_message_at desc
      limit ${limit}
    `;

    return rows.map(mapConversation);
  });
}

export async function getConversationForUser(input: GetConversationInput): Promise<AdvisorConversationRecord | null> {
  const nemo = normalizeNemo(input.nemo);

  return withSql(input.sqlFactory, async (sql) => {
    const rows = await sql<ConversationRow[]>`
      select id, company_id, nemo, title, status, summary, last_message_at, created_at, updated_at
      from public.advisor_conversations
      where id = ${input.conversationId}
        and user_id = ${input.userId}
        and company_id = ${input.companyId}
        and nemo = ${nemo}
        and status <> 'deleted'
      limit 1
    `;

    return rows[0] ? mapConversation(rows[0]) : null;
  });
}

export async function appendMessage(input: AppendMessageInput): Promise<AdvisorMessageOutput> {
  const nemo = normalizeNemo(input.nemo);
  const metadata = input.metadata ?? {};

  return withSql(input.sqlFactory, async (sql) => {
    const rows = await sql<MessageRow[]>`
      insert into public.advisor_messages (
        conversation_id,
        user_id,
        company_id,
        nemo,
        role,
        content,
        intent,
        metadata,
        run_id
      )
      values (
        ${input.conversationId},
        ${input.userId},
        ${input.companyId},
        ${nemo},
        ${input.role},
        ${input.content},
        ${input.intent ?? null},
        ${metadata},
        ${input.runId ?? null}
      )
      returning id, conversation_id, role, content, intent, metadata, run_id, created_at
    `;

    await sql`
      update public.advisor_conversations
      set last_message_at = now(),
          updated_at = now()
      where id = ${input.conversationId}
        and user_id = ${input.userId}
        and company_id = ${input.companyId}
        and nemo = ${nemo}
    `;

    if (!rows[0]) throw new Error('No se pudo guardar el mensaje del advisor');
    return mapMessage(rows[0]);
  });
}

export async function loadConversationContext(input: LoadConversationContextInput): Promise<ConversationContext> {
  const nemo = normalizeNemo(input.nemo);
  const limit = input.limit ?? 12;

  return withSql(input.sqlFactory, async (sql) => {
    const conversations = await sql<ConversationRow[]>`
      select id, company_id, nemo, title, status, summary, last_message_at, created_at, updated_at
      from public.advisor_conversations
      where id = ${input.conversationId}
        and user_id = ${input.userId}
        and company_id = ${input.companyId}
        and nemo = ${nemo}
        and status <> 'deleted'
      limit 1
    `;

    const conversation = conversations[0];
    if (!conversation) {
      throw new Error('Conversacion no encontrada o no autorizada');
    }

    const messages = await sql<MessageRow[]>`
      select id, conversation_id, role, content, intent, metadata, run_id, created_at
      from (
        select id, conversation_id, role, content, intent, metadata, run_id, created_at
        from public.advisor_messages
        where conversation_id = ${input.conversationId}
        order by created_at desc
        limit ${limit}
      ) recent
      order by created_at asc
    `;

    const memory = await sql<MemoryRow[]>`
      select id, scope, type, content, confidence
      from public.advisor_memory_items
      where user_id = ${input.userId}
        and (
          scope = 'user'
          or (scope = 'nemo' and nemo = ${nemo})
          or (scope = 'conversation' and conversation_id = ${input.conversationId})
        )
        and status = 'active'
      order by updated_at desc
      limit 12
    `;

    return ConversationContextSchema.parse({
      conversationId: input.conversationId,
      summary: conversation.summary,
      recentMessages: messages.map(mapMessage),
      memory,
    });
  });
}

export async function updateConversationTitle(input: UpdateConversationTitleInput): Promise<void> {
  await updateConversation(input);
}

export async function updateConversation(input: UpdateConversationInput): Promise<void> {
  const nemo = normalizeNemo(input.nemo);
  const title = input.title === undefined ? undefined : trimTitle(input.title);
  const status = input.status;

  await withSql(input.sqlFactory, async (sql) => {
    if (title !== undefined && status !== undefined) {
      await sql`
        update public.advisor_conversations
        set title = ${title},
            status = ${status},
            updated_at = now()
        where id = ${input.conversationId}
          and user_id = ${input.userId}
          and company_id = ${input.companyId}
          and nemo = ${nemo}
          and status <> 'deleted'
      `;
      return;
    }

    if (title !== undefined) {
      await sql`
        update public.advisor_conversations
        set title = ${title},
            updated_at = now()
        where id = ${input.conversationId}
          and user_id = ${input.userId}
          and company_id = ${input.companyId}
          and nemo = ${nemo}
          and status <> 'deleted'
      `;
      return;
    }

    if (status !== undefined) {
      await sql`
        update public.advisor_conversations
        set status = ${status},
            updated_at = now()
        where id = ${input.conversationId}
          and user_id = ${input.userId}
          and company_id = ${input.companyId}
          and nemo = ${nemo}
          and status <> 'deleted'
      `;
    }
  });
}

export async function softDeleteConversation(input: DeleteConversationInput): Promise<void> {
  const nemo = normalizeNemo(input.nemo);

  await withSql(input.sqlFactory, async (sql) => {
    await sql`
      update public.advisor_conversations
      set status = 'deleted',
          updated_at = now()
      where id = ${input.conversationId}
        and user_id = ${input.userId}
        and company_id = ${input.companyId}
        and nemo = ${nemo}
    `;
  });
}
