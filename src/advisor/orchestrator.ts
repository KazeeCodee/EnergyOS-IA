import {
  AdvisorChatInputSchema,
  AdvisorRunOutputSchema,
  type AdvisorChatInput,
  type AdvisorFile,
  type AdvisorMetrics,
  type AdvisorRunOutput,
  type ConversationContext,
  type EnergySnapshot,
} from '../schemas/advisor.schema.js';
import {
  buildEnergySnapshot,
  type EnergySnapshotInput,
} from '../context/energyosSnapshot.js';
import { calculateAdvisorMetrics } from './metricsV2.js';
import { routeAdvisorTurn, type AdvisorIntent } from './intentRouter.js';
import { runAdvisorSpecialists, type SpecialistOutput } from './specialists.js';
import { validateAdvisorResponse } from './qaValidator.js';
import {
  analyzeAdvisorFiles,
  createGeminiInlineFileExtractorFromEnv,
  type DocumentIntakeOptions,
} from './documentIntake.js';
import {
  createAdvisorConversationResponderFromEnv,
  type AdvisorConversationResponder,
} from './conversationResponder.js';
import type { AdvisorTurnUnderstanding } from './turnUnderstanding.js';
import type { AdvisorRunStore } from './runStore.js';
import { createAdvisorLlmResponseWriterFromEnv } from './responseWriter.js';

export type AdvisorResponseWriterInput = {
  input: AdvisorChatInput;
  intent: AdvisorIntent;
  snapshot: EnergySnapshot;
  metrics: AdvisorMetrics;
  specialistOutput: SpecialistOutput;
  understanding?: AdvisorTurnUnderstanding;
  conversationContext?: ConversationContext;
};

