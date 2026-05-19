import assert from 'node:assert/strict';
import {
  buildAdvisorWriterMessages,
  createAdvisorLlmResponseWriter,
} from './src/advisor/responseWriter.js';
import type { AdvisorResponseWriterInput } from './src/advisor/orchestrator.js';

const input = {
  input: {
    companyId: '11111111-1111-4111-8111-111111111111',
    companyName: 'Acindar Industria Argentina',
    nemo: 'ACINVCSZ',
    period: '2026-03',
    question: 'resumen',
    includePrivateContext: false,
    files: [],
  },
  intent: 'monthly_summary',
  snapshot: {
    companyId: '11111111-1111-4111-8111-111111111111',
    companyName: 'Acindar Industria Argentina',
    nemo: 'ACINVCSZ',
    requestedPeriod: '2026-03',
    resolvedPeriod: '2026-03',
    generatedAt: '2026-05-18T12:00:00.000Z',
    identity: null,
    currentPeriod: null,
    historicalConsumption: [],
    exposure: null,
    invoice: null,
    invoiceConcepts: [],
    compliance: null,
    loadFactor: null,
    market: null,
    privateContext: null,
    availability: {
      identity: { available: false, rows: 0 },
      currentPeriod: { available: true, rows: 1 },
      historicalConsumption: { available: false, rows: 0 },
      exposure: { available: true, rows: 1 },
      invoice: { available: true, rows: 1 },
      compliance: { available: false, rows: 0 },
      loadFactor: { available: false, rows: 0 },
      market: { available: false, rows: 0 },
      privateContext: { available: false, rows: 0 },
    },
    dataUsed: ['public.vw_consumo_gu_mensual'],
    missingData: [],
    evidence: [],
    warnings: [],
  },
  metrics: {
    companyId: '11111111-1111-4111-8111-111111111111',
    nemo: 'ACINVCSZ',
    period: '2026-03',
    totalConsumptionMwh: 64904.06,
    contractedMwh: 39156.266,
    spotMwh: 25747.794,
    spotExposurePct: 0.396705,
    contractCoveragePct: 0.603295,
    spotCostPesos: 1603954947,
    invoiceTotalPesos: 2864505674,
    costDtePesosMwh: 44134.46,
    renewableYtdPct: null,
    renewableGapYtdMwh: null,
    estimatedRenewablePenaltyPesos: null,
    riskScore: 20,
  },
  specialistOutput: {
    findings: [],
    recommendations: [],
    missingData: [],
    limitations: [],
    evidence: [],
  },
} satisfies AdvisorResponseWriterInput;

const messages = buildAdvisorWriterMessages(input);
assert.match(messages.system, /No inventes/i);
assert.match(messages.system, /No uses encabezados como "Limitaciones de la informacion"/i);
assert.match(messages.system, /donde completarla/i);
assert.match(messages.user, /ACINVCSZ/);
assert.match(messages.user, /64904\.06/);
assert.match(messages.user, /2864505674/);

const guidedInput = {
  ...input,
  input: {
    ...input.input,
    question: 'Como estas? soy el director, tengo problemas con las finanzas energeticas y no se leer los datos. ayudame',
  },
  intent: 'guided_diagnosis',
  understanding: {
    socialOpener: true,
    primaryAct: 'guided_help',
    domainIntent: 'guided_diagnosis',
    responseMode: 'guided_onboarding',
    shouldRunAnalysis: true,
    userRole: 'director',
    dataLiteracyNeed: true,
    businessPain: true,
  },
} satisfies AdvisorResponseWriterInput;

const guidedMessages = buildAdvisorWriterMessages(guidedInput);
assert.match(guidedMessages.system, /terminos de negocio/i);
assert.match(guidedMessages.system, /no de tabla tecnica/i);
assert.match(guidedMessages.system, /te ayudo|empecemos|vamos a ordenar/i);
assert.doesNotMatch(guidedMessages.system, /volcar un reporte tecnico/i);
assert.match(guidedMessages.user, /guided_onboarding/);
assert.match(guidedMessages.user, /dataLiteracyNeed/);

const providerCalls: string[] = [];
const writer = createAdvisorLlmResponseWriter({
  provider: {
    name: 'fake',
    model: 'fake-model',
    async chat(system, providerMessages, tools) {
      providerCalls.push(system);
      assert.equal(tools.length, 0);
      assert.match(providerMessages[0].content, /ACINVCSZ/);
      return {
        text: 'Resumen redactado por IA con datos reales.',
        toolCalls: [],
        done: true,
        usage: { inputTokens: 10, outputTokens: 5 },
        stopReason: 'STOP',
      };
    },
  },
});

const response = await writer(input);
assert.equal(response, 'Resumen redactado por IA con datos reales.');
assert.equal(providerCalls.length, 1);

console.log('advisor response writer tests passed');
