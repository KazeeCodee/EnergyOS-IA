import type { EnergyMetrics } from '../schemas/metrics.schema.js';
import type { MonthlyDataRow, ExposicionRow } from './dataRetriever.js';

// ─── Utilidades ────────────────────────────────────────────────────────────

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function pctChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

function avg(values: (number | null)[]): number | null {
  const clean = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (clean.length === 0) return null;
  return clean.reduce((s, v) => s + v, 0) / clean.length;
}

function stdDev(values: (number | null)[]): number | null {
  const mean = avg(values);
  if (mean === null) return null;
  const clean = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (clean.length < 2) return null;
  const variance = clean.reduce((s, v) => s + (v - mean) ** 2, 0) / clean.length;
  return Math.sqrt(variance);
}

// ─── Metrics Engine ────────────────────────────────────────────────────────

export type MetricsEngineInput = {
  companyId: string;
  period: string;
  currentData: MonthlyDataRow | null;
  previousData: MonthlyDataRow | null;
  historicalData: MonthlyDataRow[];
  exposicionData: ExposicionRow[];
};

/**
 * Calcula todas las métricas energéticas determinísticas para un período.
 * Este módulo NO usa IA — es código puro con cálculos exactos.
 */
export function calculateMetrics(input: MetricsEngineInput): EnergyMetrics {
  const { companyId, period, currentData, previousData, historicalData, exposicionData } = input;

  // ── Consumo y costo del período actual ──
  const totalConsumptionMwh = currentData?.demanda_total_mwh ?? null;
  const totalMaterMwh = currentData?.mater_mwh ?? null;
  const totalSpotMwh = currentData?.spot_mwh ?? null;
  const totalCost = currentData?.costo_total_estimado_usd ?? null;
  const avgCostPerMwh = totalConsumptionMwh && totalCost && totalConsumptionMwh > 0
    ? totalCost / totalConsumptionMwh
    : null;

  // ── Variaciones contra período anterior ──
  const prevConsumption = previousData?.demanda_total_mwh ?? null;
  const prevCost = previousData?.costo_total_estimado_usd ?? null;
  const prevAvgCost = prevConsumption && prevCost && prevConsumption > 0
    ? prevCost / prevConsumption
    : null;

  const costChangePct = pctChange(totalCost, prevCost);
  const consumptionChangePct = pctChange(totalConsumptionMwh, prevConsumption);
  const avgCostPerMwhChangePct = pctChange(avgCostPerMwh, prevAvgCost);

  // Delta costo vs consumo: si costo sube 22% y consumo sube 3%, delta = 19%
  const costVsConsumptionDelta = costChangePct !== null && consumptionChangePct !== null
    ? costChangePct - consumptionChangePct
    : null;

  // ── Exposición spot ──
  const lastExpo = exposicionData.at(-1);
  const prevExpo = exposicionData.at(-2);
  const spotExposurePct = toNum(lastExpo?.pct_spot);
  const prevSpotExposure = toNum(prevExpo?.pct_spot);
  const exposureChangePct = pctChange(spotExposurePct, prevSpotExposure);

  // ── Cobertura contractual ──
  const contractCoveragePct = toNum(lastExpo?.pct_mat);
  const prevCoverage = toNum(prevExpo?.pct_mat);
  const coverageChangePct = pctChange(contractCoveragePct, prevCoverage);

  // ── Cumplimiento renovable ──
  const renewableCompliancePct = currentData?.porcentaje_renovable ?? null;
  // Para Argentina, el mínimo legal es 20% (Ley 27.191)
  const renewableComplianceGap = renewableCompliancePct !== null
    ? Math.max(0, 0.20 - renewableCompliancePct)
    : null;

  // ── Desviación histórica ──
  const historicalConsumptions = historicalData
    .filter(r => !(r.anio === currentData?.anio && r.mes === currentData?.mes))
    .map(r => r.demanda_total_mwh);

  const historicalAvg = avg(historicalConsumptions);
  const historicalStdDev = stdDev(historicalConsumptions);
  const historicalDeviationScore =
    totalConsumptionMwh !== null && historicalAvg !== null && historicalStdDev !== null && historicalStdDev > 0
      ? (totalConsumptionMwh - historicalAvg) / historicalStdDev
      : null;

  // ── Risk score compuesto (0-100) ──
  const riskScore = computeRiskScore({
    costVsConsumptionDelta,
    avgCostPerMwhChangePct,
    spotExposurePct,
    exposureChangePct,
    renewableComplianceGap,
    historicalDeviationScore,
  });

  return {
    companyId,
    period,
    totalConsumptionMwh,
    totalMaterMwh,
    totalSpotMwh,
    totalCost,
    avgCostPerMwh,
    costChangePct,
    consumptionChangePct,
    avgCostPerMwhChangePct,
    costVsConsumptionDelta,
    spotExposurePct,
    exposureChangePct,
    contractCoveragePct,
    coverageChangePct,
    renewableCompliancePct,
    renewableComplianceGap,
    mainSupplyPointImpact: null,  // Se calcula en el análisis multi-nemo
    mainSupplyPointImpactShare: null,
    historicalDeviationScore,
    riskScore,
  };
}

/**
 * Score de riesgo compuesto (0-100).
 * Pondera múltiples señales en un número único para ranking y priorización.
 */
function computeRiskScore(inputs: {
  costVsConsumptionDelta: number | null;
  avgCostPerMwhChangePct: number | null;
  spotExposurePct: number | null;
  exposureChangePct: number | null;
  renewableComplianceGap: number | null;
  historicalDeviationScore: number | null;
}): number | null {
  const signals: number[] = [];

  // Delta costo vs consumo → máx 25 puntos
  if (inputs.costVsConsumptionDelta !== null) {
    signals.push(Math.min(25, Math.max(0, inputs.costVsConsumptionDelta * 100)));
  }

  // Costo por MWh empeora → máx 20 puntos
  if (inputs.avgCostPerMwhChangePct !== null) {
    signals.push(Math.min(20, Math.max(0, inputs.avgCostPerMwhChangePct * 100)));
  }

  // Exposición spot alta → máx 20 puntos
  if (inputs.spotExposurePct !== null) {
    signals.push(Math.min(20, Math.max(0, (inputs.spotExposurePct - 0.3) * 100)));
  }

  // Exposición sube → máx 15 puntos
  if (inputs.exposureChangePct !== null) {
    signals.push(Math.min(15, Math.max(0, inputs.exposureChangePct * 50)));
  }

  // Brecha renovable → máx 10 puntos
  if (inputs.renewableComplianceGap !== null) {
    signals.push(Math.min(10, Math.max(0, inputs.renewableComplianceGap * 50)));
  }

  // Desviación histórica → máx 10 puntos
  if (inputs.historicalDeviationScore !== null) {
    signals.push(Math.min(10, Math.max(0, (Math.abs(inputs.historicalDeviationScore) - 1) * 5)));
  }

  if (signals.length === 0) return null;
  return Math.round(signals.reduce((s, v) => s + v, 0));
}

/**
 * Utilidades exportadas para el Anomaly Detector.
 */
export { pctChange, avg, stdDev, toNum };
