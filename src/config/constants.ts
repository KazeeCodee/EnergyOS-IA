/**
 * Umbrales y constantes del Anomaly Detector.
 *
 * Todos los porcentajes se expresan como decimales (0.10 = 10%).
 * Los umbrales fueron elegidos para que el primer set de alertas sea
 * lo suficientemente sensible sin generar ruido excesivo.
 */
export const THRESHOLDS = {
  /** Costo sube más que consumo: delta entre costChangePct y consumptionChangePct */
  costVsConsumptionDelta: 0.10,

  /** Consumo sube fuera del patrón (contra promedio 6 meses) */
  consumptionAnomalyPct: 0.15,

  /** Costo por MWh empeora */
  avgCostPerMwhWorsening: 0.08,

  /** Un punto de suministro concentra más de este % del desvío */
  supplyPointConcentration: 0.40,

  /** Exposición spot aumenta */
  exposureIncrease: 0.10,

  /** Cobertura cae */
  coverageDecrease: 0.10,

  /** Variación atípica contra histórico (desviaciones estándar) */
  historicalDeviationStdDev: 2.0,

  /** Riesgo de cumplimiento renovable: gap en % */
  renewableComplianceGap: 0.05,

  /** Cambio brusco de tendencia (mes rompe tendencia de N meses) */
  trendBreakMonths: 3,
  trendBreakThreshold: 0.15,

  /** Consumo cae pero costo estable */
  consumptionDropWithStableCost: -0.10,
  costStableRange: 0.05,

  /** Costo por MWh empeora con consumo estable */
  stableConsumptionRange: 0.05,
} as const;

/** Niveles de severidad ordenados para comparación */
export const SEVERITY_ORDER = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
} as const;

/** Niveles de confianza ordenados */
export const CONFIDENCE_ORDER = {
  low: 1,
  medium: 2,
  high: 3,
} as const;

/** Meses de histórico mínimos para análisis significativo */
export const MIN_HISTORICAL_MONTHS = 3;

/** Meses de histórico para comparaciones robustas */
export const IDEAL_HISTORICAL_MONTHS = 6;
