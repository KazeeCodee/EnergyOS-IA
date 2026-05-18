import {
  AdvisorMetricsSchema,
  type AdvisorMetrics,
  type EnergySnapshot,
} from '../schemas/advisor.schema.js';

function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

function firstNumber(...values: Array<number | null | undefined>): number | null {
  for (const value of values) {
    if (value !== null && value !== undefined && Number.isFinite(value)) return value;
  }
  return null;
}

function computeRiskScore(inputs: {
  spotExposurePct: number | null;
  renewableGapYtdMwh: number | null;
  invoiceTotalPesos: number | null;
  currentPeriodAvailable: boolean;
  invoiceAvailable: boolean;
}): number | null {
  const signals: number[] = [];

  if (inputs.spotExposurePct !== null) {
    signals.push(Math.min(35, Math.max(0, (inputs.spotExposurePct - 0.2) * 100)));
  }

  if (inputs.renewableGapYtdMwh !== null && inputs.renewableGapYtdMwh > 0) {
    signals.push(Math.min(30, Math.max(5, inputs.renewableGapYtdMwh / 1000)));
  }

  if (!inputs.currentPeriodAvailable) signals.push(30);
  if (!inputs.invoiceAvailable && inputs.invoiceTotalPesos === null) signals.push(10);

  if (signals.length === 0) return null;
  return Math.round(signals.reduce((sum, value) => sum + value, 0));
}

export function calculateAdvisorMetrics(snapshot: EnergySnapshot): AdvisorMetrics {
  const totalConsumptionMwh = snapshot.currentPeriod?.demandaRealMwh ?? null;
  const contractedMwh = snapshot.currentPeriod?.demandaContratadaMwh ?? null;
  const spotMwh = snapshot.currentPeriod?.compraSpotMwh ?? null;

  const spotExposurePct = firstNumber(
    snapshot.exposure?.pctSpot,
    ratio(spotMwh, totalConsumptionMwh),
  );

  const contractCoveragePct = firstNumber(
    snapshot.exposure?.pctMat,
    ratio(contractedMwh, totalConsumptionMwh),
  );

  const invoiceTotalPesos = snapshot.invoice?.facturaTotalPesos ?? null;
  const renewableGapYtdMwh = firstNumber(
    snapshot.compliance?.brechaYtdMwh,
    snapshot.compliance?.brechaMwh,
  );

  return AdvisorMetricsSchema.parse({
    companyId: snapshot.companyId,
    nemo: snapshot.nemo,
    period: snapshot.resolvedPeriod,
    totalConsumptionMwh,
    contractedMwh,
    spotMwh,
    spotExposurePct,
    contractCoveragePct,
    spotCostPesos: snapshot.exposure?.spotPesos ?? null,
    invoiceTotalPesos,
    costDtePesosMwh: snapshot.invoice?.costoDtePesosMwh ?? null,
    renewableYtdPct: snapshot.compliance?.pctRenovableYtd ?? null,
    renewableGapYtdMwh,
    estimatedRenewablePenaltyPesos: snapshot.compliance?.multaEstimadaPesos ?? null,
    riskScore: computeRiskScore({
      spotExposurePct,
      renewableGapYtdMwh,
      invoiceTotalPesos,
      currentPeriodAvailable: snapshot.availability.currentPeriod.available,
      invoiceAvailable: snapshot.availability.invoice.available,
    }),
  });
}
