import type { AdvisorChatInput, AdvisorRuntime, ConversationContext } from '../schemas/advisor.schema.js';
import type { AIProvider } from '../providers/types.js';
import { validateConversationResponse } from './conversationQa.js';
import { understandAdvisorTurn, type AdvisorTurnUnderstanding } from './turnUnderstanding.js';

export type AdvisorConversationResponderInput = {
  input: AdvisorChatInput;
  intent: 'greeting' | 'conversation';
  understanding?: AdvisorTurnUnderstanding;
  conversationContext?: ConversationContext;
  routerSource?: AdvisorRuntime['routerSource'];
};

export type AdvisorConversationResponse = {
  text: string;
  runtime: AdvisorRuntime;
};

export type AdvisorConversationResponder = (
  input: AdvisorConversationResponderInput,
) => string | AdvisorConversationResponse | Promise<string | AdvisorConversationResponse>;

export type AdvisorConversationResponderOptions = {
  provider?: AIProvider | null;
};

type ConversationAct = 'identity' | 'reassurance' | 'thanks' | 'acknowledgement' | 'greeting' | 'guided_help' | 'generic';

type FallbackReason =
  | 'provider_unavailable'
  | 'provider_error'
  | 'analytic_output_rejected'
  | 'empty_llm_response'
  | `qa_rejected:${string}`;

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{Letter}\p{Number}\s]/gu, ' ')
    .replace(/\s+/g, ' ');
}

function inputCompanyLabel(input: AdvisorChatInput): string {
  return input.companyName ? `${input.companyName} (${input.nemo})` : input.nemo;
}

function runtimeForProvider(provider: AIProvider, routerSource: AdvisorRuntime['routerSource']): AdvisorRuntime {
  return {
    responseSource: 'llm',
    provider: provider.name as AdvisorRuntime['provider'],
    model: provider.model,
    fallbackReason: null,
    routerSource,
  };
}

function runtimeForFallback(
  reason: FallbackReason,
  routerSource: AdvisorRuntime['routerSource'],
): AdvisorRuntime {
  return {
    responseSource: 'deterministic_fallback',
    provider: 'energyos',
    model: null,
    fallbackReason: reason,
    routerSource,
  };
}

function tokens(text: string): string[] {
  return normalize(text).split(' ').filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}

function hasApproxToken(text: string, targets: string[]): boolean {
  return tokens(text).some((token) =>
    targets.some((target) => {
      if (token === target) return true;
      const maxDistance = target.length <= 5 ? 1 : 2;
      return Math.abs(token.length - target.length) <= maxDistance && levenshtein(token, target) <= maxDistance;
    }),
  );
}

function isAcknowledgement(text: string): boolean {
  return /^(ok|dale|perfecto|genial|listo|entendido|joya|bien)[\s.!?]*$/i.test(normalize(text));
}

function isThanks(text: string): boolean {
  return /\b(gracias|muchas gracias|te agradezco)\b/i.test(normalize(text));
}

function isIdentityOrCapabilityQuestion(text: string): boolean {
  const value = normalize(text);
  return (
    /\b(que sos|quien sos|que eres|quien eres|que haces|como funcionas|para que sirves|para que servis|que podes hacer|que puedes hacer|como me ayudas|necesito ayuda|ayuda)\b/i.test(value)
    || hasApproxToken(value, ['funcion', 'funciones', 'sirves', 'servis'])
  );
}

function isGreetingOrSocial(text: string): boolean {
  return /\b(h+o+l+a+|buen dia|buenos dias|buenas|como estas|todo bien|que tal|como va)\b/i.test(normalize(text));
}

export function containsAnalyticOutput(text: string): boolean {
  return /(consumo total|demanda real|exposicion spot|compra spot|costo dte|factura total|puntaje de riesgo|cumplimiento renovable|hallazgos|recomendacion|resumen de rendimiento|\bmwh\b|\bars\b|\bmater\b|\bppa\b|ley 27\.?191)/i.test(text);
}

function getConversationAct(input: AdvisorConversationResponderInput): ConversationAct {
  const question = input.input.question;

  if (input.understanding?.primaryAct === 'guided_help') return 'guided_help';
  if (input.understanding?.primaryAct === 'identity') return 'identity';
  if (input.understanding?.primaryAct === 'reassurance') return 'reassurance';
  if (input.understanding?.primaryAct === 'thanks') return 'thanks';
  if (input.understanding?.primaryAct === 'acknowledgement') return 'acknowledgement';
  if (input.understanding?.primaryAct === 'social_only') return 'greeting';

  if (isIdentityOrCapabilityQuestion(question)) return 'identity';
  if (isThanks(question)) return 'thanks';
  if (isAcknowledgement(question)) return 'acknowledgement';
  if (input.intent === 'greeting' || isGreetingOrSocial(question)) return 'greeting';

  return 'generic';
}

export function buildFallbackConversationResponse(input: AdvisorConversationResponderInput): string {
  const label = inputCompanyLabel(input.input);
  const question = input.input.question;
  const act = getConversationAct(input);

  if (act === 'identity') return buildIdentityResponse(label);
  if (act === 'reassurance') return buildReassuranceResponse(label);
  if (act === 'guided_help') return buildGuidedHelpResponse(label);
  if (act === 'thanks') return `De nada. Cuando quieras, seguimos con ${label}.`;
  if (act === 'acknowledgement') return `Perfecto. Quedo atento para revisar lo que necesites de ${label}.`;

  if (act === 'greeting') {
    if (/\bcomo estas\b/i.test(normalize(question))) {
      return `Bien, aca y listo para ayudarte con ${label}.`;
    }
    return `Hola. Estoy listo para ayudarte con ${label}.`;
  }

  return `Te leo. Soy EnergyOS Advisor y puedo ayudarte con ${label}. Si hace falta analizar datos, lo hago recien cuando me lo pidas.`;
}

