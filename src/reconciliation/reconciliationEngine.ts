import type { ClientPrivateContext } from '../schemas/clientPrivateContext.schema.js';
import type { RecommendationInput } from '../schemas/recommendation.schema.js';

export type NormalizedInvoiceLine = {
  conceptName: string;
  energyMwh?: number | null;
  powerMw?: number | null;
  unitPrice?: number | null;
  amount: number;
  currency: 'ARS' | 'USD';
};

export type NormalizedInvoice = {
  id: string;
  periodo: string;
  invoiceType: string;
  currency: 'ARS' | 'USD';
  totalAmount: number | null;
  lines: NormalizedInvoiceLine[];
};

export type ReconciliationCheck = {
  code: string;
  status: 'reconciled' | 'difference_detected' | 'insufficient_data' | 'blocked';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  evidence: Record<string, unknown>;
};

export type ReconciliationOutput = {
  status: 'reconciled' | 'difference_detected' | 'insufficient_data';
  checks: ReconciliationCheck[];
  missingData: string[];
  recommendations: RecommendationInput[];
  limitations: string[];
};

export type ReconciliationInput = {
  period: string;
  context: ClientPrivateContext | null;
  invoices?: NormalizedInvoice[];
};

function sumEnergy(invoices: NormalizedInvoice[]): number | null {
  const values = invoices.flatMap(invoice => invoice.lines.map(line => line.energyMwh ?? null));
  const clean = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (clean.length === 0) return null;
  return clean.reduce((sum, value) => sum + value, 0);
}

function sumAmount(invoices: NormalizedInvoice[]): { amount: number | null; currency: 'ARS' | 'USD' | null } {
  if (invoices.length === 0) return { amount: null, currency: null };
  const currency = invoices[0].currency;
  if (invoices.some(invoice => invoice.currency !== currency)) return { amount: null, currency: null };
  const amount = invoices.reduce((sum, invoice) => sum + (invoice.totalAmount ?? invoice.lines.reduce((lineSum, line) => lineSum + line.amount, 0)), 0);
  return { amount, currency };
}

function expectedContractEnergy(context: ClientPrivateContext): number | null {
  const total = context.contracts
    .filter(contract => !['vencido', 'rescindido'].includes(contract.status))
    .reduce((sum, contract) => {
      if (contract.monthlyEnergyMwh && contract.monthlyEnergyMwh > 0) return sum + contract.monthlyEnergyMwh;
      if (contract.annualEnergyMwh && contract.annualEnergyMwh > 0) return sum + contract.annualEnergyMwh / 12;
      return sum;
    }, 0);
  return total > 0 ? total : null;
}

function expectedContractAmount(context: ClientPrivateContext): { amount: number | null; currency: 'ARS' | 'USD' | null } {
  let currency: 'ARS' | 'USD' | null = null;
  let amount = 0;
  let comparable = false;

  for (const contract of context.contracts.filter(contract => !['vencido', 'rescindido'].includes(contract.status))) {
    const energy = contract.monthlyEnergyMwh && contract.monthlyEnergyMwh > 0
      ? contract.monthlyEnergyMwh
      : contract.annualEnergyMwh && contract.annualEnergyMwh > 0
        ? contract.annualEnergyMwh / 12
        : null;
    if (!energy || !contract.basePrice) continue;
    if (currency && currency !== contract.priceCurrency) return { amount: null, currency: null };
    currency = contract.priceCurrency;
    amount += energy * contract.basePrice;
    comparable = true;
  }

  return comparable ? { amount, currency } : { amount: null, currency: null };
}

function addRecommendation(output: ReconciliationOutput, recommendation: RecommendationInput): void {
  output.recommendations.push(recommendation);
}

