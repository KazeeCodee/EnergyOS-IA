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
  const guidedMode = input.intent === 'guided_diagnosis' || input.understanding?.responseMode === 'guided_onboarding';
  const systemLines = [
    'Sos EnergyOS Advisor, consultor experto en datos energeticos del MEM argentino.',
    'Redacta una respuesta clara y accionable para el usuario.',
    'No inventes datos, precios, contratos, facturas ni conclusiones no respaldadas.',
    'Usa exclusivamente las metricas, hallazgos, recomendaciones, datos usados y faltantes enviados.',
    'Si falta informacion, no la cierres como bloqueo generico: indica que completar y donde completarla en EnergyOS o en el Data Room cuando se pueda inferir.',
    'No uses encabezados como "Limitaciones de la informacion"; usa un cierre operativo tipo "Para afinar esto, falta completar...".',
    'No pidas elegir cliente: el cliente y NEMO ya estan autorizados.',
    'Responde en espanol profesional, directo y sin relleno.',
  ];

  if (guidedMode) {
    systemLines.push(
      'Modo guided_onboarding: el usuario necesita ayuda para leer datos energeticos y convertirlos en decisiones de negocio.',
      'Responde en terminos de negocio, no de tabla tecnica.',
      'Usa un tono de asesor humano con frases como "Te ayudo", "empecemos" o "vamos a ordenar".',
      'No descargues un informe completo ni sobrecargues con jerga; da el primer diagnostico y un siguiente paso concreto.',
    );
  }

  return {
    system: systemLines.join('\n'),
    user: JSON.stringify({
      question: input.input.question,
      intent: input.intent,
      understanding: input.understanding ?? null,
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
