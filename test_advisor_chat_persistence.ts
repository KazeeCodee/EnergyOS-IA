import assert from 'node:assert/strict';
import type { AuthResult } from './src/api/auth.js';
import type { AdvisorRunOutput, ConversationContext } from './src/schemas/advisor.schema.js';

process.env.SUPABASE_URL ??= 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role';
process.env.RAILWAY_DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/db';

const { createAdvisorChatApi } = await import('./src/api/advisor-chat.js');

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const companyId = '11111111-1111-4111-8111-111111111111';
const conversationId = '22222222-2222-4222-8222-222222222222';
const userMessageId = '33333333-3333-4333-8333-333333333333';
const assistantMessageId = '44444444-4444-4444-8444-444444444444';

function okAuth(): AuthResult {
  return { ok: true, userId, nemo: 'ACINVCSZ', token: 'token' };
}

const calls: string[] = [];
let capturedContext: ConversationContext | undefined;

const app = createAdvisorChatApi({
  authorizeNemo: async (_c, requestedNemo) => {
    calls.push(`auth:${requestedNemo}`);
    return okAuth();
  },
  createRunStore: async () => ({
    async create() {
      calls.push('run:create');
      return 'run-1';
    },
    async complete() {
      calls.push('run:complete');
    },
    async fail() {
      calls.push('run:fail');
    },
  }),
  conversationStore: {
    async createConversation(input) {
      calls.push(`conversation:create:${input.userId}:${input.nemo}:${input.title}`);
      return {
        id: conversationId,
        companyId: input.companyId,
        nemo: input.nemo,
        title: input.title ?? 'Nueva conversacion',
        status: 'active',
        summary: null,
        lastMessageAt: '2026-05-18T12:00:00.000Z',
        createdAt: '2026-05-18T12:00:00.000Z',
        updatedAt: '2026-05-18T12:00:00.000Z',
      };
    },
    async getConversationForUser(input) {
      calls.push(`conversation:get:${input.conversationId}:${input.userId}:${input.companyId}:${input.nemo}`);
      return {
        id: input.conversationId,
        companyId: input.companyId,
        nemo: input.nemo,
        title: 'Existente',
        status: 'active',
        summary: null,
        lastMessageAt: '2026-05-18T12:00:00.000Z',
        createdAt: '2026-05-18T12:00:00.000Z',
        updatedAt: '2026-05-18T12:00:00.000Z',
      };
    },
    async appendMessage(input) {
      calls.push(`message:${input.role}:${input.conversationId}:${input.content}:${input.intent ?? ''}`);
      return {
        id: input.role === 'user' ? userMessageId : assistantMessageId,
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        intent: input.intent ?? null,
        metadata: input.metadata ?? {},
        runId: input.runId ?? null,
        createdAt: '2026-05-18T12:01:00.000Z',
      };
    },
    async loadConversationContext(input) {
      calls.push(`context:${input.conversationId}:${input.userId}:${input.companyId}:${input.nemo}`);
      return {
        conversationId: input.conversationId,
        summary: 'El usuario venia revisando costos.',
        recentMessages: [{
          id: userMessageId,
          conversationId: input.conversationId,
          role: 'user',
          content: 'resumime el ultimo mes',
          intent: null,
          metadata: {},
          runId: null,
          createdAt: '2026-05-18T12:01:00.000Z',
        }],
        memory: [{
          id: '55555555-5555-4555-8555-555555555555',
          scope: 'nemo',
          type: 'preference',
          content: 'Prefiere respuestas ejecutivas.',
          confidence: 'high',
        }],
      };
    },
  },
  runAdvisorChat: async (input, options): Promise<AdvisorRunOutput> => {
    calls.push(`advisor:${input.conversationId}:${input.question}`);
    capturedContext = options.conversationContext;
    return {
      response: 'Respuesta persistida.',
      intent: 'monthly_summary',
      companyId: input.companyId,
      companyName: input.companyName,
      nemo: input.nemo,
      period: input.period ?? null,
      conversationId: input.conversationId,
      metrics: {
        companyId: input.companyId,
        nemo: input.nemo,
        period: input.period ?? null,
        totalConsumptionMwh: null,
        contractedMwh: null,
        spotMwh: null,
        spotExposurePct: null,
        contractCoveragePct: null,
        spotCostPesos: null,
        invoiceTotalPesos: null,
        costDtePesosMwh: null,
        renewableYtdPct: null,
        renewableGapYtdMwh: null,
        estimatedRenewablePenaltyPesos: null,
        riskScore: null,
      },
      findings: [],
      recommendations: [],
      missingData: [],
      limitations: [],
      dataUsed: [],
      evidence: [],
      filesReceived: [],
      fileAnalyses: [],
      qa: { passed: true, issues: [] },
    };
  },
});

const createResponse = await app.request('/', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    companyId,
    companyName: 'Acindar Industria Argentina',
    nemo: 'ACINVCSZ',
    period: '2026-03',
    question: 'resumime el ultimo mes',
    includePrivateContext: true,
  }),
});

assert.equal(createResponse.status, 200);
const createBody = await createResponse.json() as AdvisorRunOutput;
assert.equal(createBody.conversationId, conversationId);
assert.equal(createBody.messageId, userMessageId);
assert.equal(createBody.assistantMessageId, assistantMessageId);
assert.equal(calls.includes(`conversation:create:${userId}:ACINVCSZ:resumime el ultimo mes`), true);
assert.equal(calls.includes(`message:user:${conversationId}:resumime el ultimo mes:`), true);
assert.equal(calls.includes(`advisor:${conversationId}:resumime el ultimo mes`), true);
assert.equal(calls.includes(`message:assistant:${conversationId}:Respuesta persistida.:monthly_summary`), true);
assert.equal(capturedContext?.conversationId, conversationId);
assert.equal(capturedContext?.summary, 'El usuario venia revisando costos.');

const existingResponse = await app.request('/', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    companyId,
    companyName: 'Acindar Industria Argentina',
    nemo: 'ACINVCSZ',
    period: '2026-03',
    question: 'gracias',
    conversationId,
    includePrivateContext: false,
  }),
});

assert.equal(existingResponse.status, 200);
assert.equal(calls.includes(`conversation:get:${conversationId}:${userId}:${companyId}:ACINVCSZ`), true);

const deniedApp = createAdvisorChatApi({
  authorizeNemo: async (c) => ({
    ok: false,
    response: c.json({ error: 'denied' }, 403),
  }),
});

const denied = await deniedApp.request('/', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    companyId,
    nemo: 'ACINVCSZ',
    question: 'hola',
  }),
});
assert.equal(denied.status, 403);

console.log('advisor chat persistence tests passed');
