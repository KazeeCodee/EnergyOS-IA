import assert from 'node:assert/strict';
import type { AuthResult } from './src/api/auth.js';
import type { AdvisorMemoryItem } from './src/advisor/memoryStore.js';

process.env.SUPABASE_URL ??= 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role';
process.env.RAILWAY_DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/db';

const { createAdvisorMemoryApi } = await import('./src/api/advisor-memory.js');

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const memoryId = '44444444-4444-4444-8444-444444444444';

function okAuth(): AuthResult {
  return { ok: true, userId, nemo: 'ACINVCSZ', token: 'token' };
}

const memoryItem: AdvisorMemoryItem = {
  id: memoryId,
  scope: 'nemo',
  userId,
  companyId: '11111111-1111-4111-8111-111111111111',
  nemo: 'ACINVCSZ',
  conversationId: null,
  type: 'preference',
  content: 'Prefiere reportes ejecutivos.',
  confidence: 'high',
  sourceMessageId: null,
  evidence: {},
  status: 'active',
  createdAt: '2026-05-18T12:00:00.000Z',
  updatedAt: '2026-05-18T12:00:00.000Z',
};

const calls: string[] = [];
const app = createAdvisorMemoryApi({
  authorizeNemo: async (_c, requestedNemo) => {
    calls.push(`auth:${requestedNemo}`);
    return okAuth();
  },
  store: {
    async listMemoryItems(input) {
      calls.push(`list:${input.userId}:${input.nemo}`);
      return [memoryItem];
    },
    async archiveMemoryItem(input) {
      calls.push(`archive:${input.memoryId}:${input.userId}:${input.nemo}`);
    },
    async deleteMemoryItem(input) {
      calls.push(`delete:${input.memoryId}:${input.userId}:${input.nemo}`);
    },
  },
});

const listResponse = await app.request('/?nemo=ACINVCSZ');
assert.equal(listResponse.status, 200);
assert.deepEqual(await listResponse.json(), { memory: [memoryItem] });
assert.equal(calls.includes(`list:${userId}:ACINVCSZ`), true);

const archiveResponse = await app.request(`/${memoryId}`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ nemo: 'ACINVCSZ', status: 'archived' }),
});
assert.equal(archiveResponse.status, 200);
assert.equal(calls.includes(`archive:${memoryId}:${userId}:ACINVCSZ`), true);

const deleteResponse = await app.request(`/${memoryId}?nemo=ACINVCSZ`, { method: 'DELETE' });
assert.equal(deleteResponse.status, 200);
assert.equal(calls.includes(`delete:${memoryId}:${userId}:ACINVCSZ`), true);

const deniedApp = createAdvisorMemoryApi({
  authorizeNemo: async (c) => ({
    ok: false,
    response: c.json({ error: 'denied' }, 403),
  }),
});

const denied = await deniedApp.request('/?nemo=ACINVCSZ');
assert.equal(denied.status, 403);

console.log('advisor memory api tests passed');
