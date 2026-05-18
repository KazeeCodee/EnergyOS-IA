import type { EnergyMetrics } from '../schemas/metrics.schema.js';
import type { Finding, Severity, Confidence } from '../schemas/finding.schema.js';
import type { RecommendationInput } from '../schemas/recommendation.schema.js';
import type { MonthlyDataRow } from './dataRetriever.js';
import { THRESHOLDS } from '../config/constants.js';
import { avg, stdDev } from './metricsEngine.js';

// ─── Utilidades ────────────────────────────────────────────────────────────

let findingCounter = 0;

function nextId(prefix: string): string {
  findingCounter += 1;
  return `${prefix}_${String(findingCounter).padStart(3, '0')}`;
}

function fmtPct(v: number | null): string {
  if (v === null) return '-';
  return `${(v * 100).toFixed(1)}%`;
}

function fmtNum(v: number | null, decimals = 0): string {
  if (v === null) return '-';
  return v.toLocaleString('es-AR', { maximumFractionDigits: decimals });
}

/** Resetea el contador (útil para tests) */
export function resetCounter() { findingCounter = 0; }

// ─── Reglas de detección ───────────────────────────────────────────────────

type AnomalyInput = {
  metrics: EnergyMetrics;
  historicalData: MonthlyDataRow[];
};

type RuleResult = {
  finding: Finding;
  recommendation: RecommendationInput;
};

/**
 * Regla 1: Costo sube más que consumo.
 * "El aumento de costo no parece explicado por mayor consumo."
 */
function rule_costNotExplainedByConsumption(input: AnomalyInput): RuleResult | null {
  const { costChangePct, consumptionChangePct, costVsConsumptionDelta, avgCostPerMwhChangePct } = input.metrics;
  if (costChangePct === null || consumptionChangePct === null || costVsConsumptionDelta === null) return null;
  if (costChangePct <= 0) return null; // Solo si el costo subió
  if (costVsConsumptionDelta < THRESHOLDS.costVsConsumptionDelta) return null;

  const severity: Severity = costVsConsumptionDelta > 0.20 ? 'critical' : 'high';
  const id = nextId('finding');

  return {
    finding: {
      id,
      type: 'cost_increase_not_explained_by_consumption',
      title: 'El costo aumentó más que el consumo',
      severity,
      evidence: {
        costChangePct,
        consumptionChangePct,
        avgCostPerMwhChangePct,
        costVsConsumptionDelta,
      },
      likelyCauses: [
        'Deterioro del precio efectivo',
        'Mayor exposición spot',
        'Menor cobertura contractual',
        'Cambio en composición de compra',
      ],
      missingData: ['detalle contractual', 'composición de compra del período'],
      confidence: 'high',
    },
    recommendation: {
      id: nextId('rec'),
      findingId: id,
      title: 'Revisar precio efectivo y cobertura contractual',
      priority: severity === 'critical' ? 'critical' : 'high',
      reason: `El costo subió ${fmtPct(costChangePct)} mientras el consumo solo subió ${fmtPct(consumptionChangePct)}.`,
      evidence: [
        `Costo total ${fmtPct(costChangePct)}`,
        `Consumo ${fmtPct(consumptionChangePct)}`,
        `Costo por MWh ${fmtPct(avgCostPerMwhChangePct)}`,
      ],
      action: 'Comparar precio efectivo del período contra los últimos 6 meses.',
      expectedImpact: 'Identificar la causa económica del aumento y posibles oportunidades de corrección.',
      confidence: 'medium',
      requiredData: ['detalle contractual', 'composición de compra'],
    },
  };
}

/**
 * Regla 2: Consumo sube fuera del patrón.
 */
function rule_consumptionAnomaly(input: AnomalyInput): RuleResult | null {
  const { totalConsumptionMwh, consumptionChangePct } = input.metrics;
  if (totalConsumptionMwh === null || consumptionChangePct === null) return null;
  if (Math.abs(consumptionChangePct) < THRESHOLDS.consumptionAnomalyPct) return null;

  const isIncrease = consumptionChangePct > 0;
  const id = nextId('finding');

  return {
    finding: {
      id,
      type: isIncrease ? 'consumption_spike' : 'consumption_drop',
      title: isIncrease ? 'Aumento anormal de consumo' : 'Caída anormal de consumo',
      severity: 'medium',
      evidence: {
        totalConsumptionMwh,
        consumptionChangePct,
      },
      likelyCauses: isIncrease
        ? ['Aumento de producción', 'Nueva carga eléctrica', 'Dato a validar']
        : ['Parada operativa', 'Reducción de producción', 'Dato a validar'],
      confidence: 'medium',
    },
    recommendation: {
      id: nextId('rec'),
      findingId: id,
      title: isIncrease
        ? 'Validar causa del aumento de consumo'
        : 'Validar causa de la caída de consumo',
      priority: 'medium',
      reason: `El consumo ${isIncrease ? 'subió' : 'bajó'} ${fmtPct(Math.abs(consumptionChangePct))} contra el período anterior.`,
      evidence: [
        `Consumo actual: ${fmtNum(totalConsumptionMwh)} MWh`,
        `Variación: ${fmtPct(consumptionChangePct)}`,
      ],
      action: 'Contrastar contra producción, turnos y eventos operativos del período.',
      confidence: 'medium',
    },
  };
}

