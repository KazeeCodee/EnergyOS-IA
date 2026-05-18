import assert from 'node:assert/strict';
import {
  AdvisorChatInputSchema,
  AdvisorConversationCreateInputSchema,
  AdvisorConversationListQuerySchema,
  AdvisorConversationOutputSchema,
  AdvisorMessageOutputSchema,
  ConversationContextSchema,
} from './src/schemas/advisor.schema.js';

const companyId = '11111111-1111-4111-8111-111111111111';
const conversationId = '22222222-2222-4222-8222-222222222222';

const createInput = AdvisorConversationCreateInputSchema.parse({
  companyId,
  companyName: 'Acindar Industria Argentina',
  nemo: 'acinvcsz',
  title: 'Revisar marzo',
});

assert.equal(createInput.nemo, 'ACINVCSZ');
assert.equal(createInput.title, 'Revisar marzo');

const listQuery = AdvisorConversationListQuerySchema.parse({
  nemo: ' acinvcsz ',
});

assert.equal(listQuery.nemo, 'ACINVCSZ');

const conversation = AdvisorConversationOutputSchema.parse({
  id: conversationId,
  companyId,
  nemo: 'ACINVCSZ',
  title: 'Revisar marzo',
  status: 'active',
  summary: null,
  lastMessageAt: '2026-05-18T12:00:00.000Z',
  createdAt: '2026-05-18T12:00:00.000Z',
  updatedAt: '2026-05-18T12:00:00.000Z',
});

assert.equal(conversation.id, conversationId);

const message = AdvisorMessageOutputSchema.parse({
  id: '33333333-3333-4333-8333-333333333333',
  conversationId,
  role: 'user',
  content: 'resumime el ultimo mes',
  intent: 'monthly_summary',
  metadata: { source: 'test' },
  createdAt: '2026-05-18T12:01:00.000Z',
});

assert.equal(message.conversationId, conversationId);
assert.equal(message.role, 'user');

const context = ConversationContextSchema.parse({
  conversationId,
  summary: 'El usuario esta revisando marzo.',
  recentMessages: [message],
  memory: [{
    id: '44444444-4444-4444-8444-444444444444',
    scope: 'nemo',
    type: 'preference',
    content: 'Prefiere reportes ejecutivos.',
    confidence: 'high',
  }],
});

assert.equal(context.recentMessages.length, 1);
assert.equal(context.memory[0].scope, 'nemo');

const chat = AdvisorChatInputSchema.parse({
  companyId,
  companyName: 'Acindar Industria Argentina',
  nemo: 'ACINVCSZ',
  period: '2026-03',
  question: 'hola',
  conversationId,
});

assert.equal(chat.conversationId, conversationId);

console.log('advisor conversation schema tests passed');