export function reconcileInvoice(input: ReconciliationInput): ReconciliationOutput {
  const output: ReconciliationOutput = {
    status: 'reconciled',
    checks: [],
    missingData: [],
    recommendations: [],
    limitations: [],
  };

  if (!input.context) {
    output.status = 'insufficient_data';
    output.missingData.push('contexto privado Data Room');
    output.limitations.push('No hay contexto privado para comparar contratos contra facturas.');
    return output;
  }

  const invoices = (input.invoices ?? []).filter(invoice => invoice.periodo === input.period);
  if (invoices.length === 0) {
    output.status = 'insufficient_data';
    output.missingData.push('facturas/DTE normalizadas');
    output.checks.push({
      code: 'invoice_presence',
      status: 'insufficient_data',
      severity: 'high',
      message: 'No hay facturas/DTE normalizadas para el periodo.',
      evidence: { period: input.period },
    });
    addRecommendation(output, {
      id: 'rec_reconciliation_load_invoices',
      title: 'Cargar facturas/DTE normalizadas',
      priority: 'high',
      reason: 'Sin facturas o DTE normalizados no se puede reconciliar contra contratos.',
      evidence: [`Periodo: ${input.period}`],
      action: 'Importar factura, DTE o liquidacion CAMMESA con lineas normalizadas.',
      expectedImpact: 'Permite detectar diferencias facturadas y abrir reclamos con evidencia.',
      requiredData: ['invoice_imports', 'invoice_lines'],
      confidence: 'high',
    });
    return output;
  }

  const invoiceEnergy = sumEnergy(invoices);
  const contractEnergy = expectedContractEnergy(input.context);
  if (invoiceEnergy === null || contractEnergy === null) {
    output.status = 'insufficient_data';
    output.missingData.push(invoiceEnergy === null ? 'energia facturada normalizada' : 'energia contratada');
    output.checks.push({
      code: 'energy_vs_contract',
      status: 'insufficient_data',
      severity: 'medium',
      message: 'No hay energia suficiente para comparar factura/DTE contra contrato.',
      evidence: { invoiceEnergy, contractEnergy },
    });
  } else {
    const deltaPct = (invoiceEnergy - contractEnergy) / Math.abs(contractEnergy);
    const difference = Math.abs(deltaPct) > 0.02;
    output.checks.push({
      code: 'energy_vs_contract',
      status: difference ? 'difference_detected' : 'reconciled',
      severity: difference ? 'medium' : 'low',
      message: difference
        ? 'La energia facturada difiere de la energia contratada cargada.'
        : 'La energia facturada esta alineada con la energia contratada cargada.',
      evidence: { invoiceEnergy, contractEnergy, deltaPct },
    });
    if (difference) output.status = 'difference_detected';
  }

  const invoiceAmount = sumAmount(invoices);
  const contractAmount = expectedContractAmount(input.context);
  if (invoiceAmount.amount === null || contractAmount.amount === null || invoiceAmount.currency !== contractAmount.currency) {
    const missing = invoiceAmount.currency !== contractAmount.currency
      ? 'fuente de tipo de cambio o moneda comparable'
      : 'monto facturado o precio contractual comparable';
    output.missingData.push(missing);
    output.checks.push({
      code: 'amount_vs_contract',
      status: 'blocked',
      severity: 'medium',
      message: 'No se puede comparar monto facturado contra contrato por falta de monto/precio comparable o monedas distintas.',
      evidence: {
        invoiceAmount: invoiceAmount.amount,
        invoiceCurrency: invoiceAmount.currency,
        contractAmount: contractAmount.amount,
        contractCurrency: contractAmount.currency,
      },
    });
    output.limitations.push('No se realizaron conversiones ARS/USD.');
  } else {
    const delta = invoiceAmount.amount - contractAmount.amount;
    const deltaPct = delta / Math.abs(contractAmount.amount);
    const difference = Math.abs(deltaPct) > 0.05;
    output.checks.push({
      code: 'amount_vs_contract',
      status: difference ? 'difference_detected' : 'reconciled',
      severity: difference ? 'high' : 'low',
      message: difference
        ? 'El monto facturado difiere del monto esperado por contrato.'
        : 'El monto facturado esta alineado con el monto esperado por contrato.',
      evidence: {
        invoiceAmount: invoiceAmount.amount,
        contractAmount: contractAmount.amount,
        currency: invoiceAmount.currency,
        delta,
        deltaPct,
      },
    });
    if (difference) {
      output.status = 'difference_detected';
      addRecommendation(output, {
        id: 'rec_reconciliation_amount_difference',
        title: 'Revisar diferencia factura/DTE contra contrato',
        priority: 'high',
        reason: `El monto facturado difiere ${(deltaPct * 100).toFixed(1)}% del monto esperado por contrato.`,
        evidence: [
          `Monto facturado: ${invoiceAmount.amount.toFixed(2)} ${invoiceAmount.currency}`,
          `Monto esperado: ${contractAmount.amount.toFixed(2)} ${contractAmount.currency}`,
        ],
        action: 'Revisar lineas facturadas, precio aplicado, energia liquidada y condiciones contractuales.',
        expectedImpact: 'Permite detectar sobrecostos, errores de liquidacion o reclamos recuperables.',
        requiredData: ['factura/DTE', 'contrato vigente', 'lineas normalizadas'],
        confidence: 'medium',
      });
    }
  }

  if (output.checks.some(check => check.status === 'insufficient_data') && output.status === 'reconciled') {
    output.status = 'insufficient_data';
  }

  return output;
}
