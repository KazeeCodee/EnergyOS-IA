import type { AdvisorFile } from '../schemas/advisor.schema.js';
import { understandAdvisorTurn, type AdvisorTurnUnderstanding } from './turnUnderstanding.js';

export type AdvisorIntent =
  | 'greeting'
  | 'conversation'
  | 'guided_diagnosis'
  | 'monthly_summary'
  | 'invoice'
  | 'contract'
  | 'compliance'
  | 'document_intake'
  | 'action_plan'
  | 'report'
  | 'general_question';

export type IntentInput = {
  question: string;
  files?: AdvisorFile[];
};

export type AdvisorTurnRoute = {
  intent: AdvisorIntent;
  understanding: AdvisorTurnUnderstanding;
};

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ');
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function hasAnalyticSignal(text: string): boolean {
  return /(resumen|analiza|analisis|costo|consumo|factura|dte|contrato|mater|ppa|ley|27191|renovable|reporte|informe|accion|plan|spot|periodo|mes|demanda|desvio|riesgo|cumplimiento|auditoria|conciliacion|vencimiento)/i.test(text);
}

function hasGreetingSignal(text: string): boolean {
  return /(^|[\s,.;:!?])(?:h+o+l+a+|buen dia|buenos dias|buenas|hey|hello)(?=$|[\s,.;:!?])/i.test(text);
}

function hasSocialQuestion(text: string): boolean {
  return /\b(como estas|todo bien|que tal|como va)\b/i.test(text);
}

function hasDirectTaskRequest(text: string): boolean {
  return /\b(dame|resumime|resumi|analiza|analizame|revisa|revisame|genera|generame|arma|prepara|calcula|concilia|mostrame|explica)\b/i.test(text);
}

export function isReadinessConversation(question: string): boolean {
  const text = normalize(question);
  const readinessSignal = /(^|\b)(como estas\b.*\blisto|estas listo|estas preparado|estas disponible|listo para|preparado para|podemos empezar|podemos arrancar|arrancamos)\b/i.test(text);
  return readinessSignal && !hasDirectTaskRequest(text);
}

export function classifyAdvisorIntent(input: IntentInput): AdvisorIntent {
  return routeAdvisorTurn(input).intent;
}

export function routeAdvisorTurn(input: IntentInput): AdvisorTurnRoute {
  const question = normalize(input.question);
  const understanding = understandAdvisorTurn(input);

  if (understanding.domainIntent) {
    return {
      intent: understanding.domainIntent,
      understanding,
    };
  }

  if ((input.files?.length ?? 0) > 0) return { intent: 'document_intake', understanding };

  if (isReadinessConversation(input.question)) return { intent: 'conversation', understanding };

  const hasAnalyticIntent = hasAnalyticSignal(question);
  if (!hasAnalyticIntent) {
    if (hasGreetingSignal(question) && hasSocialQuestion(question)) return { intent: 'conversation', understanding };
    if (hasGreetingSignal(question)) return { intent: 'greeting', understanding };

    if (hasAny(question, [
      /^como estas[?!. ]*$/,
      /^todo bien[?!. ]*$/,
      /^gracias[!?. ]*$/,
      /^muchas gracias[!?. ]*$/,
      /^ok[!?. ]*$/,
      /^dale[!?. ]*$/,
      /^perfecto[!?. ]*$/,
      /^genial[!?. ]*$/,
      /^listo[!?. ]*$/,
      /^entendido[!?. ]*$/,
      /^quien sos[?!. ]*$/,
      /^que podes hacer[?!. ]*$/,
      /^como me ayudas[?!. ]*$/,
      /^me ayudas[?!. ]*$/,
      /^ayuda[?!. ]*$/,
      /^necesito ayuda[?!. ]*$/,
    ])) {
      return { intent: 'conversation', understanding };
    }

    return { intent: 'conversation', understanding };
  }

  if (hasAny(question, [/factura/, /\bdte\b/, /liquidacion/, /concepto/, /audit/, /reconcili/])) {
    return { intent: 'invoice', understanding };
  }

  if (hasAny(question, [/contrato/, /\bmater\b/, /\bppa\b/, /cobertura/, /vencimiento/, /descalce/])) {
    return { intent: 'contract', understanding };
  }

  if (hasAny(question, [/27191/, /renovable/, /cumplimiento/, /multa/, /brecha/])) {
    return { intent: 'compliance', understanding };
  }

  if (hasAny(question, [/plan de accion/, /accion/, /tarea/, /prioridad/])) {
    return { intent: 'action_plan', understanding };
  }

  if (hasAny(question, [/reporte/, /informe/, /pdf/, /ejecutivo/])) {
    return { intent: 'report', understanding };
  }

  if (hasAny(question, [/resumen/, /ultimo mes/, /periodo/, /mes/, /costo/, /consumo/, /spot/])) {
    return { intent: 'monthly_summary', understanding };
  }

  return { intent: 'general_question', understanding };
}
