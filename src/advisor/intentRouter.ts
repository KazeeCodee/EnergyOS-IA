import type { AdvisorFile } from '../schemas/advisor.schema.js';

export type AdvisorIntent =
  | 'greeting'
  | 'conversation'
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

function hasDirectTaskRequest(text: string): boolean {
  return /\b(dame|resumime|resumi|analiza|analizame|revisa|revisame|genera|generame|arma|prepara|calcula|concilia|mostrame|explica)\b/i.test(text);
}

export function isReadinessConversation(question: string): boolean {
  const text = normalize(question);
  const readinessSignal = /(^|\b)(como estas\b.*\blisto|estas listo|estas preparado|estas disponible|listo para|preparado para|podemos empezar|podemos arrancar|arrancamos)\b/i.test(text);
  return readinessSignal && !hasDirectTaskRequest(text);
}

export function classifyAdvisorIntent(input: IntentInput): AdvisorIntent {
  const question = normalize(input.question);

  if ((input.files?.length ?? 0) > 0) return 'document_intake';

  if (isReadinessConversation(input.question)) return 'conversation';

  const hasAnalyticIntent = hasAnalyticSignal(question);
  if (/^(hola( buen(os)? dias?)?|buen dia|buenos dias|buenas|hey|hello)(,? como estas)?[.!? ]*$/i.test(question) && !hasAnalyticIntent) {
    return 'greeting';
  }

  if (!hasAnalyticIntent && hasAny(question, [
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
    /^ayuda[?!. ]*$/,
    /^necesito ayuda[?!. ]*$/,
  ])) {
    return 'conversation';
  }

  if (hasAny(question, [/factura/, /\bdte\b/, /liquidacion/, /concepto/, /audit/, /reconcili/])) {
    return 'invoice';
  }

  if (hasAny(question, [/contrato/, /\bmater\b/, /\bppa\b/, /cobertura/, /vencimiento/, /descalce/])) {
    return 'contract';
  }

  if (hasAny(question, [/27191/, /renovable/, /cumplimiento/, /multa/, /brecha/])) {
    return 'compliance';
  }

  if (hasAny(question, [/plan de accion/, /accion/, /tarea/, /prioridad/])) {
    return 'action_plan';
  }

  if (hasAny(question, [/reporte/, /informe/, /pdf/, /ejecutivo/])) {
    return 'report';
  }

  if (hasAny(question, [/resumen/, /ultimo mes/, /periodo/, /mes/, /costo/, /consumo/, /spot/])) {
    return 'monthly_summary';
  }

  return 'general_question';
}
