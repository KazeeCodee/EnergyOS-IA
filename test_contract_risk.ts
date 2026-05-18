import assert from 'node:assert/strict';
import { analyzeContractRisks } from './src/tools/contractRiskAnalyzer.js';
import type { EnergyMetrics } from './src/schemas/metrics.schema.js';
import type { ClientPrivateContext } from './src/schemas/clientPrivateContext.schema.js';

const metrics: EnergyMetrics = {
  companyId: '11111111-1111-4111-8111-111111111111',
  period: '2026-04',
  totalConsumptionMwh: 1000,
  totalMaterMwh: 500,
  totalSpotMwh: 500,
  totalCost: 100000,
  avgCostPerMwh: 100,
  costChangePct: 0.2,
  consumptionChangePct: 0.02,
  avgCostPerMwhChangePct: 0.18,
  costVsConsumptionDelta: 0.18,
  spotExposurePct: 0.5,
  exposureChangePct: 0.2,
  contractCoveragePct: 0.5,
  coverageChangePct: -0.15,
  renewableCompliancePct: 0.12,
  renewableComplianceGap: 0.08,
  mainSupplyPointImpact: null,
  mainSupplyPointImpactShare: null,
  historicalDeviationScore: 1.2,
  riskScore: 70,
};

const context: ClientPrivateContext = {
  nemo: 'ABCDEFGH',
  generatedAt: '2026-05-17T12:00:00.000Z',
  completeness: {
    overallPct: 25,
    blocks: {
      sites: { label: 'Sitios', status: 'pendiente', pct: 0, detail: 'Sin sitios' },
      contracts: { label: 'Contratos', status: 'parcial', pct: 50, detail: '1 contrato' },
      invoices: { label: 'Facturas', status: 'pendiente', pct: 0, detail: 'Sin facturas' },
      forecast: { label: 'Forecast', status: 'pendiente', pct: 0, detail: 'Sin forecast' },
      claims: { label: 'Reclamos', status: 'pendiente', pct: 0, detail: 'Sin reclamos' },
      smec: { label: 'SMEC', status: 'pendiente', pct: 0, detail: 'Sin SMEC' },
      responsibles: { label: 'Responsables', status: 'pendiente', pct: 0, detail: 'Sin responsables' },
      documents: { label: 'Documentos', status: 'pendiente', pct: 0, detail: 'Sin documentos' },
    },
  },
  contracts: [
    {
      id: 'contract-1',
      versionId: 'version-1',
      versionNumber: 1,
      contractName: 'MATER borrador',
      contractType: 'RENOVABLE',
      status: 'borrador',
      buyerNemo: 'ABCDEFGH',
      sellerNemo: 'SELLER01',
      generatorGroup: 'Parque X',
      marketerNemo: '',
      startDate: '2026-01-01',
      endDate: '2026-07-31',
      signedDate: '',
      monthlyEnergyMwh: 600,
      annualEnergyMwh: null,
      contractedPowerMw: 5,
      priceCurrency: 'USD',
      basePrice: 70,
      priceType: 'fijo',
      renewable: true,
      technology: '',
      internalOwnerEmail: '',
      renewalDeadline: '2026-06-15',
      adjustmentIndex: '',
      adjustmentFrequency: '',
      sourceDocumentName: '',
      savedAt: '2026-05-17T12:00:00.000Z',
    },
  ],
  activeDeadlines: [],
  openClaims: [],
  auditObservations: [],
  missingData: [],
  evidence: [],
  warnings: [],
};

const result = analyzeContractRisks({
  period: '2026-04',
  metrics,
  context,
  referenceDate: new Date('2026-05-17T12:00:00.000Z'),
});

assert.equal(result.findings.some((finding) => finding.type === 'contract_draft_used_for_analysis'), true);
assert.equal(result.findings.some((finding) => finding.type === 'contract_coverage_shortfall'), true);
assert.equal(result.findings.some((finding) => finding.type === 'renewable_contract_missing_technology'), true);
assert.equal(result.missingData.includes('responsable interno del contrato MATER borrador'), true);
assert.equal(result.limitations.some((item) => item.includes('borrador')), true);

console.log('contract risk analyzer tests passed');
