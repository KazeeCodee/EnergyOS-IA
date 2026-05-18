import assert from 'node:assert/strict';
import { reconcileInvoice } from './src/reconciliation/reconciliationEngine.js';
import type { ClientPrivateContext } from './src/schemas/clientPrivateContext.schema.js';

const context: ClientPrivateContext = {
  nemo: 'ABCDEFGH',
  generatedAt: '2026-05-17T12:00:00.000Z',
  completeness: {
    overallPct: 50,
    blocks: {
      sites: { label: 'Sitios', status: 'pendiente', pct: 0, detail: '' },
      contracts: { label: 'Contratos', status: 'completo', pct: 100, detail: '' },
      invoices: { label: 'Facturas', status: 'pendiente', pct: 0, detail: '' },
      forecast: { label: 'Forecast', status: 'pendiente', pct: 0, detail: '' },
      claims: { label: 'Reclamos', status: 'pendiente', pct: 0, detail: '' },
      smec: { label: 'SMEC', status: 'pendiente', pct: 0, detail: '' },
      responsibles: { label: 'Responsables', status: 'pendiente', pct: 0, detail: '' },
      documents: { label: 'Documentos', status: 'pendiente', pct: 0, detail: '' },
    },
  },
  contracts: [
    {
      id: 'contract-1',
      versionId: 'version-1',
      versionNumber: 1,
      contractName: 'Contrato MATER',
      contractType: 'RENOVABLE',
      status: 'activo',
      buyerNemo: 'ABCDEFGH',
      sellerNemo: 'SELLER01',
      generatorGroup: 'Parque X',
      marketerNemo: '',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      signedDate: '2025-12-01',
      monthlyEnergyMwh: 1000,
      annualEnergyMwh: 12000,
      contractedPowerMw: 5,
      priceCurrency: 'USD',
      basePrice: 70,
      priceType: 'fijo',
      renewable: true,
      technology: 'solar',
      internalOwnerEmail: 'energia@empresa.com',
      renewalDeadline: '2026-10-01',
      adjustmentIndex: '',
      adjustmentFrequency: '',
      sourceDocumentName: 'contrato.pdf',
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

const insufficient = reconcileInvoice({
  period: '2026-04',
  context,
  invoices: [],
});
assert.equal(insufficient.status, 'insufficient_data');
assert.equal(insufficient.missingData.includes('facturas/DTE normalizadas'), true);

const difference = reconcileInvoice({
  period: '2026-04',
  context,
  invoices: [
    {
      id: 'invoice-1',
      periodo: '2026-04',
      invoiceType: 'dte',
      currency: 'USD',
      totalAmount: 80000,
      lines: [
        {
          conceptName: 'Energia MATER',
          energyMwh: 1000,
          unitPrice: 80,
          amount: 80000,
          currency: 'USD',
        },
      ],
    },
  ],
});

assert.equal(difference.status, 'difference_detected');
assert.equal(difference.checks.some((check) => check.code === 'amount_vs_contract' && check.status === 'difference_detected'), true);
assert.equal(difference.recommendations[0].priority, 'high');

const reconciled = reconcileInvoice({
  period: '2026-04',
  context,
  invoices: [
    {
      id: 'invoice-2',
      periodo: '2026-04',
      invoiceType: 'dte',
      currency: 'USD',
      totalAmount: 70000,
      lines: [
        {
          conceptName: 'Energia MATER',
          energyMwh: 1000,
          unitPrice: 70,
          amount: 70000,
          currency: 'USD',
        },
      ],
    },
  ],
});

assert.equal(reconciled.status, 'reconciled');

console.log('reconciliation tests passed');
