import assert from 'node:assert/strict';
import { runAdvisorChat } from './src/advisor/orchestrator.js';
import type { EnergySnapshot } from './src/schemas/advisor.schema.js';

function makeSnapshot(): EnergySnapshot {
  return {
    companyId: '11111111-1111-4111-8111-111111111111',
    companyName: 'Acindar Industria Argentina',
    nemo: 'ACINVCSZ',
    requestedPeriod: '2026-03',
    resolvedPeriod: '2026-03',
    generatedAt: '2026-05-18T12:00:00.000Z',
    identity: {
      nemo: 'ACINVCSZ',
      description: 'Acindar Industria Argentina',
      tipoAgente: 'GUMA',
      agrupacion: null,
    },
    currentPeriod: {
      periodo: '2026-03',
      anio: 2026,
      mes: 3,
      demandaRealMwh: 64904.06,
      demandaContratadaMwh: 39156.266,
      compraSpotMwh: 25747.794,
      demandaRealPicoMwh: null,
      demandaRealValleMwh: null,
      demandaRealRestoMwh: null,
    },
    historicalConsumption: [],
    exposure: {
      periodo: '2026-03',
      pctSpot: 0.396705,
      pctMat: 0.603295,
      spotPesos: 1603954947,
      costoSpotPromedioPesosMwh: null,
      subContratoMwh: 25747.794,
      sobreContratoMwh: null,
      calidadDato: 'ok',
    },
    invoice: {
      periodo: '2026-03',
      facturaTotalPesos: 2864505674,
      costoDtePesosMwh: 44134.460525273766,
      energiaPesos: null,
      potenciaPesos: null,
      transportePesos: null,
      importeRevisablePesos: null,
      estadoAuditoria: 'ok',
      conceptosCount: 12,
    },
    invoiceConcepts: [],
    compliance: null,
    loadFactor: null,
    market: null,
    privateContext: null,
    availability: {
      identity: { available: true, rows: 1 },
      currentPeriod: { available: true, rows: 1 },
      historicalConsumption: { available: false, rows: 0 },
      exposure: { available: true, rows: 1 },
      invoice: { available: true, rows: 1 },
      compliance: { available: false, rows: 0 },
      loadFactor: { available: false, rows: 0 },
      market: { available: false, rows: 0 },
      privateContext: { available: false, rows: 0 },
    },
    dataUsed: [
      'public.vw_consumo_gu_mensual',
      'public.vw_exposicion_spot_mensual',
      'public.vw_factura_dte_resumen_mensual',
    ],
    missingData: [],
    evidence: [],
    warnings: [],
  };
}

const baseInput = {
  companyId: '11111111-1111-4111-8111-111111111111',
  companyName: 'Acindar Industria Argentina',
  nemo: 'ACINVCSZ',
  period: '2026-03',
  question: 'dame un resumen del ultimo mes',
  includePrivateContext: false,
  files: [],
};

const monthly = await runAdvisorChat(baseInput, {
  snapshotBuilder: async () => makeSnapshot(),
});

assert.equal(monthly.intent, 'monthly_summary');
assert.match(monthly.response, /Acindar Industria Argentina \(ACINVCSZ\)/);
assert.match(monthly.response, /64904\.06 MWh/);
assert.match(monthly.response, /ARS 2864505674/);
assert.equal(monthly.qa.passed, true);

let greetingSnapshotCalls = 0;
const greeting = await runAdvisorChat({
  ...baseInput,
  question: 'hola buenos dias',
  includePrivateContext: true,
}, {
  snapshotBuilder: async () => {
    greetingSnapshotCalls += 1;
    return makeSnapshot();
  },
  responseWriter: () => 'Resumen analitico indebido con 64904.06 MWh.',
});

assert.equal(greeting.intent, 'greeting');
assert.equal(greetingSnapshotCalls, 0);
assert.match(greeting.response, /Acindar Industria Argentina \(ACINVCSZ\)/);
assert.doesNotMatch(greeting.response, /64904\.06|Demanda real|Hallazgos|Acciones recomendadas/i);
assert.equal(greeting.findings.length, 0);
assert.equal(greeting.recommendations.length, 0);
assert.equal(greeting.dataUsed.length, 0);

let conversationSnapshotCalls = 0;
const capabilityQuestion = await runAdvisorChat({
  ...baseInput,
  question: 'que podes hacer?',
  includePrivateContext: true,
}, {
  snapshotBuilder: async () => {
    conversationSnapshotCalls += 1;
    return makeSnapshot();
  },
  responseWriter: () => 'Resumen analitico indebido con 64904.06 MWh.',
});

