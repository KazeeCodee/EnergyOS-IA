import {
  AdvisorChatInputSchema,
  AdvisorRunOutputSchema,
  type AdvisorChatInput,
  type AdvisorFile,
  type AdvisorMetrics,
  type AdvisorRunOutput,
  type EnergySnapshot,
} from '../schemas/advisor.schema.js';
import {
  buildEnergySnapshot,
  type EnergySnapshotInput,
} from '../context/energyosSnapshot.js';
import { calculateAdvisorMetrics } from './metricsV2.js';
import { classifyAdvisorIntent, type AdvisorIntent } from './intentRouter.js';
import { runAdvisorSpecialists, type SpecialistOutput } from './specialists.js';
import { validateAdvisorResponse } from './qaValidator.js';

export type AdvisorResponseWriterInput = {
  input: AdvisorChatInput;
  intent: AdvisorIntent;
  snapshot: EnergySnapshot;
  metrics: AdvisorMetrics;
  specialistOutput: SpecialistOutput;
};

export type AdvisorOrchestratorOptions = {
  snapshotBuilder?: (input: EnergySnapshotInput) => Promise<EnergySnapshot>;
  responseWriter?: (input: AdvisorResponseWriterInput) => string | Promise<string>;
  userToken?: string;
};

function formatNumber(value: number | null, decimals = 2): string {
  if (value === null || !Number.isFinite(value)) return 'no disponible';
  return value.toFixed(decimals);
}

function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'no disponible';
  return `${(value * 100).toFixed(1)}%`;
}

function formatMoneyRaw(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'no disponible';
  return value.toFixed(0);
}

function companyLabel(snapshot: EnergySnapshot): string {
  const name = snapshot.companyName ?? snapshot.identity?.description ?? 'la empresa';
  return `${name} (${snapshot.nemo})`;
}

function buildGreeting(snapshot: EnergySnapshot): string {
  return `Hola, buen dia. Estoy listo para ayudarte con ${companyLabel(snapshot)}. Podes pedirme revisar costos, consumo, exposicion spot, contratos, facturas, cumplimiento renovable o desvios del periodo ${snapshot.resolvedPeriod ?? snapshot.requestedPeriod ?? 'disponible'}.`;
}

function buildDeterministicResponse(input: AdvisorResponseWriterInput): string {
  const { intent, snapshot, metrics, specialistOutput } = input;

  if (intent === 'greeting') return buildGreeting(snapshot);

  const lines = [
    `Resumen para ${companyLabel(snapshot)} - periodo ${snapshot.resolvedPeriod ?? 'no resuelto'}.`,
    '',
    'Datos principales:',
    `- Demanda real: ${formatNumber(metrics.totalConsumptionMwh)} MWh.`,
    `- Compra spot: ${formatNumber(metrics.spotMwh)} MWh (${formatPct(metrics.spotExposurePct)}).`,
    `- Cobertura contractual estimada: ${formatPct(metrics.contractCoveragePct)}.`,
    `- DTE/facturacion total: ARS ${formatMoneyRaw(metrics.invoiceTotalPesos)}.`,
    `- Costo DTE unitario: ARS ${formatNumber(metrics.costDtePesosMwh)} / MWh.`,
  ];

  if (metrics.renewableYtdPct !== null || metrics.renewableGapYtdMwh !== null) {
    lines.push(`- Renovable YTD: ${formatPct(metrics.renewableYtdPct)}; brecha YTD: ${formatNumber(metrics.renewableGapYtdMwh)} MWh.`);
  }

  if (specialistOutput.findings.length > 0) {
    lines.push('', 'Hallazgos:');
    for (const finding of specialistOutput.findings.slice(0, 6)) {
      lines.push(`- ${finding.title}: ${finding.detail}`);
    }
  }

  if (specialistOutput.recommendations.length > 0) {
    lines.push('', 'Acciones recomendadas:');
    for (const recommendation of specialistOutput.recommendations.slice(0, 5)) {
      lines.push(`- ${recommendation.action} Motivo: ${recommendation.reason}`);
    }
  }

  if (specialistOutput.missingData.length > 0) {
    lines.push('', `Datos faltantes o parciales: ${specialistOutput.missingData.slice(0, 8).join('; ')}.`);
  }

  if (snapshot.dataUsed.length > 0) {
    lines.push('', `Datos usados: ${snapshot.dataUsed.join(', ')}.`);
  }

  return lines.join('\n');
}

export async function runAdvisorChat(
  rawInput: AdvisorChatInput,
  options: AdvisorOrchestratorOptions = {},
): Promise<AdvisorRunOutput> {
  const input = AdvisorChatInputSchema.parse(rawInput);
  const snapshotBuilder = options.snapshotBuilder ?? buildEnergySnapshot;

  const intent = classifyAdvisorIntent({
    question: input.question,
    files: input.files,
  });

  const snapshot = await snapshotBuilder({
    companyId: input.companyId,
    companyName: input.companyName,
    nemo: input.nemo,
    period: input.period,
    includePrivateContext: input.includePrivateContext,
    userToken: options.userToken,
  });

  const metrics = calculateAdvisorMetrics(snapshot);
  const specialistOutput = runAdvisorSpecialists({
    intent,
    snapshot,
    metrics,
    files: input.files,
  });

  const response = options.responseWriter
    ? await options.responseWriter({ input, intent, snapshot, metrics, specialistOutput })
    : buildDeterministicResponse({ input, intent, snapshot, metrics, specialistOutput });

  const qa = validateAdvisorResponse({ response, snapshot });
  const finalResponse = qa.correctedResponse ?? response;

  return AdvisorRunOutputSchema.parse({
    response: finalResponse,
    intent,
    companyId: input.companyId,
    companyName: input.companyName,
    nemo: input.nemo,
    period: snapshot.resolvedPeriod,
    metrics,
    findings: specialistOutput.findings,
    recommendations: specialistOutput.recommendations,
    missingData: specialistOutput.missingData,
    limitations: specialistOutput.limitations,
    dataUsed: snapshot.dataUsed,
    evidence: specialistOutput.evidence,
    filesReceived: input.files as AdvisorFile[],
    qa: {
      passed: qa.passed,
      issues: qa.issues,
    },
  });
}
