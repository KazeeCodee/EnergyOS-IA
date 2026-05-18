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
import { classifyAdvisorIntent, type AdvisorIntent } from './intentRouter.js';
import { runAdvisorSpecialists, type SpecialistOutput } from './specialists.js';
import { validateAdvisorResponse } from './qaValidator.js';
import {
  analyzeAdvisorFiles,
  createGeminiInlineFileExtractorFromEnv,
  type DocumentIntakeOptions,
} from './documentIntake.js';
import type { AdvisorRunStore } from './runStore.js';
import { createAdvisorLlmResponseWriterFromEnv } from './responseWriter.js';

export type AdvisorResponseWriterInput = {
  input: AdvisorChatInput;
  intent: AdvisorIntent;
  snapshot: EnergySnapshot;
  metrics: AdvisorMetrics;
  specialistOutput: SpecialistOutput;
  conversationContext?: ConversationContext;
};

export type AdvisorOrchestratorOptions = {
  snapshotBuilder?: (input: EnergySnapshotInput) => Promise<EnergySnapshot>;
  responseWriter?: (input: AdvisorResponseWriterInput) => string | Promise<string>;
  fileAiExtractor?: NonNullable<DocumentIntakeOptions['aiExtractor']>;
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

function inputCompanyLabel(input: AdvisorChatInput): string {
  return input.companyName ? `${input.companyName} (${input.nemo})` : input.nemo;
}

function buildGreetingFromInput(input: AdvisorChatInput): string {
  const period = input.period ? ` del periodo ${input.period}` : '';
  return `Hola, buen dia. Estoy listo para ayudarte con ${inputCompanyLabel(input)}${period}. Decime que queres revisar y lo vemos con datos: costos, consumo, spot, contratos, facturas o cumplimiento renovable.`;
}

function buildConversationResponse(input: AdvisorChatInput): string {
  const question = input.question
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  const label = inputCompanyLabel(input);

  if (/gracias|muchas gracias/.test(question)) {
    return `De nada. Cuando quieras, puedo ayudarte a revisar ${label} con datos concretos: costos, consumo, spot, contratos, facturas o cumplimiento renovable.`;
  }

  if (/^(ok|dale|perfecto|genial|listo|entendido)[!?. ]*$/.test(question)) {
    return `Perfecto. Quedo atento para revisar lo que necesites de ${label}.`;
  }

  if (/quien sos|que podes hacer|como me ayudas|ayuda|necesito ayuda/.test(question)) {
    return `Soy EnergyOS Advisor. Trabajo sobre ${label} y te puedo ayudar a entender costos, consumo, exposicion spot, contratos MATER/PPA, facturas/DTE, cumplimiento renovable, desvios y prioridades de accion. Si queres, pedime algo concreto, por ejemplo: "resumime el ultimo mes", "por que subio el costo" o "que contrato deberia revisar".`;
  }

  if (/como estas|todo bien/.test(question)) {
    return `Bien, listo para ayudarte con ${label}. Decime que queres revisar y voy directo al punto.`;
  }

  return `Estoy listo para ayudarte con ${label}. Decime que queres revisar y respondo segun el pedido, sin correr analisis si no hace falta.`;
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

function isLightweightInteraction(intent: AdvisorIntent): boolean {
  return intent === 'greeting' || intent === 'conversation';
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
  let runId: string | null = null;

  const intent = classifyAdvisorIntent({
    question: input.question,
    files: input.files,
  });

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

    if (isLightweightInteraction(intent)) {
      const output = AdvisorRunOutputSchema.parse({
        response: intent === 'greeting' ? buildGreetingFromInput(input) : buildConversationResponse(input),
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