/**
 * Regla 3: Costo por MWh empeora.
 */
function rule_avgCostDeteriorating(input: AnomalyInput): RuleResult | null {
  const { avgCostPerMwh, avgCostPerMwhChangePct } = input.metrics;
  if (avgCostPerMwhChangePct === null || avgCostPerMwh === null) return null;
  if (avgCostPerMwhChangePct < THRESHOLDS.avgCostPerMwhWorsening) return null;

  const id = nextId('finding');

  return {
    finding: {
      id,
      type: 'avg_cost_per_mwh_worsening',
      title: 'Deterioro del costo promedio por MWh',
      severity: avgCostPerMwhChangePct > 0.15 ? 'high' : 'medium',
      evidence: {
        avgCostPerMwh,
        avgCostPerMwhChangePct,
      },
      likelyCauses: [
        'Aumento de precios de mercado',
        'Mayor proporción de compra spot',
        'Vencimiento de contratos favorables',
      ],
      confidence: 'high',
    },
    recommendation: {
      id: nextId('rec'),
      findingId: id,
      title: 'Analizar composición del costo por MWh',
      priority: 'high',
      reason: `El costo por MWh empeoró ${fmtPct(avgCostPerMwhChangePct)}.`,
      evidence: [
        `Costo por MWh actual: USD ${fmtNum(avgCostPerMwh, 2)}/MWh`,
        `Variación: ${fmtPct(avgCostPerMwhChangePct)}`,
      ],
      action: 'Desglosar costo por componente (spot, MATER, transporte, cargos) y comparar contra promedio de 6 meses.',
      confidence: 'medium',
      requiredData: ['desglose de costo por componente'],
    },
  };
}

/**
 * Regla 4: Un punto de suministro concentra el desvío.
 */
function rule_supplyPointConcentration(input: AnomalyInput): RuleResult | null {
  const { mainSupplyPointImpact, mainSupplyPointImpactShare } = input.metrics;
  if (!mainSupplyPointImpact || mainSupplyPointImpactShare === null) return null;
  if (mainSupplyPointImpactShare < THRESHOLDS.supplyPointConcentration) return null;

  const id = nextId('finding');

  return {
    finding: {
      id,
      type: 'supply_point_concentration',
      title: `${mainSupplyPointImpact} concentra la mayor parte del desvío`,
      severity: 'high',
      evidence: {
        mainSupplyPointImpact,
        mainSupplyPointImpactShare,
      },
      confidence: 'high',
    },
    recommendation: {
      id: nextId('rec'),
      findingId: id,
      title: `Revisar ${mainSupplyPointImpact} como foco prioritario`,
      priority: 'high',
      reason: `${mainSupplyPointImpact} explica el ${fmtPct(mainSupplyPointImpactShare)} del desvío total.`,
      evidence: [
        `Impacto: ${fmtPct(mainSupplyPointImpactShare)}`,
      ],
      action: `Analizar consumo, costo y cobertura específicos de ${mainSupplyPointImpact}.`,
      confidence: 'high',
    },
  };
}

/**
 * Regla 5: Exposición spot aumenta.
 */
function rule_exposureIncrease(input: AnomalyInput): RuleResult | null {
  const { spotExposurePct, exposureChangePct } = input.metrics;
  if (exposureChangePct === null || spotExposurePct === null) return null;
  if (exposureChangePct < THRESHOLDS.exposureIncrease) return null;

  const id = nextId('finding');

  return {
    finding: {
      id,
      type: 'exposure_increase',
      title: 'Aumento de exposición spot',
      severity: spotExposurePct > 0.60 ? 'high' : 'medium',
      evidence: { spotExposurePct, exposureChangePct },
      likelyCauses: [
        'Insuficiente cobertura contractual',
        'Demanda por encima de contrato',
        'Cambio estacional',
      ],
      confidence: 'high',
    },
    recommendation: {
      id: nextId('rec'),
      findingId: id,
      title: 'Revisar cobertura contractual',
      priority: 'medium',
      reason: `La exposición spot aumentó ${fmtPct(exposureChangePct)} y está en ${fmtPct(spotExposurePct)}.`,
      evidence: [
        `Exposición spot: ${fmtPct(spotExposurePct)}`,
        `Aumento: ${fmtPct(exposureChangePct)}`,
      ],
      action: 'Comparar demanda real contra demanda contratada y evaluar ajuste de cobertura.',
      confidence: 'medium',
    },
  };
}

