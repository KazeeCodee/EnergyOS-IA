import assert from 'node:assert/strict';
import {
  authorizeNemo,
  normalizeNemo,
  readAuthorizedNemos,
} from './src/auth/nemoAuthorization.js';

assert.equal(normalizeNemo(' acinvcsz '), 'ACINVCSZ');
assert.deepEqual(readAuthorizedNemos(['acinvcsz', { nemo: 'otro0001' }, null]), ['ACINVCSZ', 'OTRO0001']);

const fakeClient = {
  auth: {
    async getUser(token: string) {
      if (token !== 'valid-token') return { data: { user: null }, error: new Error('bad token') };
      return { data: { user: { id: 'user-1' } }, error: null };
    },
  },
  async rpc(name: string) {
    assert.equal(name, 'current_user_nemos');
    return { data: ['ACINVCSZ', 'OTRO0001'], error: null };
  },
};

const ok = await authorizeNemo({
  token: 'valid-token',
  requestedNemo: 'acinvcsz',
  supabaseClient: fakeClient,
});

assert.equal(ok.ok, true);
assert.equal(ok.nemo, 'ACINVCSZ');
assert.equal(ok.userId, 'user-1');
assert.deepEqual(ok.authorizedNemos, ['ACINVCSZ', 'OTRO0001']);

const denied = await authorizeNemo({
  token: 'valid-token',
  requestedNemo: 'NOAUT001',
  supabaseClient: fakeClient,
});

assert.equal(denied.ok, false);
assert.equal(denied.status, 403);
assert.match(denied.error ?? '', /no autorizado/i);

const missing = await authorizeNemo({
  token: 'valid-token',
  requestedNemo: undefined,
  supabaseClient: {
    ...fakeClient,
    async rpc() {
      return { data: ['ACINVCSZ', 'OTRO0001'], error: null };
    },
  },
});

assert.equal(missing.ok, false);
assert.equal(missing.status, 400);

const singleDefault = await authorizeNemo({
  token: 'valid-token',
  requestedNemo: undefined,
  supabaseClient: {
    ...fakeClient,
    async rpc() {
      return { data: [{ nemo: 'acinvcsz' }], error: null };
    },
  },
});

assert.equal(singleDefault.ok, true);
assert.equal(singleDefault.nemo, 'ACINVCSZ');

console.log('nemo authorization tests passed');
