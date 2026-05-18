import assert from 'node:assert/strict';
import { calculateAdvisorMetrics } from './src/advisor/metricsV2.js';
import type { EnergySnapshot } from './src/schemas/advisor.schema.js';

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
  dataUsed: [],
  missingData: [],
  evidence: [],
  warnings: [],
};

const metrics = calculateAdvisorMetrics(snapshot);

assert.equal(metrics.companyId, snapshot.companyId);
assert.equal(metrics.nemo, 'ACINVCSZ');
assert.equal(metrics.period, '2026-03');
assert.equal(metrics.totalConsumptionMwh, 64904.06);
assert.equal(metrics.contractedMwh, 39156.266);
assert.equal(metrics.spotMwh, 25747.794);
assert.equal(metrics.spotExposurePct, 0.396705);
assert.equal(metrics.contractCoveragePct, 0.603295);
assert.equal(metrics.spotCostPesos, 1603954947);
assert.equal(metrics.invoiceTotalPesos, 2864505674);
assert.equal(metrics.costDtePesosMwh, 44134.460525273766);
assert.equal(metrics.renewableYtdPct, 0.2);
assert.equal(metrics.renewableGapYtdMwh, 0);
assert.equal(metrics.estimatedRenewablePenaltyPesos, 0);
assert.ok(metrics.riskScore !== null && metrics.riskScore >= 19 && metrics.riskScore <= 21);

console.log('advisor metrics v2 tests passed');
