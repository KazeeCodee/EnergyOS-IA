import assert from 'node:assert/strict';
import {
  appendMessage,
  createConversation,
  getConversationForUser,
  listConversations,
  loadConversationContext,
  softDeleteConversation,
  type ConversationSql,
} from './src/advisor/conversationStore.js';

type SqlCall = {
  text: string;
  values: unknown[];
};

function fakeSql(responses: unknown[][]) {
  const calls: SqlCall[] = [];
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join('?'), values });
    return responses.shift() ?? [];
  }) as ConversationSql;

  sql.end = async () => undefined;
  return { sql, calls };
}

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const companyId = '11111111-1111-4111-8111-111111111111';
const conversationId = '22222222-2222-4222-8222-222222222222';
const messageId = '33333333-3333-4333-8333-333333333333';

const conversationRow = {
  id: conversationId,
  company_id: companyId,
  nemo: 'ACINVCSZ',
  title: 'Revisar marzo',
  status: 'active',
  summary: null,
  last_message_at: '2026-05-18T12:00:00.000Z',
  created_at: '2026-05-18T12:00:00.000Z',
  updated_at: '2026-05-18T12:00:00.000Z',
};

{
  const { sql, calls } = fakeSql([[conversationRow]]);
  const conversation = await createConversation({
    userId,
    companyId,
    nemo: 'acinvcsz',
    title: 'Revisar marzo',
    sqlFactory: () => sql,
  });

  assert.equal(conversation.id, conversationId);
  assert.equal(conversation.nemo, 'ACINVCSZ');
  assert.match(calls[0].text, /insert into public\.advisor_conversations/i);
  assert.deepEqual(calls[0].values.slice(0, 4), [userId, companyId, 'ACINVCSZ', 'Revisar marzo']);
}

{
  const { sql, calls } = fakeSql([[conversationRow]]);
  const conversations = await listConversations({
    userId,
    nemo: 'acinvcsz',
    sqlFactory: () => sql,
  });

  assert.equal(conversations.length, 1);
  assert.match(calls[0].text, /where user_id =/i);
  assert.equal(calls[0].values[0], userId);
  assert.equal(calls[0].values[1], 'ACINVCSZ');
}

{
  const { sql, calls } = fakeSql([[]]);
  const conversation = await getConversationForUser({
    conversationId,
    userId,
    companyId,
    nemo: 'OTRO0001',
    sqlFactory: () => sql,
  });

  assert.equal(conversation, null);
  assert.equal(calls[0].values[0], conversationId);
  assert.equal(calls[0].values[1], userId);
  assert.equal(calls[0].values[2], companyId);
  assert.equal(calls[0].values[3], 'OTRO0001');
}

{
  const messageRow = {
    id: messageId,
    conversation_id: conversationId,
    role: 'user',
    content: 'resumime el ultimo mes',
    intent: 'monthly_summary',
    metadata: { source: 'test' },
    run_id: null,
    created_at: '2026-05-18T12:01:00.000Z',
  };
  const { sql, calls } = fakeSql([[messageRow], []]);
  const message = await appendMessage({
    conversationId,
    userId,
    companyId,
    nemo: 'ACINVCSZ',
    role: 'user',
    content: 'resumime el ultimo mes',
    intent: 'monthly_summary',
    metadata: { source: 'test' },
    sqlFactory: () => sql,
  });

  assert.equal(message.id, messageId);
  assert.equal(message.conversationId, conversationId);
  assert.match(calls[0].text, /insert into public\.advisor_messages/i);
  assert.equal(calls[0].values[0], conversationId);
  assert.match(calls[1].text, /update public\.advisor_conversations/i);
}

{
  const messageRow = {
    id: messageId,
    conversation_id: conversationId,
    role: 'user',
    content: 'resumime el ultimo mes',
    intent: 'monthly_summary',
    metadata: {},
    run_id: null,
    created_at: '2026-05-18T12:01:00.000Z',
  };
  const memoryRow = {
    id: '44444444-4444-4444-8444-444444444444',
    scope: 'nemo',
    type: 'preference',
    content: 'Prefiere reportes ejecutivos.',
    confidence: 'high',
  };
  const { sql, calls } = fakeSql([[conversationRow], [messageRow], [memoryRow]]);
  const context = await loadConversationContext({
    conversationId,
    userId,
    companyId,
    nemo: 'ACINVCSZ',
    limit: 12,
    sqlFactory: () => sql,
  });

  assert.equal(context.conversationId, conversationId);
  assert.equal(context.recentMessages.length, 1);
  assert.equal(context.memory.length, 1);
  assert.equal(calls[1].values[0], conversationId);
  assert.equal(calls[2].values[0], userId);
  assert.equal(calls[2].values[1], 'ACINVCSZ');
}

{
  const { sql, calls } = fakeSql([[]]);
  await softDeleteConversation({
    conversationId,
    userId,
    companyId,
    nemo: 'ACINVCSZ',
    sqlFactory: () => sql,
  });

  assert.match(calls[0].text, /status = 'deleted'/i);
  assert.deepEqual(calls[0].values, [conversationId, userId, companyId, 'ACINVCSZ']);
}

console.log('advisor conversation store tests passed');
