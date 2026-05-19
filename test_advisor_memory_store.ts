import assert from 'node:assert/strict';
import {
  archiveMemoryItem,
  createMemoryItem,
  deleteMemoryItem,
  listMemoryItems,
  loadRelevantMemory,
  type MemorySql,
} from './src/advisor/memoryStore.js';

type SqlCall = {
  text: string;
  values: unknown[];
};

function fakeSql(responses: unknown[][]) {
  const calls: SqlCall[] = [];
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join('?'), values });
    return responses.shift() ?? [];
  }) as MemorySql;

  sql.end = async () => undefined;
  return { sql, calls };
}

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const companyId = '11111111-1111-4111-8111-111111111111';
const conversationId = '22222222-2222-4222-8222-222222222222';
const memoryId = '44444444-4444-4444-8444-444444444444';

const memoryRow = {
  id: memoryId,
  scope: 'nemo',
  user_id: userId,
  company_id: companyId,
  nemo: 'ACINVCSZ',
  conversation_id: conversationId,
  type: 'preference',
  content: 'Prefiere reportes ejecutivos.',
  confidence: 'high',
  source_message_id: null,
  evidence: {},
  status: 'active',
  created_at: '2026-05-18T12:00:00.000Z',
  updated_at: '2026-05-18T12:00:00.000Z',
};

{
  const { sql, calls } = fakeSql([[memoryRow]]);
  const created = await createMemoryItem({
    userId,
    companyId,
    nemo: 'acinvcsz',
    conversationId,
    scope: 'nemo',
    type: 'preference',
    content: 'Prefiere reportes ejecutivos.',
    confidence: 'high',
    sqlFactory: () => sql,
  });

  assert.equal(created.id, memoryId);
  assert.equal(created.nemo, 'ACINVCSZ');
  assert.match(calls[0].text, /insert into public\.advisor_memory_items/i);
  assert.equal(calls[0].values[0], 'nemo');
  assert.equal(calls[0].values[1], userId);
  assert.equal(calls[0].values[3], 'ACINVCSZ');
}

{
  const { sql, calls } = fakeSql([[memoryRow]]);
  const items = await listMemoryItems({
    userId,
    nemo: 'ACINVCSZ',
    sqlFactory: () => sql,
  });

  assert.equal(items.length, 1);
  assert.match(calls[0].text, /where user_id =/i);
  assert.equal(calls[0].values[0], userId);
  assert.equal(calls[0].values[1], 'ACINVCSZ');
}

{
  const { sql, calls } = fakeSql([[memoryRow]]);
  const items = await loadRelevantMemory({
    userId,
    nemo: 'ACINVCSZ',
    conversationId,
    sqlFactory: () => sql,
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].scope, 'nemo');
  assert.equal(calls[0].values[0], userId);
  assert.equal(calls[0].values[1], 'ACINVCSZ');
  assert.equal(calls[0].values[2], conversationId);
}

{
  const { sql, calls } = fakeSql([[]]);
  await archiveMemoryItem({
    memoryId,
    userId,
    nemo: 'ACINVCSZ',
    sqlFactory: () => sql,
  });

  assert.match(calls[0].text, /set status =/i);
  assert.deepEqual(calls[0].values, ['archived', memoryId, userId, 'ACINVCSZ', 'ACINVCSZ']);
}

{
  const { sql, calls } = fakeSql([[]]);
  await deleteMemoryItem({
    memoryId,
    userId,
    nemo: 'ACINVCSZ',
    sqlFactory: () => sql,
  });

  assert.match(calls[0].text, /set status =/i);
  assert.deepEqual(calls[0].values, ['deleted', memoryId, userId, 'ACINVCSZ', 'ACINVCSZ']);
}

console.log('advisor memory store tests passed');
