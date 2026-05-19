import type { AdvisorChatInput } from '../schemas/advisor.schema.js';
import type { AIProvider } from '../providers/types.js';

export type AdvisorConversationResponderInput = {
  input: AdvisorChatInput;
  intent: 'greeting' | 'conversation';
};

export type AdvisorConversationResponder = (
  input: AdvisorConversationResponderInput,
) => string | Promise<string>;

export type AdvisorConversationResponderOptions = {
  provider?: AIProvider | null;
};

type ConversationAct = 'identity' | 'thanks' | 'acknowledgement' | 'greeting' | 'generic';

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
  if (act === 'thanks') return `De nada. Cuando quieras, seguimos con ${label}.`;
  if (act === 'acknowledgement') return `Perfecto. Quedo atento para revisar lo que necesites de ${label}.`;

  if (act === 'greeting') {
    if (/\bcomo estas\b/i.test(normalize(question))) {
      return `Bien, listo para ayudarte con ${label}. Decime que queres revisar y voy directo al punto.`;
    }
    return `Hola. Estoy listo para ayudarte con ${label}.`;
  }

  return `Te leo. Soy EnergyOS Advisor y puedo ayudarte con ${label}. Decime que queres entender o revisar, y si hace falta analizar datos lo hago recien cuando me lo pidas.`;
}

function buildIdentityResponse(label: string): string {
  return [
    `Soy EnergyOS Advisor, un asistente especializado en analisis y consultoria de datos energeticos para ${label}.`,
    'Mi funcion es ayudarte a entender costos, consumo, contratos, facturas, cumplimiento renovable, desvios y prioridades de accion cuando me lo pidas.',
    'Si me haces una pregunta general te respondo directo; si me pedis un analisis, reviso los datos disponibles y te marco que falta completar.',
  ].join(' ');
}

function buildSystemPrompt(): string {
  return [
    'Sos el front desk conversacional de EnergyOS Advisor.',
    'Tu trabajo es responder preguntas sociales, de identidad, de funcion, ayuda o alcance del asistente.',
    'No ejecutes analisis energetico, no uses herramientas, no inventes metricas y no des recomendaciones operativas.',
    'No incluyas MWh, ARS, porcentajes, nombres de mercados, siglas tecnicas ni hallazgos si el usuario no pidio una tarea analitica.',
    'Responde de tu a tu, claro, humano, profesional y breve. Maximo 3 oraciones.',
    'Si el usuario pregunta que sos o cual es tu funcion, explica que sos EnergyOS Advisor y que ayudas a analizar costos, consumo, contratos, facturas, cumplimiento renovable y acciones cuando el usuario lo pide.',
  ].join('\n');
}

export function createAdvisorConversationResponder(options: AdvisorConversationResponderOptions): AdvisorConversationResponder {
  const provider = options.provider;

  return async (input) => {
    const fallback = buildFallbackConversationResponse(input);
    if (getConversationAct(input) !== 'generic') return fallback;
    if (!provider) return fallback;

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
          }, null, 2),
        }],
        [],
      );
      const text = response.text?.trim();
      if (!text || containsAnalyticOutput(text)) return fallback;
      return text;
    } catch {
      return fallback;
    }
  };
}

export async function createAdvisorConversationResponderFromEnv(): Promise<AdvisorConversationResponder> {
  let cachedProvider: AIProvider | null | undefined;

  return async (input) => {
    if (getConversationAct(input) !== 'generic') {
      return buildFallbackConversationResponse(input);
    }

    if (cachedProvider === undefined) {
      const { createProviderFromEnv } = await import('../providers/factory.js');
      cachedProvider = createProviderFromEnv();
    }

    return createAdvisorConversationResponder({ provider: cachedProvider })(input);
  };
}
