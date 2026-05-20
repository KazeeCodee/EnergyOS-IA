import assert from 'node:assert/strict';
import { resolveAdvisorTurn } from './src/advisor/turnDirector.js';

const baseInput = {
  companyId: '11111111-1111-4111-8111-111111111111',
  companyName: 'ACINDAR PTA. V. CONSTITUCION',
  nemo: 'ACINVCSZ',
  period: '2026-03',
  question: 'Necesito saber si estas conmigo antes de mirar numeros',
  includePrivateContext: true,
  files: [],
};

const reassurance = await resolveAdvisorTurn({
  input: baseInput,
  provider: {
    name: 'fake',
    model: 'fake-model',
    async chat() {
      return {
        text: JSON.stringify({
          primaryAct: 'reassurance',
          domainIntent: null,
          shouldRunAnalysis: false,
          responseMode: 'brief_conversation',
          confidence: 'high',
          reason: 'El usuario pide confianza, no analisis.',
        }),
        toolCalls: [],
        done: true,
        usage: { inputTokens: 1, outputTokens: 1 },
        stopReason: 'STOP',
      };
    },
  },
});

assert.equal(reassurance.routerSource, 'llm');
assert.equal(reassurance.intent, 'conversation');
assert.equal(reassurance.understanding.primaryAct, 'reassurance');
assert.equal(reassurance.understanding.shouldRunAnalysis, false);

const analytic = await resolveAdvisorTurn({
  input: {
    ...baseInput,
    question: 'Ayudame a entender por que mi costo energetico viene mal',
  },
  provider: {
    name: 'fake',
    model: 'fake-model',
    async chat() {
      return {
        text: JSON.stringify({
          primaryAct: 'guided_help',
          domainIntent: 'guided_diagnosis',
          shouldRunAnalysis: true,
          responseMode: 'guided_onboarding',
          confidence: 'high',
          reason: 'El usuario pide ayuda para entender un problema energetico.',
        }),
        toolCalls: [],
        done: true,
        usage: { inputTokens: 1, outputTokens: 1 },
        stopReason: 'STOP',
      };
    },
  },
});

assert.equal(analytic.routerSource, 'llm');
assert.equal(analytic.intent, 'guided_diagnosis');
assert.equal(analytic.understanding.primaryAct, 'guided_help');
assert.equal(analytic.understanding.responseMode, 'guided_onboarding');
assert.equal(analytic.understanding.shouldRunAnalysis, true);

const fallback = await resolveAdvisorTurn({
  input: {
    ...baseInput,
    question: 'Holaaaa. como estas??????',
  },
  provider: {
    name: 'fake',
    model: 'fake-model',
    async chat() {
      throw new Error('provider down');
    },
  },
});

assert.equal(fallback.routerSource, 'deterministic');
assert.equal(fallback.intent, 'conversation');

console.log('advisor turn director tests passed');
