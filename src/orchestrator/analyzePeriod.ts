import type { AgentAnalysisOutput } from '../schemas/agentOutput.schema.js';
import type { EnergyMetrics } from '../schemas/metrics.schema.js';
import type { ClientPrivateContext } from '../schemas/clientPrivateContext.schema.js';
import { getCompanyProfile, getPeriodData, getHistoricalData, getExposicionData } from '../tools/dataRetriever.js';
import { calculateMetrics } from '../tools/metricsEngine.js';
import { detectAnomalies } from '../tools/anomalyDetector.js';
import { getClientPrivateContext } from '../tools/clientPrivateContext.js';
import { analyzeContractRisks } from '../tools/contractRiskAnalyzer.js';
import { createAgentRun, completeAgentRun, failAgentRun } from '../memory/agentRuns.js';
import { saveFindings } from '../memory/findings.js';
import { saveRecommendations } from '../memory/recommendations.js';
import { IDEAL_HISTORICAL_MONTHS } from '../config/constants.js';
import { runAgenticLoop } from '../reasoning/agenticLoop.js';
import { createProviderFromEnv } from '../providers/factory.js';

export type AnalyzePeriodOptions = {
  nemo?: string;
  includePrivateContext?: boolean;
  userToken?: string;
};

async function analyzeWithAgent(
  companyId: string,
  period: string,
  options: AnalyzePeriodOptions = {},
): Promise<{ analysis: string; steps: unknown[]; model: string; tokens: { input: number; output: number } }> {
  const provider = createProviderFromEnv();
  if (!provider) {
    throw new Error('No hay proveedor de IA configurado');
  }

  const taskMessage = `Analiza el periodo ${period} de la empresa ${companyId}${options.nemo ? ` (NEMO ${options.nemo})` : ''}.

Segui estos pasos:
1. Primero obtene el perfil de la empresa con get_company_profile
2. Calcula las metricas del periodo con calculate_metrics
3. Ejecuta la deteccion de anomalias con detect_anomalies
4. Si hay NEMO y necesitas contexto contractual, obtene el Data Room con get_client_private_context
5. Si encontras hallazgos relevantes, busca datos historicos o de exposicion para contextualizar
6. Interpreta los resultados y genera un diagnostico completo

Tu respuesta final debe incluir:
- Resumen ejecutivo (2-3 oraciones)
- Hallazgos ordenados por impacto
- Recomendaciones accionables
- Datos faltantes y limitaciones`;

  const result = await runAgenticLoop(provider, taskMessage, { userToken: options.userToken });

  return {
    analysis: result.response,
    steps: result.steps,
    model: result.model,
    tokens: result.totalTokens,
  };
}

async function maybeLoadPrivateContext(
  nemo: string,
  options: AnalyzePeriodOptions,
  limitations: string[],
  missingData: string[],
): Promise<ClientPrivateContext | null> {
  if (!options.includePrivateContext) return null;

  const result = await getClientPrivateContext({
    nemo,
    userToken: options.userToken,
  });

  if (result.ok && result.context) return result.context;

  if (result.limitation) limitations.push(result.limitation);
  if (!missingData.includes('contexto privado Data Room')) {
    missingData.push('contexto privado Data Room');
  }
  return null;
}

