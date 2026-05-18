import assert from 'node:assert/strict';
import type { AuthResult } from './src/api/auth.js';
import type {
  AdvisorConversationOutput,
  AdvisorMessageOutput,
  ConversationContext,
} from './src/schemas/advisor.schema.js';

process.env.SUPABASE_URL ??= 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role';
process.env.RAILWAY_DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/db';

const { createAdvisorConversationsApi } = await import('./src/api/advisor-conversations.js');

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const companyId = '11111111-1111-4111-8111-111111111111';
const conversationId = '22222222-2222-4222-8222-222222222222';
const messageId = '33333333-3333-4333-8333-333333333333';

const conversation: AdvisorConversationOutput = {
  id: conversationId,
  companyId,
  nemo: 'ACINVCSZ',
  title: 'Revisar marzo',
  status: 'active',
  summary: null,
  lastMessageAt: '2026-05-18T12:00:00.000Z',
  createdAt: '2026-05-18T12:00:00.000Z',
  updatedAt: '2026-05-18T12:00:00.000Z',
};

const message: AdvisorMessageOutput = {
  id: messageId,
  conversationId,
  role: 'user',
  content: 'resumime el ultimo mes',
  intent: 'monthly_summary',
  metadata: {},
  runId: null,
  createdAt: '2026-05-18T12:01:00.000Z',
};

function okAuth(): AuthResult {
  return { ok: true, userId, nemo: 'ACINVCSZ', token: 'token' };
}

const calls: string[] = [];
const app = createAdvisorConversationsApi({
  authorizeNemo: async (_c, requestedNemo) => {
    calls.push(`auth:${requestedNemo}`);
    return okAuth();
  },
  store: {
    async createConversation(input) {
      calls.push(`create:${input.userId}:${input.nemo}:${input.title}`);
      return conversation;
    },
    async listConversations(input) {
      calls.push(`list:${input.userId}:${input.nemo}`);
      return [conversation];
    },
    async getConversationForUser(input) {
      calls.push(`get:${input.conversationId}:${input.userId}:${input.companyId}:${input.nemo}`);
      return input.nemo === 'ACINVCSZ' ? conversation : null;
    },
    async loadConversationContext(input): Promise<ConversationContext> {
      calls.push(`context:${input.conversationId}:${input.userId}:${input.companyId}:${input.nemo}`);
      return {
        conversationId: input.conversationId,
        summary: null,
        recentMessages: [message],
        memory: [],
      };
    },
    async updateConversation(input) {
      calls.push(`update:${input.conversationId}:${input.title ?? ''}:${input.status ?? ''}`);
    },
    async softDeleteConversation(input) {
      calls.push(`delete:${input.conversationId}:${input.userId}:${input.companyId}:${input.nemo}`);
    },
  },
});

const createResponse = await app.request('/', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    companyId,
    nemo: 'acinvcsz',
    title: 'Revisar marzo',
  }),
});

assert.equal(createResponse.status, 200);
assert.deepEqual(await createResponse.json(), { conversation });
assert.equal(calls.includes('auth:ACINVCSZ'), true);
assert.equal(calls.includes(`create:${userId}:ACINVCSZ:Revisar marzo`), true);

const listResponse = await app.request('/?nemo=ACINVCSZ');
assert.equal(listResponse.status, 200);
assert.deepEqual(await listResponse.json(), { conversations: [conversation] });
assert.equal(calls.includes(`list:${userId}:ACINVCSZ`), true);

const messagesResponse = await app.request(`/${conversationId}/messages?companyId=${companyId}&nemo=ACINVCSZ`);
assert.equal(messagesResponse.status, 200);
assert.deepEqual(await messagesResponse.json(), {
  conversation,
  messages: [message],
  summary: null,
});
assert.equal(calls.includes(`context:${conversationId}:${userId}:${companyId}:ACINVCSZ`), true);

const patchResponse = await app.request(`/${conversationId}`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    companyId,
    nemo: 'ACINVCSZ',
    title: 'Nuevo titulo',
  }),
});
assert.equal(patchResponse.status, 200);
assert.equal(calls.includes(`update:${conversationId}:Nuevo titulo:`), true);

const deleteResponse = await app.request(`/${conversationId}?companyId=${companyId}&nemo=ACINVCSZ`, {
  method: 'DELETE',
});
assert.equal(deleteResponse.status, 200);
assert.equal(calls.includes(`delete:${conversationId}:${userId}:${companyId}:ACINVCSZ`), true);

const deniedApp = createAdvisorConversationsApi({
  authorizeNemo: async (c) => ({
    ok: false,
    response: c.json({ error: 'denied' }, 403),
  }),
});

const deniedResponse = await deniedApp.request('/?nemo=ACINVCSZ');
assert.equal(deniedResponse.status, 403);

console.log('advisor conversations api tests passed');