export type AdvisorOrchestratorOptions = {
  snapshotBuilder?: (input: EnergySnapshotInput) => Promise<EnergySnapshot>;
  responseWriter?: (input: AdvisorResponseWriterInput) => string | Promise<string>;
  fileAiExtractor?: NonNullable<DocumentIntakeOptions['aiExtractor']>;
  conversationResponder?: AdvisorConversationResponder;
  runStore?: AdvisorRunStore;
  userToken?: string;
  conversationContext?: ConversationContext;
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

function buildEmptyInteractionMetrics(input: AdvisorChatInput): AdvisorMetrics {
  return {
    companyId: input.companyId,
    nemo: input.nemo,
    period: input.period ?? null,
    totalConsumptionMwh: null,
    contractedMwh: null,
    spotMwh: null,
    spotExposurePct: null,
    contractCoveragePct: null,
    spotCostPesos: null,
    invoiceTotalPesos: null,
    costDtePesosMwh: null,
    renewableYtdPct: null,
    renewableGapYtdMwh: null,
    estimatedRenewablePenaltyPesos: null,
    riskScore: null,
  };
}

function isLightweightInteraction(
  intent: AdvisorIntent,
  understanding: AdvisorTurnUnderstanding,
): intent is 'greeting' | 'conversation' {
  return !understanding.shouldRunAnalysis && (intent === 'greeting' || intent === 'conversation');
}

function buildGuidedDiagnosisResponse(input: AdvisorResponseWriterInput): string {
  const { snapshot, metrics, specialistOutput } = input;
  const lines = [
    'Te ayudo. Lo vamos a leer en terminos de negocio, no de tabla tecnica.',
    `Para empezar, mire el periodo ${snapshot.resolvedPeriod ?? snapshot.requestedPeriod ?? 'disponible'} de ${companyLabel(snapshot)} y voy a ordenar el diagnostico en costos, consumo, facturas/contratos y riesgos.`,
  ];

  const businessFindings: string[] = [];
  if (metrics.totalConsumptionMwh !== null) {
    businessFindings.push(`Consumo: el sistema registra ${formatNumber(metrics.totalConsumptionMwh)} MWh de demanda real.`);
  }
  if (metrics.invoiceTotalPesos !== null) {
    businessFindings.push(`Costo: la facturacion/DTE disponible es ARS ${formatMoneyRaw(metrics.invoiceTotalPesos)}${metrics.costDtePesosMwh !== null ? `, equivalente a ARS ${formatNumber(metrics.costDtePesosMwh)} por MWh` : ''}.`);
  }
  if (metrics.spotExposurePct !== null) {
    businessFindings.push(`Riesgo: la exposicion spot estimada es ${formatPct(metrics.spotExposurePct)}, que conviene revisar porque puede mover el costo final.`);
  }

  if (businessFindings.length > 0) {
    lines.push('', ...businessFindings.slice(0, 3).map((finding) => `- ${finding}`));
  } else {
    lines.push('', '- Todavia no veo datos suficientes para cuantificar el diagnostico; el primer paso es completar consumo, facturacion y contratos en EnergyOS/Data Room.');
  }

  const firstRecommendation = specialistOutput.recommendations[0];
  if (firstRecommendation) {
    const action = firstRecommendation.id === 'review_spot_coverage'
      ? 'revisar si una parte importante de la energia esta quedando expuesta a precio variable y si conviene ajustar la cobertura contractual'
      : firstRecommendation.action.replace(/\.$/, '');
    const reason = firstRecommendation.reason.charAt(0).toLowerCase() + firstRecommendation.reason.slice(1).replace(/\.$/, '');
    lines.push('', `Siguiente paso: ${action}. Lo priorizo porque ${reason}.`);
  } else if (specialistOutput.missingData.length > 0) {
    lines.push('', `Siguiente paso: completar ${specialistOutput.missingData.slice(0, 3).join(', ')} para que el diagnostico sea mas confiable.`);
  } else {
    lines.push('', 'Siguiente paso: revisemos primero que parte del costo queres bajar o entender mejor: factura, consumo o cobertura contractual.');
  }

  return lines.join('\n');
}

function buildDeterministicResponse(input: AdvisorResponseWriterInput): string {
  const { intent, snapshot, metrics, specialistOutput } = input;

  if (intent === 'greeting') return buildGreeting(snapshot);
  if (intent === 'guided_diagnosis') return buildGuidedDiagnosisResponse(input);

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
  let runId: string | null = null;

  const route = routeAdvisorTurn({
    question: input.question,
    files: input.files,
  });
  const { intent, understanding } = route;

  try {
    runId = await options.runStore?.create({
      companyId: input.companyId,
      period: input.period ?? null,
      nemo: input.nemo,
      input: {
        question: input.question,
        includePrivateContext: input.includePrivateContext,
        conversationId: input.conversationId,
        filesCount: input.files.length,
      },
    }) ?? null;

    if (isLightweightInteraction(intent, understanding)) {
      const conversationResponder = options.conversationResponder ?? await createAdvisorConversationResponderFromEnv();
      const response = await conversationResponder({ input, intent, understanding });
      const output = AdvisorRunOutputSchema.parse({
        response,
        intent,
        companyId: input.companyId,
        companyName: input.companyName,
        nemo: input.nemo,
        period: input.period ?? null,
        conversationId: input.conversationId,
        metrics: buildEmptyInteractionMetrics(input),
        findings: [],
        recommendations: [],
        missingData: [],
        limitations: [],
        dataUsed: [],
        evidence: [],
        filesReceived: input.files as AdvisorFile[],
        fileAnalyses: [],
        qa: {
          passed: true,
          issues: [],
        },
      });

      await options.runStore?.complete({
        runId,
        output: output as unknown as Record<string, unknown>,
      });

      return output;
    }

    const snapshot = await snapshotBuilder({
      companyId: input.companyId,
      companyName: input.companyName,
      nemo: input.nemo,
      period: input.period,
      includePrivateContext: input.includePrivateContext,
      userToken: options.userToken,
    });

    const metrics = calculateAdvisorMetrics(snapshot);
    const fileAnalyses = await analyzeAdvisorFiles(input.files, {
      aiExtractor: options.fileAiExtractor ?? createGeminiInlineFileExtractorFromEnv() ?? undefined,
    });
    const specialistOutput = runAdvisorSpecialists({
      intent,
      snapshot,
      metrics,
      files: input.files,
    });

    const writerInput = {
      input,
      intent,
      snapshot,
      metrics,
      specialistOutput,
      understanding,
      conversationContext: options.conversationContext,
    };
    const envWriter = options.responseWriter ? null : await createAdvisorLlmResponseWriterFromEnv();
    const response = options.responseWriter
      ? await options.responseWriter(writerInput)
      : envWriter
        ? await envWriter(writerInput)
        : buildDeterministicResponse(writerInput);

    const qa = validateAdvisorResponse({ response, snapshot });
    const finalResponse = qa.correctedResponse ?? response;

    const output = AdvisorRunOutputSchema.parse({
      response: finalResponse,
      intent,
      companyId: input.companyId,
      companyName: input.companyName,
      nemo: input.nemo,
      period: snapshot.resolvedPeriod,
      conversationId: input.conversationId,
      metrics,
      findings: specialistOutput.findings,
      recommendations: specialistOutput.recommendations,
      missingData: specialistOutput.missingData,
      limitations: specialistOutput.limitations,
      dataUsed: snapshot.dataUsed,
      evidence: specialistOutput.evidence,
      filesReceived: input.files as AdvisorFile[],
      fileAnalyses,
      qa: {
        passed: qa.passed,
        issues: qa.issues,
      },
    });

    await options.runStore?.complete({
      runId,
      output: output as unknown as Record<string, unknown>,
    });

    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    await options.runStore?.fail({ runId, error: message });
    throw error;
  }
}
