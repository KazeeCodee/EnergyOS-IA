import assert from 'node:assert/strict';
import { extractMemoryCandidates } from './src/advisor/memoryExtractor.js';

const base = {
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  companyId: '11111111-1111-4111-8111-111111111111',
  nemo: 'ACINVCSZ',
  conversationId: '22222222-2222-4222-8222-222222222222',
  sourceMessageId: '33333333-3333-4333-8333-333333333333',
};

assert.deepEqual(extractMemoryCandidates({
  ...base,
  role: 'user',
  content: 'hola buen dia',
}), []);

assert.deepEqual(extractMemoryCandidates({
  ...base,
  role: 'assistant',
  content: 'Prefiero reportes ejecutivos.',
}), []);

const preference = extractMemoryCandidates({
  ...base,
  role: 'user',
  content: 'Prefiero reportes ejecutivos y concretos.',
});

assert.equal(preference.length, 1);
assert.equal(preference[0].type, 'preference');
assert.equal(preference[0].scope, 'nemo');
assert.match(preference[0].content, /reportes ejecutivos/i);

const decision = extractMemoryCandidates({
  ...base,
  role: 'user',
  content: 'Decidimos revisar el contrato MATER antes del cierre.',
});

assert.equal(decision[0].type, 'decision');
assert.equal(decision[0].scope, 'conversation');

const pending = extractMemoryCandidates({
  ...base,
  role: 'user',
  content: 'Queda pendiente cargar la factura DTE de marzo.',
});

assert.equal(pending[0].type, 'open_issue');

const fact = extractMemoryCandidates({
  ...base,
  role: 'user',
  content: 'Confirmo que la factura de marzo esta observada.',
});

assert.equal(fact[0].type, 'confirmed_fact');
assert.equal(fact[0].confidence, 'high');

const directorHelp = extractMemoryCandidates({
  ...base,
  role: 'user',
  content: 'Como estas ? mira yo soy el director de esta empresa y pague por este sistema. se que tengo problemas con las finanzas energeticas pero no se leer los datos. ayudame',
});

assert.equal(directorHelp.length, 3);
assert.equal(directorHelp.some((candidate) =>
  candidate.type === 'preference'
  && candidate.scope === 'user'
  && /explicaciones simples|lenguaje de negocio/i.test(candidate.content)
), true);
assert.equal(directorHelp.some((candidate) =>
  candidate.type === 'task_context'
  && candidate.scope === 'user'
  && /director|decisor/i.test(candidate.content)
), true);
assert.equal(directorHelp.some((candidate) =>
  candidate.type === 'open_issue'
  && candidate.scope === 'conversation'
  && /finanzas energeticas|leer los datos|problemas/i.test(candidate.content)
), true);

console.log('advisor memory extractor tests passed');
