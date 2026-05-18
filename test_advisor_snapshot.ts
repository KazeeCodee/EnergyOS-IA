import assert from 'node:assert/strict';
import {
  AdvisorChatInputSchema,
  AdvisorFileSchema,
  EnergySnapshotSchema,
} from './src/schemas/advisor.schema.js';

const file = AdvisorFileSchema.parse({
  name: 'factura-marzo.pdf',
  type: 'application/pdf',
  content: 'ZmFrZS1wZGY=',
});

assert.equal(file.name, 'factura-marzo.pdf');
assert.equal(file.type, 'application/pdf');

const chatInput = AdvisorChatInputSchema.parse({
  companyId: '11111111-1111-4111-8111-111111111111',
  companyName: 'Acindar Industria Argentina',
  nemo: 'ACINVCSZ',
  period: '2026-03',
  question: 'resumen del ultimo mes',
  includePrivateContext: true,
  conversationId: 'thread-1',
  files: [file],
});

assert.equal(chatInput.files.length, 1);
assert.equal(chatInput.nemo, 'ACINVCSZ');

const snapshot = EnergySnapshotSchema.parse({
  companyId: chatInput.companyId,
  companyName: chatInput.companyName,
  nemo: chatInput.nemo,
  requestedPeriod: chatInput.period,
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
    conceptosCount: 0,
  },
  invoiceConcepts: [],
  compliance: {
    periodo: '2026-03',
    pctRenovableReal: null,
    pctRenovableYtd: 0.2,
    cumpleMes: true,
    cumpleYtd: true,
    brechaMwh: 0,
    brechaYtdMwh: 0,
    multaEstimadaPesos: 0,
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
  dataUsed: [
    'public.vw_consumo_gu_mensual',
    'public.vw_exposicion_spot_mensual',
    'public.vw_factura_dte_resumen_mensual',
    'public.vw_compliance_27191_mensual',
  ],
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
});

assert.equal(snapshot.availability.currentPeriod.available, true);
assert.equal(snapshot.availability.invoice.available, true);
assert.equal(snapshot.currentPeriod?.demandaRealMwh, 64904.06);

console.log('advisor snapshot schema tests passed');
