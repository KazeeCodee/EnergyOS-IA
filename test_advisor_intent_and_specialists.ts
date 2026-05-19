import assert from 'node:assert/strict';
import { classifyAdvisorIntent } from './src/advisor/intentRouter.js';
import { runAdvisorSpecialists } from './src/advisor/specialists.js';
import { calculateAdvisorMetrics } from './src/advisor/metricsV2.js';
import type { EnergySnapshot } from './src/schemas/advisor.schema.js';

assert.equal(classifyAdvisorIntent({ question: 'hola buenos dias', files: [] }), 'greeting');
assert.equal(classifyAdvisorIntent({ question: 'gracias', files: [] }), 'conversation');
assert.equal(classifyAdvisorIntent({ question: 'que podes hacer?', files: [] }), 'conversation');
assert.equal(classifyAdvisorIntent({ question: 'ok', files: [] }), 'conversation');
assert.equal(classifyAdvisorIntent({ question: 'como estas?', files: [] }), 'conversation');
assert.equal(classifyAdvisorIntent({ question: 'Holaaaa. como estas??????', files: [] }), 'conversation');
assert.equal(classifyAdvisorIntent({ question: 'holaaaa!!!!', files: [] }), 'greeting');
assert.equal(classifyAdvisorIntent({ question: 'me ayudas?', files: [] }), 'conversation');
assert.equal(
  classifyAdvisorIntent({ question: 'Como estas ? listo para trabajr con estos daots energeticos ?', files: [] }),
  'conversation',
);
assert.equal(
  classifyAdvisorIntent({ question: 'estas listo para trabajar con estos datos energeticos?', files: [] }),
  'conversation',
);
assert.equal(classifyAdvisorIntent({ question: 'dame un resumen del ultimo mes', files: [] }), 'monthly_summary');
assert.equal(classifyAdvisorIntent({ question: 'revisa la factura dte', files: [] }), 'invoice');
assert.equal(classifyAdvisorIntent({ question: 'que contrato deberia revisar?', files: [] }), 'contract');
assert.equal(classifyAdvisorIntent({ question: 'hay riesgo por ley 27191?', files: [] }), 'compliance');
assert.equal(classifyAdvisorIntent({
  question: 'analiza este adjunto',
  files: [{ name: 'factura.pdf', type: 'application/pdf', content: 'ZmFrZQ==' }],
}), 'document_intake');

const snapshot: EnergySnapshot = {
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
  compliance: {
    periodo: '2026-03',
    pctRenovableReal: null,
    pctRenovableYtd: 0.18,
    cumpleMes: true,
    cumpleYtd: false,
    brechaMwh: 0,
    brechaYtdMwh: 1200,
    multaEstimadaPesos: 5000000,
    calidadDato: 'ok',
  },
  loadFactor: null,
  market: null,
  privateContext: null,
  availability: {
    identity: { available: true, rows: 1 },
    currentPeriod: { available: true, rows: 1 },
    historicalConsumption: { available: false, rows: 0 },
    exposure: { available: true, rows: 1 },
    invoice: { available: true, rows: 1 },
    compliance: { available: true, rows: 1 },
    loadFactor: { available: false, rows: 0 },
    market: { available: false, rows: 0 },
    privateContext: { available: false, rows: 0 },
  },
  dataUsed: [],
  missingData: [],
  evidence: [
    {
      source: 'public.vw_consumo_gu_mensual',
      label: 'Consumo 2026-03',
      period: '2026-03',
      fields: ['demanda_real_mwh'],
    },
  ],
  warnings: [],
};

const metrics = calculateAdvisorMetrics(snapshot);
const summary = runAdvisorSpecialists({
  intent: 'monthly_summary',
  snapshot,
  metrics,
  files: [],
});

assert.equal(summary.findings.some((finding) => finding.type === 'spot_exposure'), true);
assert.equal(summary.findings.some((finding) => finding.type === 'invoice_cost'), true);
assert.equal(summary.findings.some((finding) => finding.type === 'renewable_compliance_gap'), true);
assert.equal(summary.recommendations.some((rec) => rec.id === 'review_spot_coverage'), true);
assert.equal(summary.missingData.includes('historial energetico para tendencia'), true);

const fileSummary = runAdvisorSpecialists({
  intent: 'document_intake',
  snapshot,
  metrics,
  files: [{ name: 'factura.pdf', type: 'application/pdf', content: 'ZmFrZQ==' }],
});

assert.equal(fileSummary.findings.some((finding) => finding.type === 'file_received'), true);
assert.equal(fileSummary.recommendations.some((rec) => rec.id === 'process_attached_files'), true);

console.log('advisor intent and specialists tests passed');
