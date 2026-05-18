import type { EnergyMetrics } from '../schemas/metrics.schema.js';
import type { Finding, Severity, Confidence } from '../schemas/finding.schema.js';
import type { RecommendationInput } from '../schemas/recommendation.schema.js';
import type { AiContractSummary, ClientPrivateContext } from '../schemas/clientPrivateContext.schema.js';

type ContractRiskAnalyzerInput = {
  period: string;
  metrics: EnergyMetrics;
  context: ClientPrivateContext | null;
  referenceDate?: Date;
};

export type ContractRiskAnalyzerOutput = {
  findings: Finding[];
  recommendations: RecommendationInput[];
  missingData: string[];
  limitations: string[];
};

function severityRank(severity: Severity): number {
  return { low: 1, medium: 2, high: 3, critical: 4 }[severity];
}

function makeId(prefix: string, index: number): string {
  return `${prefix}_contract_${String(index).padStart(3, '0')}`;
}

function daysUntil(dateText: string, referenceDate: Date): number | null {
  if (!dateText) return null;
  const date = new Date(`${dateText}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  const start = Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate());
  const end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.ceil((end - start) / 86_400_000);
}

function addFinding(
  output: ContractRiskAnalyzerOutput,
  finding: Omit<Finding, 'id'>,
  recommendation: Omit<RecommendationInput, 'id' | 'findingId'>,
): void {
  const next = output.findings.length + 1;
  const findingId = makeId('finding', next);
  output.findings.push({ id: findingId, ...finding });
  output.recommendations.push({
    id: makeId('rec', next),
    findingId,
    ...recommendation,
  });
}

function activeOrDraftContracts(context: ClientPrivateContext): AiContractSummary[] {
  return context.contracts.filter((contract) => !['vencido', 'rescindido'].includes(contract.status));
}

function confidenceForContract(contract: AiContractSummary): Confidence {
  if (contract.status === 'borrador') return 'low';
  if (!contract.sourceDocumentName || !contract.versionId) return 'medium';
  return 'high';
}

function addMissing(output: ContractRiskAnalyzerOutput, value: string): void {
  if (!output.missingData.includes(value)) output.missingData.push(value);
}

export function analyzeContractRisks(input: ContractRiskAnalyzerInput): ContractRiskAnalyzerOutput {
  const output: ContractRiskAnalyzerOutput = {
    findings: [],
    recommendations: [],
    missingData: [],
    limitations: [],
  };

  if (!input.context) {
    output.limitations.push('No se uso contexto privado del Data Room.');
    return output;
  }

  const contracts = activeOrDraftContracts(input.context);
  const referenceDate = input.referenceDate ?? new Date();

  if (contracts.length === 0) {
    addFinding(output, {
      type: 'missing_contract_context',
      title: 'No hay contratos activos cargados en el Data Room',
      severity: 'high',
      evidence: { nemo: input.context.nemo, contractsCount: input.context.contracts.length },
      likelyCauses: ['Contrato no cargado', 'Contrato vencido', 'Data Room incompleto'],
      missingData: ['contratos vigentes', 'energia contratada', 'precio pactado'],
      confidence: 'high',
    }, {
      title: 'Cargar contratos vigentes en Mi empresa',
      priority: 'high',
      reason: 'Sin contratos no se puede confirmar cobertura, precio pactado ni vencimientos.',
      evidence: ['Data Room sin contratos activos/borrador disponibles'],
      action: 'Cargar contrato MATER/PPA/distribuidora vigente con energia, precio, vigencia y evidencia.',
      expectedImpact: 'Permite validar causas de variaciones de costo y riesgo de exposicion.',
      requiredData: ['contrato vigente', 'version contractual', 'documento fuente'],
      confidence: 'high',
    });
    return output;
  }

  for (const contract of contracts) {
    const confidence = confidenceForContract(contract);
    const evidenceBase = {
      contractId: contract.id,
      versionId: contract.versionId ?? null,
      contractName: contract.contractName,
      status: contract.status,
      sourceDocumentName: contract.sourceDocumentName || null,
    };

    if (contract.status === 'borrador') {
      output.limitations.push(`El contrato ${contract.contractName} esta en borrador; sus condiciones reducen la confianza del analisis.`);
      addFinding(output, {
        type: 'contract_draft_used_for_analysis',
        title: `${contract.contractName} esta en borrador`,
        severity: 'medium',
        evidence: evidenceBase,
        likelyCauses: ['Contrato cargado como borrador', 'Falta validacion interna o documento final'],
        missingData: ['estado contractual confirmado'],
        confidence,
      }, {
        title: `Confirmar estado de ${contract.contractName}`,
        priority: 'medium',
        reason: 'Un contrato en borrador no debe tratarse como condicion contractual firme.',
        evidence: [`Estado cargado: ${contract.status}`],
        action: 'Validar si el contrato esta firmado/activo y actualizar el estado en Mi empresa.',
        expectedImpact: 'Evita conclusiones contractuales con datos no confirmados.',
        requiredData: ['estado confirmado', 'fecha de firma', 'documento fuente'],
        confidence,
      });
    }

    if (!contract.internalOwnerEmail) {
      addMissing(output, `responsable interno del contrato ${contract.contractName}`);
    }

    if (!contract.sourceDocumentName) {
      addFinding(output, {
        type: 'contract_missing_evidence',
        title: `${contract.contractName} no tiene documento fuente`,
        severity: 'medium',
        evidence: evidenceBase,
        missingData: ['documento fuente del contrato'],
        confidence: 'high',
      }, {
        title: `Vincular evidencia de ${contract.contractName}`,
        priority: 'medium',
        reason: 'Sin documento fuente, la IA solo puede usar campos cargados manualmente.',
        evidence: ['sourceDocumentName vacio'],
        action: 'Cargar o vincular el PDF/Excel/contrato que respalda los campos estructurados.',
        expectedImpact: 'Mejora trazabilidad y confianza del diagnostico.',
        requiredData: ['documento fuente', 'link de evidencia'],
        confidence: 'high',
      });
    }

    if (!contract.basePrice || contract.basePrice <= 0) {
      addFinding(output, {
        type: 'contract_missing_price',
        title: `${contract.contractName} no tiene precio base cargado`,
        severity: 'high',
        evidence: evidenceBase,
        missingData: ['precio base', 'moneda', 'tipo de precio'],
        confidence: 'high',
      }, {
        title: `Completar precio de ${contract.contractName}`,
        priority: 'high',
        reason: 'Sin precio pactado no se puede comparar costo efectivo contra condicion contractual.',
        evidence: ['basePrice vacio o cero'],
        action: 'Cargar precio base, moneda y tipo de precio del contrato.',
        expectedImpact: 'Permite explicar si el aumento de costo viene de precio, exposicion o facturacion.',
        requiredData: ['basePrice', 'priceCurrency', 'priceType'],
        confidence: 'high',
      });
    }

    const hasEnergy = Boolean(
      (contract.monthlyEnergyMwh && contract.monthlyEnergyMwh > 0) ||
      (contract.annualEnergyMwh && contract.annualEnergyMwh > 0),
    );
    if (!hasEnergy) {
      addFinding(output, {
        type: 'contract_missing_energy',
        title: `${contract.contractName} no tiene energia contratada cargada`,
        severity: 'high',
        evidence: evidenceBase,
        missingData: ['energia mensual o anual contratada'],
        confidence: 'high',
      }, {
        title: `Completar energia contratada de ${contract.contractName}`,
        priority: 'high',
        reason: 'Sin energia contratada no se puede medir cobertura ni exposicion residual.',
        evidence: ['monthlyEnergyMwh y annualEnergyMwh vacios o cero'],
        action: 'Cargar MWh mensuales, MWh anuales o compromisos mensuales.',
        expectedImpact: 'Permite comparar contrato contra demanda real del periodo.',
        requiredData: ['monthlyEnergyMwh', 'annualEnergyMwh'],
        confidence: 'high',
      });
    }

    if (contract.renewable && !contract.technology) {
      addMissing(output, `tecnologia renovable del contrato ${contract.contractName}`);
      addFinding(output, {
        type: 'renewable_contract_missing_technology',
        title: `${contract.contractName} es renovable pero no indica tecnologia`,
        severity: 'medium',
        evidence: { ...evidenceBase, renewable: contract.renewable, technology: contract.technology },
        missingData: ['tecnologia renovable'],
        confidence: 'high',
      }, {
        title: `Completar tecnologia renovable de ${contract.contractName}`,
        priority: 'medium',
        reason: 'La tecnologia ayuda a validar cumplimiento renovable y trazabilidad MATER.',
        evidence: ['renewable=true', 'technology vacio'],
        action: 'Cargar tecnologia: solar, eolica, hidro, biomasa, termica, mixta o desconocida.',
        expectedImpact: 'Mejora la explicacion de cumplimiento renovable.',
        requiredData: ['technology'],
        confidence: 'high',
      });
    }

    const daysToEnd = daysUntil(contract.endDate, referenceDate);
    if (daysToEnd !== null && daysToEnd <= 120) {
      const severity: Severity = daysToEnd < 0 ? 'critical' : daysToEnd <= 45 ? 'high' : 'medium';
      addFinding(output, {
        type: daysToEnd < 0 ? 'contract_expired' : 'contract_expiring_soon',
        title: daysToEnd < 0
          ? `${contract.contractName} esta vencido`
          : `${contract.contractName} vence en ${daysToEnd} dias`,
        severity,
        evidence: { ...evidenceBase, endDate: contract.endDate, daysToEnd },
        recommendedChecks: ['vigencia contractual', 'renovacion o reemplazo de cobertura'],
        confidence,
      }, {
        title: `Revisar vencimiento de ${contract.contractName}`,
        priority: severity,
        reason: daysToEnd < 0
          ? 'El contrato figura vencido y puede dejar demanda expuesta.'
          : 'El vencimiento cercano puede aumentar exposicion si no se renueva a tiempo.',
        evidence: [`Fecha fin: ${contract.endDate}`, `Dias al vencimiento: ${daysToEnd}`],
        action: 'Confirmar estrategia de renovacion, reemplazo o cobertura alternativa.',
        expectedImpact: 'Reduce riesgo de exposicion spot y perdida de cobertura renovable.',
        requiredData: ['estado de renovacion', 'contrato reemplazo o extension'],
        confidence,
      });
    }
  }

  const totalContractedMonthly = contracts.reduce((sum, contract) => {
    if (contract.monthlyEnergyMwh && contract.monthlyEnergyMwh > 0) return sum + contract.monthlyEnergyMwh;
    if (contract.annualEnergyMwh && contract.annualEnergyMwh > 0) return sum + contract.annualEnergyMwh / 12;
    return sum;
  }, 0);

  if (input.metrics.totalConsumptionMwh !== null && totalContractedMonthly > 0) {
    const coverageRatio = totalContractedMonthly / input.metrics.totalConsumptionMwh;
    if (coverageRatio < 0.8) {
      addFinding(output, {
        type: 'contract_coverage_shortfall',
        title: 'La energia contratada cargada cubre menos del 80% de la demanda',
        severity: 'high',
        evidence: {
          period: input.period,
          totalConsumptionMwh: input.metrics.totalConsumptionMwh,
          totalContractedMonthlyMwh: totalContractedMonthly,
          coverageRatio,
        },
        likelyCauses: ['Cobertura contractual insuficiente', 'Contrato faltante en Data Room', 'Demanda por encima de lo contratado'],
        missingData: ['compromisos mensuales por contrato', 'facturas/DTE para validar exposicion real'],
        confidence: 'medium',
      }, {
        title: 'Validar cobertura contractual del periodo',
        priority: 'high',
        reason: `La energia contratada cargada equivale al ${(coverageRatio * 100).toFixed(1)}% de la demanda del periodo.`,
        evidence: [
          `Demanda: ${input.metrics.totalConsumptionMwh.toFixed(0)} MWh`,
          `Contratado cargado: ${totalContractedMonthly.toFixed(0)} MWh`,
        ],
        action: 'Confirmar si faltan contratos o si la diferencia corresponde a exposicion spot.',
        expectedImpact: 'Permite explicar variaciones de costo por exposicion o cobertura.',
        requiredData: ['contratos faltantes', 'compromisos mensuales', 'DTE/facturas'],
        confidence: 'medium',
      });
    } else if (coverageRatio > 1.2) {
      addFinding(output, {
        type: 'contract_overcoverage_review',
        title: 'La energia contratada cargada supera 120% de la demanda',
        severity: 'medium',
        evidence: {
          period: input.period,
          totalConsumptionMwh: input.metrics.totalConsumptionMwh,
          totalContractedMonthlyMwh: totalContractedMonthly,
          coverageRatio,
        },
        likelyCauses: ['Sobrecontratacion', 'Caida de demanda', 'Contratos no asignados al periodo correcto'],
        confidence: 'medium',
      }, {
        title: 'Revisar posible sobrecobertura contractual',
        priority: 'medium',
        reason: `La energia contratada cargada equivale al ${(coverageRatio * 100).toFixed(1)}% de la demanda.`,
        evidence: [
          `Demanda: ${input.metrics.totalConsumptionMwh.toFixed(0)} MWh`,
          `Contratado cargado: ${totalContractedMonthly.toFixed(0)} MWh`,
        ],
        action: 'Validar compromisos, take-or-pay y asignacion de contratos por periodo.',
        expectedImpact: 'Evita costos por sobrecobertura o mala asignacion contractual.',
        requiredData: ['clausulas take-or-pay', 'compromisos mensuales'],
        confidence: 'medium',
      });
    }
  }

  if ((input.metrics.renewableComplianceGap ?? 0) > 0) {
    const renewableContracts = contracts.filter((contract) => contract.renewable);
    if (renewableContracts.length === 0) {
      addFinding(output, {
        type: 'renewable_gap_without_private_contract',
        title: 'Hay brecha renovable y no hay contrato renovable activo cargado',
        severity: 'high',
        evidence: {
          renewableCompliancePct: input.metrics.renewableCompliancePct,
          renewableComplianceGap: input.metrics.renewableComplianceGap,
          renewableContractsCount: 0,
        },
        likelyCauses: ['Contrato renovable no cargado', 'Cobertura renovable insuficiente'],
        missingData: ['contrato MATER renovable', 'energia renovable contratada'],
        confidence: 'medium',
      }, {
        title: 'Cargar o revisar cobertura renovable',
        priority: 'high',
        reason: 'El sistema detecta brecha renovable, pero el Data Room no tiene contrato renovable activo.',
        evidence: [`Brecha renovable: ${((input.metrics.renewableComplianceGap ?? 0) * 100).toFixed(1)}%`],
        action: 'Confirmar si existe contrato MATER renovable o alternativa de cumplimiento.',
        expectedImpact: 'Reduce riesgo de incumplimiento y penalidades.',
        requiredData: ['contrato renovable', 'energia anual renovable', 'DTE/facturas'],
        confidence: 'medium',
      });
    }
  }

  output.findings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  output.recommendations.sort((a, b) => severityRank(b.priority) - severityRank(a.priority));
  return output;
}
