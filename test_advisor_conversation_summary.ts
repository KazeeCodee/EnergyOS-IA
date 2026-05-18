import assert from 'node:assert/strict';
import {
  buildDeterministicConversationSummary,
  maybeUpdateConversationSummary,
  shouldSummarizeConversation,
} from './src/advisor/conversationSummary.js';
import type { AdvisorMessageOutput } from './src/schemas/advisor.schema.js';

const conversationId = '22222222-2222-4222-8222-222222222222';

function message(index: number, content: string, role: 'user' | 'assistant' = 'user'): AdvisorMessageOutput {
  return {
    id: `33333333-3333-4333-8333-${String(index).padStart(12, '0')}`,
    conversationId,
    role,
    content,
    intent: null,
    metadata: {},
    runId: null,
    createdAt: '2026-05-18T12:01:00.000Z',
  };
}

assert.equal(shouldSummarizeConversation({ messageCount: 10 }), false);
assert.equal(shouldSummarizeConversation({ messageCount: 21 }), true);

const summary = buildDeterministicConversationSummary({
  existingSummary: null,
  messages: [
    message(1, 'Prefiero reportes ejecutivos y concretos.'),
    message(2, 'Decidimos revisar el contrato MATER antes del cierre.'),
    message(3, 'Queda pendiente cargar la factura DTE de marzo.'),
    message(4, 'La demanda real fue 64904.06 MWh.', 'assistant'),
  ],
});

assert.match(summary, /Preferencias/i);
assert.match(summary, /Decisiones/i);
assert.match(summary, /Pendientes/i);
assert.match(summary, /no reemplaza los datos operativos/i);

let updatedSummary: string | null = null;
let writerCalls = 0;

await maybeUpdateConversationSummary({
  conversationId,
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  companyId: '11111111-1111-4111-8111-111111111111',
  nemo: 'ACINVCSZ',
  store: {
    async getConversationSummaryState() {
      return {
        messageCount: 10,
        currentSummary: null,
        messages: [message(1, 'Prefiero reportes ejecutivos.')],
      };
    },
    async updateConversationSummary() {
      throw new Error('No deberia actualizar bajo el umbral');
    },
  },
  writer: async () => {
    writerCalls += 1;
    return 'No deberia llamarse';
  },
});

assert.equal(writerCalls, 0);

await maybeUpdateConversationSummary({
  conversationId,
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  companyId: '11111111-1111-4111-8111-111111111111',
  nemo: 'ACINVCSZ',
  store: {
    async getConversationSummaryState() {
      return {
        messageCount: 24,
        currentSummary: null,
        messages: [message(1, 'Decidimos revisar cobertura spot.')],
      };
    },
    async updateConversationSummary(input) {
      updatedSummary = input.summary;
    },
  },
  writer: async (input) => {
    writerCalls += 1;
    assert.equal(input.messages.length, 1);
    return 'Resumen controlado con decisiones y pendientes. No reemplaza los datos operativos actuales.';
  },
});

assert.equal(writerCalls, 1);
assert.equal(updatedSummary, 'Resumen controlado con decisiones y pendientes. No reemplaza los datos operativos actuales.');

console.log('advisor conversation summary tests passed');