async function analyzeWithoutAgent(
  companyId: string,
  period: string,
  options: AnalyzePeriodOptions = {},
): Promise<AgentAnalysisOutput> {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));

  const company = await getCompanyProfile(companyId);
  if (!company) {
    throw new Error(`Empresa no encontrada: ${companyId}`);
  }

  const [currentData, previousData, historicalData] = await Promise.all([
    getPeriodData(companyId, year, month),
    getPeriodData(companyId, month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1),
    getHistoricalData(companyId, year, month, IDEAL_HISTORICAL_MONTHS),
  ]);

  const exposicionData = await getExposicionData(company.nemo, 24);

  const metrics: EnergyMetrics = calculateMetrics({
    companyId,
    period,
    currentData,
    previousData,
    historicalData,
    exposicionData,
  });

  const anomalyResult = detectAnomalies({ metrics, historicalData });
  const findings = [...anomalyResult.findings];
  const recommendations = [...anomalyResult.recommendations];

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const dataUsed: string[] = [];
  const missingData: string[] = [];
  const limitations: string[] = ['Modo deterministico: sin interpretacion por IA.'];

  if (currentData) dataUsed.push(`datos_mensuales ${period}`);
  else missingData.push(`datos del periodo ${period}`);

  if (previousData) dataUsed.push(`datos_mensuales ${prevYear}-${String(prevMonth).padStart(2, '0')}`);
  else missingData.push('periodo anterior');

  if (historicalData.length > 0) dataUsed.push(`historial de ${historicalData.length} meses`);
  if (exposicionData.length > 0) dataUsed.push(`exposicion spot (${exposicionData.length} meses)`);
  else missingData.push('datos de exposicion spot');

  limitations.push('Sin facturas/DTE y detalle contractual completo no se pueden confirmar causas exactas.');

  let privateContext: ClientPrivateContext | null = null;
  const requestedNemo = options.nemo ?? company.nemo;
  privateContext = await maybeLoadPrivateContext(requestedNemo, options, limitations, missingData);

  if (privateContext) {
    dataUsed.push(`Data Room privado ${privateContext.nemo}`);
    const contractRisk = analyzeContractRisks({ period, metrics, context: privateContext });

    findings.push(...contractRisk.findings);
    recommendations.push(...contractRisk.recommendations);
    limitations.push(...contractRisk.limitations);
    for (const item of contractRisk.missingData) {
      if (!missingData.includes(item)) missingData.push(item);
    }
    for (const item of privateContext.missingData) {
      if (!missingData.includes(item.message)) missingData.push(item.message);
    }
  }

  for (const f of findings) {
    if (f.missingData) {
      for (const md of f.missingData) {
        if (!missingData.includes(md)) missingData.push(md);
      }
    }
  }

  const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  findings.sort((a, b) => (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0));
  recommendations.sort((a, b) => (severityOrder[b.priority] ?? 0) - (severityOrder[a.priority] ?? 0));

  const criticalFindings = findings.filter(f => f.severity === 'critical').length;
  const highFindings = findings.filter(f => f.severity === 'high').length;

  const overallStatus = criticalFindings > 0
    ? 'critical' as const
    : highFindings > 0 ? 'attention_required' as const : 'normal' as const;

  const riskLevel = criticalFindings > 0
    ? 'critical' as const
    : highFindings > 0 ? 'high' as const
      : findings.length > 0 ? 'medium' as const : 'low' as const;

  const hasCurrentData = currentData !== null;
  const hasPreviousData = previousData !== null;
  const hasExposicion = exposicionData.length > 0;
  const confidence = hasCurrentData && hasPreviousData && hasExposicion
    ? 'high' as const : hasCurrentData ? 'medium' as const : 'low' as const;

  const normalizedRecommendations = recommendations.map(r => ({
    ...r,
    status: r.status ?? 'pending' as const,
  }));

  const executiveSummary = generateDeterministicSummary(metrics, findings.length, criticalFindings, highFindings, missingData);

  return {
    companyId,
    period,
    executiveSummary,
    overallStatus,
    riskLevel,
    findings,
    recommendations: normalizedRecommendations,
    missingData,
    dataUsed,
    confidence,
    limitations,
    privateContextUsed: privateContext !== null,
    privateContextSummary: privateContext ? {
      nemo: privateContext.nemo,
      completenessPct: privateContext.completeness.overallPct,
      contractsCount: privateContext.contracts.length,
      warningsCount: privateContext.warnings.length,
      missingDataCount: privateContext.missingData.length,
    } : undefined,
    evidence: privateContext?.evidence.map(item => ({
      id: item.id,
      documentType: item.documentType,
      fileName: item.fileName,
      entityType: item.entityType,
      entityId: item.entityId,
      evidenceNote: item.evidenceNote,
    })),
  };
}

function generateDeterministicSummary(
  metrics: EnergyMetrics, total: number, critical: number, high: number, missing: string[],
): string {
  const parts: string[] = [];
  if (metrics.totalConsumptionMwh === null && metrics.totalCost === null) {
    return 'No hay datos suficientes del periodo para generar un diagnostico.';
  }
  if (critical > 0) parts.push('El periodo requiere atencion urgente.');
  else if (high > 0) parts.push('El periodo requiere atencion.');
  else if (total > 0) parts.push('El periodo presenta senales a observar.');
  else parts.push('El periodo no presenta alertas relevantes.');

  if (metrics.costVsConsumptionDelta !== null && metrics.costVsConsumptionDelta > 0.10) {
    const costPct = metrics.costChangePct !== null ? `${(metrics.costChangePct * 100).toFixed(0)}%` : '-';
    const consPct = metrics.consumptionChangePct !== null ? `${(metrics.consumptionChangePct * 100).toFixed(0)}%` : '-';
    parts.push(`El costo aumento ${costPct} mientras el consumo solo cambio ${consPct}.`);
  }
  if (metrics.spotExposurePct !== null && metrics.spotExposurePct > 0.40) {
    parts.push(`La exposicion spot esta en ${(metrics.spotExposurePct * 100).toFixed(0)}%.`);
  }
  if (missing.length > 0) parts.push(`Faltan ${missing.length} dato(s) para un diagnostico completo.`);
  return parts.join(' ');
}

export async function analyzePeriod(
  companyId: string,
  period: string,
  options: AnalyzePeriodOptions = {},
): Promise<AgentAnalysisOutput> {
  const runId = await createAgentRun(companyId, period, 'analyze_period', { companyId, period, ...options });

  try {
    const provider = createProviderFromEnv();

    if (provider) {
      console.log('Modo AGENTICO activado');

      const agentResult = await analyzeWithAgent(companyId, period, options);
      const deterministicOutput = await analyzeWithoutAgent(companyId, period, options);

      const output: AgentAnalysisOutput = {
        ...deterministicOutput,
        executiveSummary: agentResult.analysis,
        limitations: [
          ...deterministicOutput.limitations.filter(l => !l.includes('sin interpretacion')),
          `Analizado por ${agentResult.model} (${agentResult.tokens.input + agentResult.tokens.output} tokens)`,
        ],
      };

      if (runId) {
        await completeAgentRun(runId, output);
        await saveFindings(runId, companyId, period, output.findings);
        await saveRecommendations(companyId, period, deterministicOutput.recommendations);
      }

      return output;
    }

    console.log('Modo DETERMINISTICO (sin IA)');

    const output = await analyzeWithoutAgent(companyId, period, options);

    if (runId) {
      await completeAgentRun(runId, output);
      await saveFindings(runId, companyId, period, output.findings);
      await saveRecommendations(companyId, period, output.recommendations);
    }

    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    if (runId) await failAgentRun(runId, message);
    throw error;
  }
}
