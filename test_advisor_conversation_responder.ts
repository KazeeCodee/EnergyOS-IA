import assert from 'node:assert/strict';
import {
  buildFallbackConversationResponse,
  containsAnalyticOutput,
  createAdvisorConversationResponder,
} from './src/advisor/conversationResponder.js';
import { understandAdvisorTurn } from './src/advisor/turnUnderstanding.js';

const input = {
  input: {
    companyId: '11111111-1111-4111-8111-111111111111',
    companyName: 'ACINDAR PTA. V. CONSTITUCION',
    nemo: 'ACINVCSZ',
    period: '2026-03',
    question: 'Cual es tu fuicnion ?',
    includePrivateContext: true,
    files: [],
  },
  intent: 'conversation' as const,
};

const fallback = buildFallbackConversationResponse(input);
assert.match(fallback, /Soy EnergyOS Advisor/i);
assert.match(fallback, /funcion/i);
assert.match(fallback, /costos|consumo|contratos|facturas/i);
assert.doesNotMatch(fallback, /64904\.06|MWh|ARS|Recomendacion|Hallazgos/i);

assert.equal(containsAnalyticOutput('Consumo Total: 64.904 MWh. Recomendacion: revisar MATER.'), true);
assert.equal(containsAnalyticOutput('Soy EnergyOS Advisor y puedo ayudarte cuando me pidas un analisis.'), false);

const guardedResponder = createAdvisorConversationResponder({
  provider: {
    name: 'fake',
    model: 'fake-model',
    async chat() {
      return {
        text: 'Resumen de rendimiento energetico: Demanda real 64904.06 MWh. Recomendacion: revisar cobertura MATER.',
        toolCalls: [],
        done: true,
        usage: { inputTokens: 10, outputTokens: 10 },
        stopReason: 'STOP',
      };
    },
  },
});

const guardedResponse = await guardedResponder({
  ...input,
  input: {
    ...input.input,
    question: 'Tengo una duda general sobre este chat',
  },
});
assert.match(guardedResponse, /Soy EnergyOS Advisor/i);
assert.doesNotMatch(guardedResponse, /64904\.06|MWh|Recomendacion|MATER/i);

let evasiveIdentityCalls = 0;
const evasiveIdentityResponder = createAdvisorConversationResponder({
  provider: {
    name: 'fake',
    model: 'fake-model',
    async chat() {
      evasiveIdentityCalls += 1;
      return {
        text: 'Estoy listo para ayudarte con ACINDAR PTA. V. CONSTITUCION. Decime que queres revisar.',
        toolCalls: [],
        done: true,
        usage: { inputTokens: 10, outputTokens: 10 },
        stopReason: 'STOP',
      };
    },
  },
});

const identityResponse = await evasiveIdentityResponder(input);
assert.match(identityResponse, /Soy EnergyOS Advisor/i);
assert.match(identityResponse, /funcion/i);
assert.equal(evasiveIdentityCalls, 0);

const naturalResponder = createAdvisorConversationResponder({
  provider: {
    name: 'fake',
    model: 'fake-model',
    async chat() {
      return {
        text: 'Soy EnergyOS Advisor. Te ayudo a entender datos energeticos y a convertir pedidos concretos en analisis claros.',
        toolCalls: [],
        done: true,
        usage: { inputTokens: 10, outputTokens: 10 },
        stopReason: 'STOP',
      };
    },
  },
});

const naturalResponse = await naturalResponder({
  ...input,
  input: {
    ...input.input,
    question: 'Tengo una duda general sobre como usar este chat',
  },
});
assert.match(naturalResponse, /Soy EnergyOS Advisor/i);
assert.match(naturalResponse, /datos energeticos/i);

const guidedQuestion = 'Como estas ? soy el director de esta empresa, tengo problemas con las finanzas energeticas y no se leer los datos. ayudame';
const guidedResponder = createAdvisorConversationResponder({
  provider: {
    name: 'fake',
    model: 'fake-model',
    async chat() {
      return {
        text: 'Bien, listo para ayudarte. Decime que queres revisar y voy directo al punto.',
        toolCalls: [],
        done: true,
        usage: { inputTokens: 10, outputTokens: 10 },
        stopReason: 'STOP',
      };
    },
  },
});

const guidedResponse = await guidedResponder({
  input: {
    ...input.input,
    question: guidedQuestion,
  },
  intent: 'conversation',
  understanding: understandAdvisorTurn({ question: guidedQuestion, files: [] }),
});

assert.match(guidedResponse, /te ayudo|costos|consumo|facturas/i);
assert.doesNotMatch(guidedResponse, /Decime que queres revisar y voy directo al punto/i);

for (const question of [
  'Si me vas a ayudar ?',
  'Pero quiero saber si realmente me vas a ayudar ? estas para mi atencion ?',
]) {
  const reassuranceResponse = buildFallbackConversationResponse({
    input: {
      ...input.input,
      question,
    },
    intent: 'conversation',
    understanding: understandAdvisorTurn({ question, files: [] }),
  });

  assert.match(reassuranceResponse, /^Si\b|^Claro\b/i);
  assert.match(reassuranceResponse, /te voy a ayudar|estoy para ayudarte|estoy aca/i);
  assert.match(reassuranceResponse, /ACINDAR PTA\. V\. CONSTITUCION \(ACINVCSZ\)/i);
  assert.doesNotMatch(reassuranceResponse, /Decime que queres entender o revisar|si hace falta analizar datos/i);
}

console.log('advisor conversation responder tests passed');
