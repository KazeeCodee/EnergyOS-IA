import type { AdvisorFile } from '../schemas/advisor.schema.js';

export type AdvisorIntent =
  | 'greeting'
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

export function classifyAdvisorIntent(input: IntentInput): AdvisorIntent {
  const question = normalize(input.question);

  if ((input.files?.length ?? 0) > 0) return 'document_intake';

  const analyticWords = /(resumen|analiza|costo|consumo|factura|dte|contrato|mater|ley|27191|renovable|reporte|accion|plan)/i;
  if (/^(hola( buen(os)? dias?)?|buen dia|buenos dias|buenas|hey|hello)(,? como estas)?[.!? ]*$/i.test(question) && !analyticWords.test(question)) {
    return 'greeting';
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
