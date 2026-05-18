import assert from 'node:assert/strict';
import {
  AdvisorTaskApprovalSchema,
  createAdvisorTask,
} from './src/advisor/taskStore.js';

const approval = AdvisorTaskApprovalSchema.parse({
  nemo: 'acinvcsz',
  recommendationId: 'review_spot_coverage',
  title: 'Revisar cobertura contractual',
  reason: 'Spot alto',
  ownerEmail: 'energia@empresa.com',
  dueDate: '2026-05-31',
  relatedEntityType: 'recommendation',
});

assert.equal(approval.nemo, 'ACINVCSZ');

const queries: string[] = [];
const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
  queries.push(strings.join('?'));
  assert.equal(values[0], 'ACINVCSZ');
  assert.equal(values[1], 'Revisar cobertura contractual');
  return [{ id: 'task-1' }];
}) as any;
sql.end = async () => undefined;

const task = await createAdvisorTask({
  approval,
  createdByUserId: 'user-1',
  sqlFactory: () => sql,
});

assert.equal(task.id, 'task-1');
assert.equal(task.nemo, 'ACINVCSZ');
assert.equal(task.status, 'pendiente');
assert.equal(queries.length, 1);

console.log('advisor task store tests passed');
