/**
 * Tool Executor — Ejecuta las herramientas que el LLM solicita.
 *
 * El LLM envía un tool_call con nombre y argumentos.
 * Este módulo mapea ese nombre a la función real y la ejecuta.
 */

import {
  getCompanyProfile,
  getPeriodData,
  getHistoricalData,
  getExposicionData,
  getMarketData,
  getPreviousAgentAnalysis,
} from './dataRetriever.js';
import { calculateMetrics, type MetricsEngineInput } from './metricsEngine.js';
import { detectAnomalies } from './anomalyDetector.js';
import { getClientPrivateContext } from './clientPrivateContext.js';
import { IDEAL_HISTORICAL_MONTHS } from '../config/constants.js';

export type ToolCallResult = {
  success: boolean;
  data: unknown;
  error?: string;
};

export type ToolExecutionContext = {
  userToken?: string;
};

/**
 * Ejecuta una herramienta por nombre con los argumentos provistos.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext = {},
): Promise<ToolCallResult> {
  try {
    switch (toolName) {
      case 'get_company_profile': {
        const companyId = args.company_id as string;
        const profile = await getCompanyProfile(companyId);
        if (!profile) {
          return { success: false, data: null, error: `Empresa no encontrada: ${companyId}` };
        }
        return { success: true, data: profile };
      }

      case 'get_period_data': {
        const data = await getPeriodData(
          args.company_id as string,
          args.year as number,
          args.month as number,
        );
        if (!data) {
          return {
            success: true,
            data: null,
            error: `No hay datos para ${args.year}-${String(args.month).padStart(2, '0')}`,
          };
        }
        return { success: true, data };
      }

      case 'get_historical_data': {
        const data = await getHistoricalData(
          args.company_id as string,
          args.year as number,
          args.month as number,
          (args.months_back as number) ?? IDEAL_HISTORICAL_MONTHS,
        );
        return {
          success: true,
          data: {
            months_returned: data.length,
            data,
          },
        };
      }

      case 'get_exposure_data': {
        const data = await getExposicionData(
          args.nemo as string,
          (args.months as number) ?? 24,
        );
        return {
          success: true,
          data: {
            months_returned: data.length,
            data,
          },
        };
      }

      case 'calculate_metrics': {
        const companyId = args.company_id as string;
        const period = args.period as string;
        const year = Number(period.slice(0, 4));
        const month = Number(period.slice(5, 7));

        // Obtener todos los datos necesarios
        const [currentData, previousData, historicalData, profile] = await Promise.all([
          getPeriodData(companyId, year, month),
          getPeriodData(companyId, month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1),
          getHistoricalData(companyId, year, month, IDEAL_HISTORICAL_MONTHS),
          getCompanyProfile(companyId),
        ]);

        // Obtener exposición si tenemos el NEMO
        let exposicionData = [] as Awaited<ReturnType<typeof getExposicionData>>;
        if (profile?.nemo) {
          exposicionData = await getExposicionData(profile.nemo, 24);
        }

        const input: MetricsEngineInput = {
          companyId,
          period,
          currentData,
          previousData,
          historicalData,
          exposicionData,
        };

        const metrics = calculateMetrics(input);
        return { success: true, data: metrics };
      }

      case 'detect_anomalies': {
        const companyId = args.company_id as string;
        const period = args.period as string;
        const year = Number(period.slice(0, 4));
        const month = Number(period.slice(5, 7));

        // Primero calcular métricas
        const [currentData, previousData, historicalData, profile] = await Promise.all([
          getPeriodData(companyId, year, month),
          getPeriodData(companyId, month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1),
          getHistoricalData(companyId, year, month, IDEAL_HISTORICAL_MONTHS),
          getCompanyProfile(companyId),
        ]);

        let exposicionData = [] as Awaited<ReturnType<typeof getExposicionData>>;
        if (profile?.nemo) {
          exposicionData = await getExposicionData(profile.nemo, 24);
        }

        const metrics = calculateMetrics({
          companyId,
          period,
          currentData,
          previousData,
          historicalData,
          exposicionData,
        });

        const result = detectAnomalies({ metrics, historicalData });
        return {
          success: true,
          data: {
            metrics_summary: {
              totalConsumptionMwh: metrics.totalConsumptionMwh,
              totalCost: metrics.totalCost,
              avgCostPerMwh: metrics.avgCostPerMwh,
              costChangePct: metrics.costChangePct,
              consumptionChangePct: metrics.consumptionChangePct,
              costVsConsumptionDelta: metrics.costVsConsumptionDelta,
              spotExposurePct: metrics.spotExposurePct,
              renewableCompliancePct: metrics.renewableCompliancePct,
              riskScore: metrics.riskScore,
            },
            findings_count: result.findings.length,
            findings: result.findings,
            recommendations: result.recommendations,
          },
        };
      }

      case 'get_market_data': {
        const data = await getMarketData(args.year as number, args.month as number);
        return { success: true, data: data ?? { message: 'No hay datos de mercado para este período' } };
      }

      case 'get_previous_analysis': {
        const data = await getPreviousAgentAnalysis(
          args.company_id as string,
          args.period as string,
        );
        return {
          success: true,
          data: data ?? { message: 'No hay análisis previo para este período' },
        };
      }

      case 'get_client_private_context': {
        const result = await getClientPrivateContext({
          nemo: args.nemo as string,
          userToken: context.userToken,
        });
        if (!result.ok) {
          return { success: false, data: null, error: result.limitation };
        }
        return { success: true, data: result.context };
      }

      default:
        return { success: false, data: null, error: `Herramienta desconocida: ${toolName}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error(`Error executing tool ${toolName}:`, error);
    return { success: false, data: null, error: message };
  }
}
