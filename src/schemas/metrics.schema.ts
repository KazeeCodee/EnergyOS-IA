import { z } from 'zod';

/**
 * Métricas energéticas calculadas para un período.
 * Corresponde a la sección 10.1 del documento base.
 *
 * Todos los campos numéricos son `number | null` (no undefined).
 * El Metrics Engine siempre devuelve todos los campos.
 */
export const EnergyMetricsSchema = z.object({
  companyId: z.string(),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Formato esperado: YYYY-MM'),

  // Consumo
  totalConsumptionMwh: z.number().nullable(),
  totalMaterMwh: z.number().nullable(),
  totalSpotMwh: z.number().nullable(),

  // Costos
  totalCost: z.number().nullable(),
  avgCostPerMwh: z.number().nullable(),

  // Variaciones período actual vs anterior
  costChangePct: z.number().nullable(),
  consumptionChangePct: z.number().nullable(),
  avgCostPerMwhChangePct: z.number().nullable(),
  costVsConsumptionDelta: z.number().nullable(),

  // Exposición y cobertura
  spotExposurePct: z.number().nullable(),
  exposureChangePct: z.number().nullable(),
  contractCoveragePct: z.number().nullable(),
  coverageChangePct: z.number().nullable(),

  // Cumplimiento renovable
  renewableCompliancePct: z.number().nullable(),
  renewableComplianceGap: z.number().nullable(),

  // Puntos de suministro
  mainSupplyPointImpact: z.string().nullable(),
  mainSupplyPointImpactShare: z.number().nullable(),

  // Scores
  historicalDeviationScore: z.number().nullable(),
  riskScore: z.number().nullable(),
});

export type EnergyMetrics = z.infer<typeof EnergyMetricsSchema>;
