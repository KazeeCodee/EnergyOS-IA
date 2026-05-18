import assert from 'node:assert/strict';
import { validateAdvisorResponse } from './src/advisor/qaValidator.js';
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
  exposure: null,
  invoice: null,
  invoiceConcepts: [],
  compliance: null,
  loadFactor: null,
  market: null,
  privateContext: null,
  availability: {
    identity: { available: true, rows: 1 },
    currentPeriod: { available: true, rows: 1 },
    historicalConsumption: { available: false, rows: 0 },
    exposure: { available: false, rows: 0 },
    invoice: { available: false, rows: 0 },
    compliance: { available: false, rows: 0 },
    loadFactor: { available: false, rows: 0 },
    market: { available: false, rows: 0 },
    privateContext: { available: false, rows: 0 },
  },
  dataUsed: ['public.vw_consumo_gu_mensual'],
  missingData: [],
  evidence: [],
  warnings: [],
};

const contradiction = validateAdvisorResponse({
  response: 'No hay datos disponibles para el periodo 2026-03.',
  snapshot,
});

assert.equal(contradiction.passed, false);
assert.equal(contradiction.issues.includes('missing_data_contradiction'), true);
assert.match(contradiction.correctedResponse ?? '', /64904\.06 MWh/);

const wrongNemo = validateAdvisorResponse({
  response: 'Resumen para OTRONEMO: hay consumo informado.',
  snapshot,
});

assert.equal(wrongNemo.passed, false);
assert.equal(wrongNemo.issues.includes('unauthorized_or_wrong_nemo'), true);

const valid = validateAdvisorResponse({
  response: 'Resumen para Acindar Industria Argentina (ACINVCSZ): demanda real 64904.06 MWh en 2026-03.',
  snapshot,
});

assert.equal(valid.passed, true);
assert.deepEqual(valid.issues, []);

console.log('advisor qa validator tests passed');