/**
 * Regla 6: Cobertura cae.
 */
function rule_coverageDecrease(input: AnomalyInput): RuleResult | null {
  const { contractCoveragePct, coverageChangePct } = input.metrics;
  if (coverageChangePct === null || contractCoveragePct === null) return null;
  if (coverageChangePct > -THRESHOLDS.coverageDecrease) return null; // coverageChange es negativo cuando cae

  const id = nextId('finding');

  return {
    finding: {
      id,
      type: 'coverage_decrease',
      title: 'Caída de cobertura contractual',
      severity: 'medium',
      evidence: { contractCoveragePct, coverageChangePct },
      likelyCauses: [
        'Vencimiento de contrato',
        'Demanda creciendo más rápido que la cobertura',
      ],
      confidence: 'high',
    },
    recommendation: {
      id: nextId('rec'),
      findingId: id,
      title: 'Evaluar renovación o ampliación de cobertura',
      priority: 'medium',
      reason: `La cobertura contractual cayó ${fmtPct(Math.abs(coverageChangePct))}.`,
      evidence: [
        `Cobertura actual: ${fmtPct(contractCoveragePct)}`,
        `Variación: ${fmtPct(coverageChangePct)}`,
      ],
      action: 'Revisar contratos vigentes y proyectar cobertura para los próximos 3 meses.',
      confidence: 'medium',
    },
  };
}

/**
 * Regla 7: Variación atípica contra histórico.
 */
function rule_historicalDeviation(input: AnomalyInput): RuleResult | null {
  const { historicalDeviationScore, totalConsumptionMwh } = input.metrics;
  if (historicalDeviationScore === null) return null;
  if (Math.abs(historicalDeviationScore) < THRESHOLDS.historicalDeviationStdDev) return null;

  const id = nextId('finding');
  const direction = historicalDeviationScore > 0 ? 'por encima' : 'por debajo';

  return {
    finding: {
      id,
      type: 'historical_deviation',
      title: `Consumo ${direction} del patrón histórico`,
      severity: Math.abs(historicalDeviationScore) > 3 ? 'high' : 'medium',
      evidence: {
        historicalDeviationScore,
        totalConsumptionMwh,
      },
      likelyCauses: [
        'Cambio operativo',
        'Estacionalidad atípica',
        'Dato a validar',
      ],
      confidence: 'medium',
    },
    recommendation: {
      id: nextId('rec'),
      findingId: id,
      title: 'Validar variación contra patrón histórico',
      priority: 'medium',
      reason: `El consumo está ${fmtNum(Math.abs(historicalDeviationScore), 1)} desviaciones estándar ${direction} del promedio.`,
      evidence: [
        `Consumo actual: ${fmtNum(totalConsumptionMwh)} MWh`,
        `Score de desviación: ${fmtNum(historicalDeviationScore, 1)}σ`,
      ],
      action: 'Comparar contra producción y eventos del período para determinar si es estructural o puntual.',
      confidence: 'medium',
    },
  };
}

/**
 * Regla 8: Riesgo de cumplimiento renovable.
 */
function rule_renewableComplianceRisk(input: AnomalyInput): RuleResult | null {
  const { renewableCompliancePct, renewableComplianceGap } = input.metrics;
  if (renewableComplianceGap === null || renewableCompliancePct === null) return null;
  if (renewableComplianceGap < THRESHOLDS.renewableComplianceGap) return null;

  const id = nextId('finding');

  return {
    finding: {
      id,
      type: 'renewable_compliance_risk',
      title: 'Riesgo de incumplimiento renovable',
      severity: renewableComplianceGap > 0.10 ? 'high' : 'medium',
      evidence: {
        renewableCompliancePct,
        renewableComplianceGap,
        requiredPct: 0.20,
      },
      likelyCauses: [
        'Insuficiente cobertura MATER',
        'Aumento de demanda sin ajuste renovable',
      ],
      confidence: 'high',
    },
    recommendation: {
      id: nextId('rec'),
      findingId: id,
      title: 'Cerrar brecha renovable antes del cierre anual',
      priority: 'high',
      reason: `El cumplimiento renovable está en ${fmtPct(renewableCompliancePct)} contra el 20% obligatorio.`,
      evidence: [
        `Renovable actual: ${fmtPct(renewableCompliancePct)}`,
        `Brecha: ${fmtPct(renewableComplianceGap)}`,
      ],
      action: 'Calcular energía MATER faltante y revisar alternativas de cobertura.',
      confidence: 'high',
    },
  };
}

