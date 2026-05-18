import assert from 'node:assert/strict';
import {
  createNoopAdvisorRunStore,
  createSupabaseAdvisorRunStore,
} from './src/advisor/runStore.js';

const noop = createNoopAdvisorRunStore();
assert.equal(await noop.create({ companyId: 'c', period: '2026-03', nemo: 'ACINVCSZ', input: {} }), null);
await noop.complete({ runId: null, output: {} });
await noop.fail({ runId: null, error: 'ignored' });

const calls: string[] = [];
const fakeSupabase = {
  from(table: string) {
    calls.push(`from:${table}`);
    return {
      insert(payload: unknown) {
        calls.push(`insert:${JSON.stringify(payload)}`);
        return {
          select() {
            return {
              async single() {
                return { data: { id: 'run-1' }, error: null };
              },
            };
          },
        };
      },
      update(payload: unknown) {
        calls.push(`update:${JSON.stringify(payload)}`);
        return {
          async eq(column: string, value: string) {
            calls.push(`eq:${column}:${value}`);
            return { error: null };
          },
        };
      },
    };
  },
};

const store = createSupabaseAdvisorRunStore(fakeSupabase);
const runId = await store.create({
  companyId: '11111111-1111-4111-8111-111111111111',
  period: '2026-03',
  nemo: 'ACINVCSZ',
  input: { question: 'resumen' },
});

assert.equal(runId, 'run-1');
await store.complete({ runId, output: { response: 'ok' } });
await store.fail({ runId, error: 'boom' });
assert.equal(calls.includes('from:agent_runs'), true);
assert.equal(calls.some((call) => call.includes('"task_type":"advisor_chat"')), true);
assert.equal(calls.some((call) => call.includes('"status":"completed"')), true);
assert.equal(calls.some((call) => call.includes('"status":"failed"')), true);

console.log('advisor run store tests passed');
