import {
  AdvisorFindingSchema,
  AdvisorRecommendationSchema,
  type AdvisorFile,
  type AdvisorFinding,
  type AdvisorMetrics,
  type AdvisorRecommendation,
  type EnergySnapshot,
  type EvidenceRef,
} from '../schemas/advisor.schema.js';
import type { AdvisorIntent } from './intentRouter.js';

export type SpecialistInput = {
  intent: AdvisorIntent;
  snapshot: EnergySnapshot;
  metrics: AdvisorMetrics;
  files: AdvisorFile[];
};

export type SpecialistOutput = {
  findings: AdvisorFinding[];
  recommendations: AdvisorRecommendation[];
  missingData: string[];
  limitations: string[];
  evidence: EvidenceRef[];
};

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function money(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0,
  }).format(value);
}

function severityForSpot(value: number | null): 'low' | 'medium' | 'high' | 'critical' {
  if (value === null) return 'low';
  if (value >= 0.6) return 'critical';
  if (value >= 0.4) return 'high';
  if (value >= 0.3) return 'medium';
  return 'low';
}

function pushFinding(target: AdvisorFinding[], finding: AdvisorFinding) {
  target.push(AdvisorFindingSchema.parse(finding));
}

function pushRecommendation(target: AdvisorRecommendation[], recommendation: AdvisorRecommendation) {
  target.push(AdvisorRecommendationSchema.parse(recommendation));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function shouldRun(intent: AdvisorIntent, accepted: AdvisorIntent[]): boolean {
  return accepted.includes(intent)
    || intent === 'monthly_summary'
    || intent === 'guided_diagnosis'
    || intent === 'general_question';
}

export function runAdvisorSpecialists(input: SpecialistInput): SpecialistOutput {
  const { intent, snapshot, metrics, files } = input;
  const findings: AdvisorFinding[] = [];
  const recommendations: AdvisorRecommendation[] = [];
  const missingData = [...snapshot.missingData];
  const limitations = [...snapshot.warnings];
  const evidence = [...snapshot.evidence];

  if (metrics.totalConsumptionMwh !== null && shouldRun(intent, ['monthly_summary', 'action_plan', 'report'])) {
    pushFinding(findings, {
      id: 'monthly_consumption',
      type: 'monthly_consumption',
      severity: 'low',
      title: `Consumo disponible para ${snapshot.resolvedPeriod}`,
      detail: `El sistema registra ${metrics.totalConsumptionMwh.toFixed(2)} MWh de demanda real para ${snapshot.resolvedPeriod}.`,
      evidence,
      missingData: [],
    });
  }

  if (metrics.spotExposurePct !== null && shouldRun(intent, ['monthly_summary', 'contract', 'action_plan', 'report'])) {
    const severity = severityForSpot(metrics.spotExposurePct);
    pushFinding(findings, {
      id: 'spot_exposure',
      type: 'spot_exposure',
      severity,
      title: `Exposicion spot ${pct(metrics.spotExposurePct)}`,
      detail: `La cobertura contractual estimada es ${metrics.contractCoveragePct !== null ? pct(metrics.contractCoveragePct) : 'no disponible'} y la compra spot representa ${pct(metrics.spotExposurePct)} de la demanda.`,
      evidence: evidence.filter((item) => item.source.includes('exposicion') || item.source.includes('consumo')),
      missingData: [],
    });

    if (metrics.spotExposurePct >= 0.3) {
      pushRecommendation(recommendations, {
        id: 'review_spot_coverage',
        priority: severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : 'medium',
        action: 'Revisar cobertura contractual MATER para reducir exposicion spot.',
        reason: `La exposicion spot esta en ${pct(metrics.spotExposurePct)}, nivel que puede amplificar volatilidad de costos.`,
        requiredData: ['contratos vigentes', 'compromisos mensuales', 'forecast de demanda'],
      });
    }
  }

  if (metrics.invoiceTotalPesos !== null && shouldRun(intent, ['monthly_summary', 'invoice', 'action_plan', 'report'])) {
    pushFinding(findings, {
      id: 'invoice_cost',
      type: 'invoice_cost',
      severity: metrics.costDtePesosMwh !== null ? 'medium' : 'low',
      title: `DTE/facturacion disponible por ARS ${money(metrics.invoiceTotalPesos)}`,
      detail: `El costo DTE unitario informado es ${metrics.costDtePesosMwh !== null ? `ARS ${money(metrics.costDtePesosMwh)}/MWh` : 'no disponible'}.`,
      evidence: evidence.filter((item) => item.source.includes('factura')),
      missingData: snapshot.invoiceConcepts.length > 0 ? [] : ['conceptos DTE normalizados del periodo'],
    });

    if (intent === 'invoice' || intent === 'monthly_summary') {
      pushRecommendation(recommendations, {
        id: 'audit_invoice_concepts',
        priority: 'medium',
        action: 'Revisar conceptos DTE de mayor importe y variaciones contra meses anteriores.',
        reason: 'Hay importe de facturacion disponible para auditar composicion y posibles desvios.',
        requiredData: snapshot.invoiceConcepts.length > 0 ? [] : ['detalle de conceptos DTE'],
      });
    }
  }

  if (shouldRun(intent, ['contract', 'monthly_summary', 'action_plan', 'report'])) {
    const contracts = snapshot.privateContext?.contracts ?? [];
    if (contracts.length === 0) {
      if (!missingData.includes('contratos privados vigentes')) missingData.push('contratos privados vigentes');
    } else {
      const activeContracts = contracts.filter((contract) => contract.status === 'activo');
      pushFinding(findings, {
        id: 'private_contracts',
        type: 'private_contracts',
        severity: activeContracts.length > 0 ? 'low' : 'medium',
        title: `${contracts.length} contrato(s) en Data Room`,
        detail: `${activeContracts.length} contrato(s) figuran activos. Los contratos en borrador reducen confianza analitica.`,
        evidence,
        missingData: [],
      });
    }
  }

  if (shouldRun(intent, ['compliance', 'monthly_summary', 'action_plan', 'report'])) {
    const hasGap = (metrics.renewableGapYtdMwh ?? 0) > 0 || snapshot.compliance?.cumpleYtd === false;
    if (metrics.renewableYtdPct !== null || hasGap) {
      pushFinding(findings, {
        id: 'renewable_compliance_gap',
        type: 'renewable_compliance_gap',
        severity: hasGap ? 'high' : 'low',
        title: `Cumplimiento renovable YTD ${metrics.renewableYtdPct !== null ? pct(metrics.renewableYtdPct) : 'no disponible'}`,
        detail: hasGap
          ? `Existe brecha renovable YTD de ${metrics.renewableGapYtdMwh ?? 0} MWh y multa estimada de ARS ${money(metrics.estimatedRenewablePenaltyPesos ?? 0)}.`
          : 'No se observa brecha renovable YTD en los datos disponibles.',
        evidence: evidence.filter((item) => item.source.includes('compliance')),
        missingData: [],
      });

      if (hasGap) {
        pushRecommendation(recommendations, {
          id: 'close_renewable_gap',
          priority: 'high',
          action: 'Priorizar regularizacion de cobertura renovable Ley 27.191.',
          reason: 'La brecha YTD puede generar penalidad o exposicion regulatoria.',
          requiredData: ['contratos renovables vigentes', 'energia renovable certificada'],
        });
      }
    }
  }

  if (intent === 'document_intake' || files.length > 0) {
    for (const file of files) {
      pushFinding(findings, {
        id: `file_received_${file.name}`,
        type: 'file_received',
        severity: 'medium',
        title: `Archivo recibido: ${file.name}`,
        detail: `Tipo MIME ${file.type}. Debe procesarse como evidencia y, si corresponde, extraerse a campos estructurados antes de usarlo como dato final.`,
        evidence: [{
          source: 'user_upload',
          label: file.name,
          fields: ['name', 'type', 'content'],
          confidence: 'medium',
        }],
        missingData: [],
      });
    }

    pushRecommendation(recommendations, {
      id: 'process_attached_files',
      priority: 'high',
      action: 'Procesar archivos adjuntos con Document Intake antes de confirmar valores extraidos.',
      reason: 'Los documentos pueden aportar evidencia, pero no deben reemplazar campos estructurados validados.',
      requiredData: ['clasificacion del documento', 'extraccion estructurada', 'validacion humana si modifica datos maestros'],
    });
  }

  if (snapshot.historicalConsumption.length === 0 && !missingData.includes('historial energetico para tendencia')) {
    missingData.push('historial energetico para tendencia');
  }

  return {
    findings,
    recommendations,
    missingData: unique(missingData),
    limitations: unique(limitations),
    evidence,
  };
}