assert.equal(capabilityQuestion.intent, 'conversation');
assert.equal(conversationSnapshotCalls, 0);
assert.match(capabilityQuestion.response, /Soy EnergyOS Advisor/i);
assert.doesNotMatch(capabilityQuestion.response, /64904\.06|Demanda real|Hallazgos|Acciones recomendadas/i);
assert.equal(capabilityQuestion.findings.length, 0);
assert.equal(capabilityQuestion.recommendations.length, 0);
assert.equal(capabilityQuestion.dataUsed.length, 0);

let emphaticGreetingSnapshotCalls = 0;
const emphaticGreeting = await runAdvisorChat({
  ...baseInput,
  question: 'Holaaaa. como estas??????',
  includePrivateContext: true,
}, {
  snapshotBuilder: async () => {
    emphaticGreetingSnapshotCalls += 1;
    return makeSnapshot();
  },
  responseWriter: () => 'Resumen de rendimiento energetico: Demanda real 64904.06 MWh. Recomendacion: revisar cobertura MATER.',
});

assert.equal(emphaticGreeting.intent, 'conversation');
assert.equal(emphaticGreetingSnapshotCalls, 0);
assert.match(emphaticGreeting.response, /Hola|listo/i);
assert.doesNotMatch(
  emphaticGreeting.response,
  /64904\.06|Demanda real|Resumen de rendimiento|Recomendacion|spot|MATER/i,
);
assert.equal(emphaticGreeting.findings.length, 0);
assert.equal(emphaticGreeting.recommendations.length, 0);
assert.equal(emphaticGreeting.dataUsed.length, 0);

let readinessSnapshotCalls = 0;
const readinessQuestion = await runAdvisorChat({
  ...baseInput,
  question: 'Como estas ? listo para trabajr con estos daots energeticos ?',
  includePrivateContext: true,
}, {
  snapshotBuilder: async () => {
    readinessSnapshotCalls += 1;
    return makeSnapshot();
  },
  responseWriter: () => 'Hallazgos Principales: Demanda real 64904.06 MWh. Limitaciones de la Informacion: faltan contratos.',
});

assert.equal(readinessQuestion.intent, 'conversation');
assert.equal(readinessSnapshotCalls, 0);
assert.match(readinessQuestion.response, /listo/i);
assert.doesNotMatch(
  readinessQuestion.response,
  /64904\.06|Demanda real|Hallazgos|Recomendacion|Limitaciones de la Informacion/i,
);
assert.equal(readinessQuestion.findings.length, 0);
assert.equal(readinessQuestion.recommendations.length, 0);
assert.equal(readinessQuestion.dataUsed.length, 0);

const runStoreCalls: string[] = [];
await runAdvisorChat(baseInput, {
  snapshotBuilder: async () => makeSnapshot(),
  runStore: {
    async create(input) {
      runStoreCalls.push(`create:${input.nemo}:${input.period}`);
      return 'run-1';
    },
    async complete(input) {
      runStoreCalls.push(`complete:${input.runId}:${input.output.nemo}`);
    },
    async fail(input) {
      runStoreCalls.push(`fail:${input.runId}:${input.error}`);
    },
  },
});
assert.deepEqual(runStoreCalls, ['create:ACINVCSZ:2026-03', 'complete:run-1:ACINVCSZ']);

const withFile = await runAdvisorChat({
  ...baseInput,
  question: 'analiza este adjunto',
  files: [{ name: 'factura.pdf', type: 'application/pdf', content: 'ZmFrZQ==' }],
}, {
  snapshotBuilder: async () => makeSnapshot(),
});

assert.equal(withFile.intent, 'document_intake');
assert.equal(withFile.filesReceived.length, 1);
assert.equal(withFile.fileAnalyses.length, 1);
assert.equal(withFile.fileAnalyses[0].kind, 'pdf');
assert.equal(withFile.fileAnalyses[0].status, 'requires_ai_extraction');
assert.equal(withFile.findings.some((finding) => finding.type === 'file_received'), true);

const withAiFile = await runAdvisorChat({
  ...baseInput,
  question: 'analiza este pdf',
  files: [{ name: 'factura.pdf', type: 'application/pdf', content: 'ZmFrZQ==' }],
}, {
  snapshotBuilder: async () => makeSnapshot(),
  fileAiExtractor: async (file) => ({
    summary: `IA extrajo ${file.name}`,
    fields: { documentType: 'factura' },
    confidence: 'high',
  }),
});

assert.equal(withAiFile.fileAnalyses[0].status, 'extracted');
assert.equal(withAiFile.fileAnalyses[0].aiExtraction?.fields.documentType, 'factura');

const corrected = await runAdvisorChat(baseInput, {
  snapshotBuilder: async () => makeSnapshot(),
  responseWriter: () => 'No hay datos disponibles para el periodo 2026-03.',
});

assert.equal(corrected.qa.passed, false);
assert.match(corrected.response, /si hay datos operativos/);
assert.match(corrected.response, /64904\.06 MWh/);

console.log('advisor orchestrator tests passed');