/**
 * Regla 9: Datos insuficientes.
 */
function rule_insufficientData(input: AnomalyInput): RuleResult | null {
  const missingFields: string[] = [];

  if (input.metrics.totalConsumptionMwh === null) missingFields.push('consumo total');
  if (input.metrics.totalCost === null) missingFields.push('costo total');
  if (input.metrics.costChangePct === null) missingFields.push('variación de costo (falta período anterior)');
  if (input.metrics.spotExposurePct === null) missingFields.push('exposición spot');

  if (missingFields.length === 0) return null;

  const id = nextId('finding');

  return {
    finding: {
      id,
      type: 'insufficient_data',
      title: 'Datos incompletos para el período',
      severity: 'low',
      evidence: { missingFields },
      missingData: missingFields,
      confidence: 'high',
    },
    recommendation: {
      id: nextId('rec'),
      findingId: id,
      title: 'Completar datos faltantes del período',
      priority: 'low',
      reason: `Faltan ${missingFields.length} dato(s) para un análisis completo.`,
      evidence: missingFields.map(f => `Falta: ${f}`),
      action: 'Verificar que los datos del período estén cargados en el sistema.',
      confidence: 'high',
    },
  };
}

/**
 * Regla 10: Mes rompe tendencia.
 */
function rule_trendBreak(input: AnomalyInput): RuleResult | null {
  const { historicalData, metrics } = input;
  const recent = historicalData
    .filter(r => !(r.anio === Number(metrics.period.slice(0, 4)) && r.mes === Number(metrics.period.slice(5, 7))))
    .slice(-THRESHOLDS.trendBreakMonths);

  if (recent.length < THRESHOLDS.trendBreakMonths) return null;
  if (metrics.totalConsumptionMwh === null) return null;

  const recentAvg = avg(recent.map(r => r.demanda_total_mwh));
  if (recentAvg === null || recentAvg === 0) return null;

  const change = (metrics.totalConsumptionMwh - recentAvg) / Math.abs(recentAvg);
  if (Math.abs(change) < THRESHOLDS.trendBreakThreshold) return null;

  const id = nextId('finding');
  const direction = change > 0 ? 'sube' : 'baja';

  return {
    finding: {
      id,
      type: 'trend_break',
      title: `El consumo ${direction} rompiendo la tendencia reciente`,
      severity: 'medium',
      evidence: {
        currentConsumption: metrics.totalConsumptionMwh,
        recentAverage: recentAvg,
        changeVsRecent: change,
      },
      confidence: 'medium',
    },
    recommendation: {
      id: nextId('rec'),
      findingId: id,
      title: `Investigar cambio de tendencia en consumo`,
      priority: 'medium',
      reason: `El consumo ${direction} ${fmtPct(Math.abs(change))} contra el promedio de los últimos ${THRESHOLDS.trendBreakMonths} meses.`,
      evidence: [
        `Consumo actual: ${fmtNum(metrics.totalConsumptionMwh)} MWh`,
        `Promedio reciente: ${fmtNum(recentAvg)} MWh`,
      ],
      action: 'Determinar si es un cambio estructural o puntual.',
      confidence: 'medium',
    },
  };
}

/**
 * Regla 11: Costo estable pero consumo cae → posible oportunidad perdida.
 */