function buildIdentityResponse(label: string): string {
  return [
    `Soy EnergyOS Advisor, un asistente especializado en analisis y consultoria de datos energeticos para ${label}.`,
    'Mi funcion es ayudarte a entender costos, consumo, contratos, facturas, cumplimiento renovable, desvios y prioridades de accion cuando me lo pidas.',
    'Si me haces una pregunta general te respondo directo; si me pedis un analisis, reviso los datos disponibles y te marco que falta completar.',
  ].join(' ');
}

function buildReassuranceResponse(label: string): string {
  return [
    `Si, estoy aca y te voy a ayudar con ${label}.`,
    'No necesito que sepas leer los datos de entrada: mi trabajo es traducirlos a algo claro, priorizado y accionable.',
    'Podemos ir paso a paso, empezando por lo que mas te preocupe o por un diagnostico inicial del ultimo periodo disponible.',
  ].join(' ');
}

function buildGuidedHelpResponse(label: string): string {
  return [
    'Te ayudo. Vamos a ordenar esto en lenguaje de negocio, no como una tabla tecnica.',
    `Para ${label}, el primer mapa es costos, consumo, facturas/contratos y riesgos.`,
    'Cuando me pidas avanzar, arranco con un diagnostico guiado del periodo disponible y te marco que significa cada dato.',
  ].join(' ');
}

function buildSystemPrompt(): string {
  return [
    'Sos la capa conversacional humana de EnergyOS Advisor.',
    'Tu trabajo es responder bien el turno del usuario cuando NO corresponde ejecutar analisis de datos.',
    'No sos una plantilla ni un menu. Responde al sentido completo del mensaje actual y al historial breve: saludo, duda, confianza, identidad, frustracion, ayuda o aclaracion.',
    'Si el usuario busca confianza o atencion, contene y confirma que estas para ayudarlo.',
    'Si pregunta que sos o tu funcion, explica quien sos y para que servís.',
    'Si el usuario necesita ayuda para entender datos pero aun no pidio un analisis concreto, ofrece ordenar el problema y propone un primer paso sin ejecutar metricas.',
    'Si saluda, saluda natural sin disparar analisis.',
    'No ejecutes analisis energetico, no uses herramientas, no inventes metricas y no des recomendaciones operativas.',
    'No incluyas MWh, ARS, porcentajes, nombres de mercados, siglas tecnicas ni hallazgos si el usuario no pidio una tarea analitica.',
    'No respondas con "Decime que queres revisar" si el usuario ya hizo una pregunta humana concreta.',
    'Responde de tu a tu, claro, humano, profesional y breve. Maximo 3 oraciones.',
  ].join('\n');
}

function compactConversationContext(context: ConversationContext | undefined) {
  if (!context) return null;
  return {
    summary: context.summary,
    recentMessages: context.recentMessages.slice(-8).map((message) => ({
      role: message.role,
      content: message.content,
      intent: message.intent,
    })),
    memory: context.memory,
  };
}

export function createAdvisorConversationResponder(options: AdvisorConversationResponderOptions): AdvisorConversationResponder {
  const provider = options.provider;

  return async (input) => {
    const routerSource = input.routerSource ?? 'deterministic';
    const enrichedInput = input.understanding
      ? input
      : {
        ...input,
        understanding: understandAdvisorTurn({
          question: input.input.question,
          files: input.input.files,
        }),
      };
    const fallback = buildFallbackConversationResponse(enrichedInput);
    if (!provider) {
      return {
        text: fallback,
        runtime: runtimeForFallback('provider_unavailable', routerSource),
      };
    }

    try {
      const response = await provider.chat(
        buildSystemPrompt(),
        [{
          role: 'user',
          content: JSON.stringify({
            question: input.input.question,
            companyName: input.input.companyName,
            nemo: input.input.nemo,
            period: input.input.period ?? null,
            conversationalAct: getConversationAct(enrichedInput),
            understanding: enrichedInput.understanding ?? null,
            conversationContext: compactConversationContext(input.conversationContext),
          }, null, 2),
        }],
        [],
      );
      const text = response.text?.trim();
      if (!text) {
        return {
          text: fallback,
          runtime: runtimeForFallback('empty_llm_response', routerSource),
        };
      }
      if (containsAnalyticOutput(text)) {
        return {
          text: fallback,
          runtime: runtimeForFallback('analytic_output_rejected', routerSource),
        };
      }
      if (enrichedInput.understanding) {
        const qa = validateConversationResponse({
          question: input.input.question,
          understanding: enrichedInput.understanding,
          response: text,
        });
        if (!qa.passed) {
          return {
            text: fallback,
            runtime: runtimeForFallback(`qa_rejected:${qa.reason ?? 'unknown'}`, routerSource),
          };
        }
      }
      return {
        text,
        runtime: runtimeForProvider(provider, routerSource),
      };
    } catch (error) {
      console.error('Advisor conversation provider error:', error instanceof Error ? error.message : error);
      return {
        text: fallback,
        runtime: runtimeForFallback('provider_error', routerSource),
      };
    }
  };
}

export async function createAdvisorConversationResponderFromEnv(): Promise<AdvisorConversationResponder> {
  let cachedProvider: AIProvider | null | undefined;

  return async (input) => {
    if (cachedProvider === undefined) {
      const { createProviderFromEnv } = await import('../providers/factory.js');
      cachedProvider = createProviderFromEnv();
    }

    return createAdvisorConversationResponder({ provider: cachedProvider })(input);
  };
}
