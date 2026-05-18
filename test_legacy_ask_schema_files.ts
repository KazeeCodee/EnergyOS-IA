import assert from 'node:assert/strict';
import { AskInputSchema } from './src/schemas/api.schema.js';

const parsed = AskInputSchema.parse({
  companyId: '11111111-1111-4111-8111-111111111111',
  companyName: 'Acindar Industria Argentina',
  nemo: 'ACINVCSZ',
  period: '2026-03',
  question: 'analiza este archivo',
  includePrivateContext: true,
  files: [
    {
      name: 'factura.pdf',
      type: 'application/pdf',
      content: 'ZmFrZS1jb250ZW50',
    },
  ],
});

assert.equal(parsed.files.length, 1);
assert.equal(parsed.files[0].name, 'factura.pdf');
assert.equal(parsed.files[0].type, 'application/pdf');

console.log('legacy ask schema file tests passed');
