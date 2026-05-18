import assert from 'node:assert/strict';
import { AdvisorSnapshotQuerySchema } from './src/schemas/advisor.schema.js';

const query = AdvisorSnapshotQuerySchema.parse({
  companyId: '11111111-1111-4111-8111-111111111111',
  companyName: 'Acindar Industria Argentina',
  nemo: 'acinvcsz',
  period: '2026-03',
  includePrivateContext: 'true',
});

assert.equal(query.nemo, 'ACINVCSZ');
assert.equal(query.includePrivateContext, true);

const defaulted = AdvisorSnapshotQuerySchema.parse({
  companyId: '11111111-1111-4111-8111-111111111111',
  nemo: 'ACINVCSZ',
});

assert.equal(defaulted.includePrivateContext, false);

console.log('advisor snapshot query tests passed');