function rule_stableCostWithConsumptionDrop(input: AnomalyInput): RuleResult | null {
  const { costChangePct, consumptionChangePct } = input.metrics;
  if (costChangePct === null || consumptionChangePct === null) return null;

  if (consumptionChangePct > THRESHOLDS.consumptionDropWithStableCost) return null; // consumo no cayó lo suficiente
  if (Math.abs(costChangePct) > THRESHOLDS.costStableRange) return null; // costo no está estable

  const id = nextId('finding');

  return {
    finding: {
      id,
      type: 'stable_cost_consumption_drop',
      title: 'Consumo cae pero costo se mantiene',
      severity: 'medium',
      evidence: { costChangePct, consumptionChangePct },
      likelyCauses: [
        'Cargos fijos que no bajan con el consumo',
        'Deterioro del costo unitario',
        'Penalidades por sub-utilización de contrato',
      ],
      confidence: 'medium',
    },
    recommendation: {
      id: nextId('rec'),
      findingId: id,
      title: 'Revisar componentes fijos del costo',
      priority: 'medium',
      reason: `El consumo bajó ${fmtPct(Math.abs(consumptionChangePct))} pero el costo se mantuvo estable.`,
      evidence: [
        `Costo: ${fmtPct(costChangePct)}`,
        `Consumo: ${fmtPct(consumptionChangePct)}`,
      ],
      action: 'Desglosar costo en componentes fijos y variables para entender la rigidez.',
      confidence: 'medium',
    },
  };
}

/**
 * Regla 12: Consumo estable pero costo por MWh empeora.
 */
function rule_stableConsumptionWithCostDeteriorating(input: AnomalyInput): RuleResult | null {
  const { consumptionChangePct, avgCostPerMwhChangePct } = input.metrics;
  if (consumptionChangePct === null || avgCostPerMwhChangePct === null) return null;

  if (Math.abs(consumptionChangePct) > THRESHOLDS.stableConsumptionRange) return null; // consumo no está estable
  if (avgCostPerMwhChangePct < THRESHOLDS.avgCostPerMwhWorsening) return null; // costo no empeoró

  const id = nextId('finding');

  return {
    finding: {
      id,
      type: 'stable_consumption_cost_worsening',
      title: 'Consumo estable pero costo por MWh empeora',
      severity: 'high',
      evidence: { consumptionChangePct, avgCostPerMwhChangePct },
      likelyCauses: [
        'Deterioro del precio efectivo',
        'Mayor exposición spot con precios al alza',
        'Cambio en composición de compra',
      ],
      confidence: 'high',
    },
    recommendation: {
      id: nextId('rec'),
      findingId: id,
      title: 'Investigar deterioro del costo unitario',
      priority: 'high',
      reason: `Con consumo estable (${fmtPct(consumptionChangePct)}), el costo por MWh empeoró ${fmtPct(avgCostPerMwhChangePct)}.`,
      evidence: [
        `Consumo: ${fmtPct(consumptionChangePct)}`,
        `Costo por MWh: ${fmtPct(avgCostPerMwhChangePct)}`,
      ],
      action: 'Comparar precio efectivo y composición de compra contra el período anterior.',
      confidence: 'high',
    },
  };
}

// ─── Motor principal ───────────────────────────────────────────────────────

const ALL_RULES = [
  rule_costNotExplainedByConsumption,    // 1
  rule_consumptionAnomaly,               // 2
  rule_avgCostDeteriorating,             // 3
  rule_supplyPointConcentration,         // 4
  rule_exposureIncrease,                 // 5
  rule_coverageDecrease,                 // 6
  rule_historicalDeviation,              // 7
  rule_renewableComplianceRisk,          // 8
  rule_insufficientData,                 // 9
  rule_trendBreak,                       // 10
  rule_stableCostWithConsumptionDrop,    // 11
  rule_stableConsumptionWithCostDeteriorating, // 12
];

export type AnomalyDetectorOutput = {
  findings: Finding[];
  recommendations: RecommendationInput[];
};

/**
 * Ejecuta las 12 reglas de detección sobre las métricas calculadas.
 * Devuelve findings y recommendations ordenados por severidad.
 */
export function detectAnomalies(input: AnomalyInput): AnomalyDetectorOutput {
  resetCounter();

  const results = ALL_RULES
    .map(rule => rule(input))
    .filter((r): r is RuleResult => r !== null);

  // Ordenar por severidad (critical > high > medium > low)
  const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  results.sort((a, b) => (severityOrder[b.finding.severity] ?? 0) - (severityOrder[a.finding.severity] ?? 0));

  // Deduplicar: si regla 1 y regla 3 detectan lo mismo (costo vs consumo),
  // mantener la de mayor severidad
  const seenTypes = new Set<string>();
  const deduplicated = results.filter(r => {
    // Si ya tenemos cost_increase_not_explained_by_consumption, no agregar avg_cost_per_mwh_worsening
    if (r.finding.type === 'avg_cost_per_mwh_worsening' && seenTypes.has('cost_increase_not_explained_by_consumption')) {
      return false;
    }
    seenTypes.add(r.finding.type);
    return true;
  });

  return {
    findings: deduplicated.map(r => r.finding),
    recommendations: deduplicated.map(r => r.recommendation),
  };
}
