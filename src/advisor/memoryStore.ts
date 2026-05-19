import type { SnapshotSql } from '../context/energyosSnapshot.js';

export type MemorySql = SnapshotSql;
export type MemorySqlFactory = () => MemorySql;

export type MemoryScope = 'user' | 'nemo' | 'conversation';
export type MemoryType = 'preference' | 'confirmed_fact' | 'decision' | 'open_issue' | 'task_context';
export type MemoryConfidence = 'low' | 'medium' | 'high';
export type MemoryStatus = 'active' | 'archived' | 'deleted';

export type AdvisorMemoryItem = {
  id: string;
  scope: MemoryScope;
  userId: string;
  companyId: string | null;
  nemo: string | null;
  conversationId: string | null;
  type: MemoryType;
  content: string;
  confidence: MemoryConfidence;
  sourceMessageId: string | null;
  evidence: Record<string, unknown>;
  status: MemoryStatus;
  createdAt: string;
  updatedAt: string;
};

type MemoryRow = {
  id: string;
  scope: MemoryScope;
  user_id: string;
  company_id: string | null;
  nemo: string | null;
  conversation_id: string | null;
  type: MemoryType;
  content: string;
  confidence: MemoryConfidence;
  source_message_id: string | null;
  evidence: Record<string, unknown> | null;
  status: MemoryStatus;
  created_at: string | Date;
  updated_at: string | Date;
};

export type CreateMemoryItemInput = {
  scope: MemoryScope;
  userId: string;
  companyId?: string | null;
  nemo?: string | null;
  conversationId?: string | null;
  type: MemoryType;
  content: string;
  confidence?: MemoryConfidence;
  sourceMessageId?: string | null;
  evidence?: Record<string, unknown>;
  sqlFactory?: MemorySqlFactory;
};

export type ListMemoryItemsInput = {
  userId: string;
  nemo?: string | null;
  status?: MemoryStatus;
  limit?: number;
  sqlFactory?: MemorySqlFactory;
};

export type LoadRelevantMemoryInput = {
  userId: string;
  nemo: string;
  conversationId?: string | null;
  limit?: number;
  sqlFactory?: MemorySqlFactory;
};

export type MutateMemoryItemInput = {
  memoryId: string;
  userId: string;
  nemo?: string | null;
  sqlFactory?: MemorySqlFactory;
};

function normalizeNemo(nemo: string | null | undefined): string | null {
  const value = nemo?.trim().toUpperCase().slice(0, 8);
  return value || null;
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function mapMemory(row: MemoryRow): AdvisorMemoryItem {
  return {
    id: row.id,
    scope: row.scope,
    userId: row.user_id,
    companyId: row.company_id,
    nemo: normalizeNemo(row.nemo),
    conversationId: row.conversation_id,
    type: row.type,
    content: row.content,
    confidence: row.confidence,
    sourceMessageId: row.source_message_id,
    evidence: row.evidence ?? {},
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

async function createDefaultSql(): Promise<MemorySql> {
  const { createRailwaySql } = await import('../db/client.js');
  return createRailwaySql() as MemorySql;
}

async function withSql<T>(
  sqlFactory: MemorySqlFactory | undefined,
  fn: (sql: MemorySql) => Promise<T>,
): Promise<T> {
  const sql = sqlFactory ? sqlFactory() : await createDefaultSql();
  try {
    return await fn(sql);
  } finally {
    await sql.end?.({ timeout: 5 });
  }
}

export async function createMemoryItem(input: CreateMemoryItemInput): Promise<AdvisorMemoryItem> {
  const nemo = normalizeNemo(input.nemo);
  const evidence = input.evidence ?? {};

  return withSql(input.sqlFactory, async (sql) => {
    const rows = await sql<MemoryRow[]>`
      insert into public.advisor_memory_items (
        scope,
        user_id,
        company_id,
        nemo,
        conversation_id,
        type,
        content,
        confidence,
        source_message_id,
        evidence
      )
      values (
        ${input.scope},
        ${input.userId},
        ${input.companyId ?? null},
        ${nemo},
        ${input.conversationId ?? null},
        ${input.type},
        ${input.content},
        ${input.confidence ?? 'medium'},
        ${input.sourceMessageId ?? null},
        ${evidence}
      )
      returning id, scope, user_id, company_id, nemo, conversation_id, type, content,
        confidence, source_message_id, evidence, status, created_at, updated_at
    `;

    if (!rows[0]) throw new Error('No se pudo crear memoria del advisor');
    return mapMemory(rows[0]);
  });
}

export async function listMemoryItems(input: ListMemoryItemsInput): Promise<AdvisorMemoryItem[]> {
  const nemo = normalizeNemo(input.nemo);
  const status = input.status ?? 'active';
  const limit = input.limit ?? 50;

  return withSql(input.sqlFactory, async (sql) => {
    const rows = await sql<MemoryRow[]>`
      select id, scope, user_id, company_id, nemo, conversation_id, type, content,
        confidence, source_message_id, evidence, status, created_at, updated_at
      from public.advisor_memory_items
      where user_id = ${input.userId}
        and (${nemo}::text is null or nemo = ${nemo})
        and status = ${status}
      order by updated_at desc
      limit ${limit}
    `;

    return rows.map(mapMemory);
  });
}

export async function loadRelevantMemory(input: LoadRelevantMemoryInput): Promise<AdvisorMemoryItem[]> {
  const nemo = normalizeNemo(input.nemo);
  const limit = input.limit ?? 12;

  return withSql(input.sqlFactory, async (sql) => {
    const rows = await sql<MemoryRow[]>`
      select id, scope, user_id, company_id, nemo, conversation_id, type, content,
        confidence, source_message_id, evidence, status, created_at, updated_at
      from public.advisor_memory_items
      where user_id = ${input.userId}
        and (
          scope = 'user'
          or (scope = 'nemo' and nemo = ${nemo})
          or (scope = 'conversation' and conversation_id = ${input.conversationId ?? null})
        )
        and status = 'active'
      order by updated_at desc
      limit ${limit}
    `;

    return rows.map(mapMemory);
  });
}

async function updateMemoryStatus(input: MutateMemoryItemInput, status: 'archived' | 'deleted'): Promise<void> {
  const nemo = normalizeNemo(input.nemo);

  await withSql(input.sqlFactory, async (sql) => {
    await sql`
      update public.advisor_memory_items
      set status = ${status},
          updated_at = now()
      where id = ${input.memoryId}
        and user_id = ${input.userId}
        and (${nemo}::text is null or nemo = ${nemo})
    `;
  });
}

export function archiveMemoryItem(input: MutateMemoryItemInput): Promise<void> {
  return updateMemoryStatus(input, 'archived');
}

export function deleteMemoryItem(input: MutateMemoryItemInput): Promise<void> {
  return updateMemoryStatus(input, 'deleted');
}
