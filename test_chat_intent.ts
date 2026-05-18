import assert from 'node:assert/strict';
import { buildAskTaskMessage, buildGreetingResponse, isSimpleGreeting } from './src/utils/chatIntent.js';

assert.equal(isSimpleGreeting('hola buenos dias'), true);
assert.equal(isSimpleGreeting('Buen dia'), true);
assert.equal(isSimpleGreeting('hola, como estas?'), true);
assert.equal(isSimpleGreeting('analiza el consumo de marzo'), false);
const greeting = buildGreetingResponse({
  companyName: 'Acindar Industria Argentina',
  nemo: 'ACINVCSZ',
  period: '2026-03',
});
assert.doesNotMatch(greeting, /cliente seleccionado|que cliente|EnergyOS/i);
assert.match(greeting, /Acindar Industria Argentina \(ACINVCSZ\)/i);
assert.match(greeting, /periodo 2026-03/i);

const task = buildAskTaskMessage({
  companyId: '11111111-1111-4111-8111-111111111111',
  companyName: 'Acindar Industria Argentina',
  nemo: 'ACINVCSZ',
  period: '2026-03',
  question: 'hola buenos dias',
  includePrivateContext: false,
});

assert.match(task, /Si la pregunta es solo un saludo/i);
assert.match(task, /Empresa autorizada: Acindar Industria Argentina/i);
assert.match(task, /Nunca le pidas al usuario que elija cliente/i);

console.log('chat intent tests passed');
