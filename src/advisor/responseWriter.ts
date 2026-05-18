import type { AIProvider } from '../providers/types.js';
import type { AdvisorResponseWriterInput } from './orchestrator.js';

export type AdvisorWriterMessages = {
  system: string;
  user: string;
};

export type AdvisorLlmResponseWriterOptions = {
  provider: AIProvider;
};

export function buildAdvisorWriterMessages(input: AdvisorResponseWriterInput): AdvisorWriterMessages {
  return {
    system: [
      'Sos EnergyOS Advisor, consultor experto en datos energeticos del MEM argentino.',
      'Redacta una respuesta clara y accionable para el usuario.',
      'No inventes datos, precios, contratos, facturas ni conclusiones no respaldadas.',
      'Usa exclusivamente las metricas, hallazgos, recomendaciones, datos usados y faltantes enviados.',
      'Si falta informacion, declarala como limitacion parcial. No digas que no hay datos si hay metricas disponibles.',
      'No pidas elegir cliente: el cliente y NEMO ya estan autorizados.',
      'Responde en espanol profesional, directo y sin relleno.',
    ].join('\n'),
    user: JSON.stringify({
      question: input.input.question,
      intent: input.intent,
      companyName: input.input.companyName,
      nemo: input.input.nemo,
      period: input.snapshot.resolvedPeriod,
      metrics: input.metrics,
      findings: input.specialistOutput.findings,
      recommendations: input.specialistOutput.recommendations,
      missingData: input.specialistOutput.missingData,
      limitations: input.specialistOutput.limitations,
      dataUsed: input.snapshot.dataUsed,
      evidence: input.specialistOutput.evidence,
      conversationContext: input.conversationContext ? {
        summary: input.conversationContext.summary,
        recentMessages: input.conversationContext.recentMessages.map((message) => ({
          role: message.role,
          content: message.content,
          intent: message.intent,
          createdAt: message.createdAt,
        })),
        memory: input.conversationContext.memory,
      } : null,
    }, null, 2),
  };
}

export function createAdvisorLlmResponseWriter(options: AdvisorLlmResponseWriterOptions) {
  return async (input: AdvisorResponseWriterInput): Promise<string> => {
    const messages = buildAdvisorWriterMessages(input);
    const response = await options.provider.chat(
      messages.system,
      [{ role: 'user', content: messages.user }],
      [],
    );

    return response.text?.trim() || 'No se pudo redactar una respuesta con IA.';
  };
}

export async function createAdvisorLlmResponseWriterFromEnv() {
  if (process.env.ENABLE_ADVISOR_LLM_WRITER !== 'true') return null;
  const { createProviderFromEnv } = await import('../providers/factory.js');
  const provider = createProviderFromEnv();
  if (!provider) return null;
  return createAdvisorLlmResponseWriter({ provider });
}
