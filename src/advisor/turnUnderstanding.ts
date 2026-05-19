import type { AdvisorFile } from '../schemas/advisor.schema.js';

export type AdvisorDomainIntent =
  | 'guided_diagnosis'
  | 'monthly_summary'
  | 'invoice'
  | 'contract'
  | 'compliance'
  | 'document_intake'
  | 'action_plan'
  | 'report'
  | 'general_question';

export type AdvisorPrimaryAct =
  | 'social_only'
  | 'identity'
  | 'thanks'
  | 'acknowledgement'
  | 'guided_help'
  | 'analytic_request'
  | 'generic_conversation';

export type AdvisorResponseMode =
  | 'social'
  | 'identity'
  | 'guided_onboarding'
  | 'analysis'
  | 'conversation';

export type AdvisorUserRole = 'director' | 'manager' | 'operator' | null;

export type AdvisorTurnUnderstanding = {
  socialOpener: boolean;
  primaryAct: AdvisorPrimaryAct;
  domainIntent: AdvisorDomainIntent | null;
  responseMode: AdvisorResponseMode;
  shouldRunAnalysis: boolean;
  userRole: AdvisorUserRole;
  dataLiteracyNeed: boolean;
  businessPain: boolean;
};

export type AdvisorTurnInput = {
  question: string;
  files?: AdvisorFile[];
};

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{Letter}\p{Number}\s]/gu, ' ')
    .replace(/\s+/g, ' ');
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
      if (token.length >= 4 && (token.includes(target) || target.includes(token))) return true;
      const maxDistance = target.length <= 5 ? 1 : 2;
      return Math.abs(token.length - target.length) <= maxDistance && levenshtein(token, target) <= maxDistance;
    }),
  );
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function hasSocialSignal(text: string): boolean {
  return hasAny(text, [
    /(^|\s)h+o+l+a+(\s|$)/i,
    /\bbuen dia\b/i,
    /\bbuenos dias\b/i,
    /\bbuenas\b/i,
    /\bcomo estas\b/i,
    /\btodo bien\b/i,
    /\bque tal\b/i,
    /\bcomo va\b/i,
  ]);
}

function isThanks(text: string): boolean {
  return /\b(gracias|muchas gracias|te agradezco)\b/i.test(text);
}

function isAcknowledgement(text: string): boolean {
  return /^(ok|dale|perfecto|genial|listo|entendido|joya|bien)\s*$/i.test(text);
}

function isIdentityQuestion(text: string): boolean {
  return (
    hasAny(text, [
      /\bque sos\b/i,
      /\bquien sos\b/i,
      /\bque eres\b/i,
      /\bquien eres\b/i,
      /\bque haces\b/i,
      /\bcomo funcionas\b/i,
      /\bpara que sirves\b/i,
      /\bpara que servis\b/i,
      /\bque podes hacer\b/i,
      /\bque puedes hacer\b/i,
      /\bcomo me ayudas\b/i,
      /\bnecesito ayuda\b/i,
      /\bayuda\b/i,
    ])
    || hasApproxToken(text, ['funcion', 'funciones', 'sirves', 'servis'])
  );
}

function inferUserRole(text: string): AdvisorUserRole {
  if (hasApproxToken(text, ['director', 'directora', 'dueno', 'duena', 'ceo', 'presidente'])) return 'director';
  if (hasApproxToken(text, ['gerente', 'manager', 'jefe', 'responsable'])) return 'manager';
  if (hasApproxToken(text, ['operador', 'analista', 'usuario'])) return 'operator';
  return null;
}

function hasHelpSignal(text: string): boolean {
  return (
    /\bayud\w*\b/i.test(text)
    || /\bnecesito\b/i.test(text)
    || /\bno se\b/i.test(text)
    || /\bno entiendo\b/i.test(text)
    || /\bexplic\w*\b/i.test(text)
  );
}

function hasDataLiteracySignal(text: string): boolean {
  return hasAny(text, [
    /\bno se\b.*\b(leer|interpretar|entender)\b/i,
    /\bno entiendo\b.*\b(datos|numeros|facturas|costos|consumo)\b/i,
    /\bleer\b.*\b(datos|numeros|facturas|costos|consumo)\b/i,
    /\bexplic\w*\b.*\b(simple|claro|facil|negocio)\b/i,
  ]);
}

function hasBusinessPain(text: string): boolean {
  return (
    hasAny(text, [
      /\bproble\w*\b/i,
      /\bfinanz\w*\b/i,
      /\bcosto\w*\b/i,
      /\bfactur\w*\b/i,
      /\benergia\b/i,
      /\benerget\w*\b/i,
      /\bpague\b/i,
      /\bpago\b/i,
      /\bcaro\b/i,
      /\briesgo\b/i,
    ])
    || hasApproxToken(text, ['problemas', 'finanzas'])
  );
}

function inferDomainIntent(text: string): AdvisorDomainIntent {
  if (hasAny(text, [/factura/, /\bdte\b/, /liquidacion/, /concepto/, /audit/, /reconcili/])) return 'invoice';
  if (hasAny(text, [/contrato/, /\bmater\b/, /\bppa\b/, /cobertura/, /vencimiento/, /descalce/])) return 'contract';
  if (hasAny(text, [/27191/, /renovable/, /cumplimiento/, /multa/, /brecha/])) return 'compliance';
  if (hasAny(text, [/plan de accion/, /accion/, /tarea/, /prioridad/])) return 'action_plan';
  if (hasAny(text, [/reporte/, /informe/, /pdf/, /ejecutivo/])) return 'report';
  if (hasAny(text, [/resumen/, /ultimo mes/, /periodo/, /mes/, /costo/, /consumo/, /spot/])) return 'monthly_summary';
  return 'general_question';
}

function hasAnalyticSignal(text: string): boolean {
  return hasAny(text, [
    /resumen|analiza|analisis|costo|consumo|factura|dte|contrato|mater|ppa|ley|27191|renovable|reporte|informe|accion|plan|spot|periodo|mes|demanda|desvio|riesgo|cumplimiento|auditoria|conciliacion|vencimiento/i,
  ]);
}

export function understandAdvisorTurn(input: AdvisorTurnInput): AdvisorTurnUnderstanding {
  const text = normalize(input.question);
  const socialOpener = hasSocialSignal(text);
  const userRole = inferUserRole(text);
  const dataLiteracyNeed = hasDataLiteracySignal(text);
  const businessPain = hasBusinessPain(text);
  const helpSignal = hasHelpSignal(text);

  if ((input.files?.length ?? 0) > 0) {
    return {
      socialOpener,
      primaryAct: 'analytic_request',
      domainIntent: 'document_intake',
      responseMode: 'analysis',
      shouldRunAnalysis: true,
      userRole,
      dataLiteracyNeed,
      businessPain,
    };
  }

  if (helpSignal && (dataLiteracyNeed || businessPain || userRole)) {
    return {
      socialOpener,
      primaryAct: 'guided_help',
      domainIntent: 'guided_diagnosis',
      responseMode: 'guided_onboarding',
      shouldRunAnalysis: true,
      userRole,
      dataLiteracyNeed,
      businessPain,
    };
  }

  if (isIdentityQuestion(text)) {
    return {
      socialOpener,
      primaryAct: 'identity',
      domainIntent: null,
      responseMode: 'identity',
      shouldRunAnalysis: false,
      userRole,
      dataLiteracyNeed,
      businessPain,
    };
  }

  if (isThanks(text)) {
    return {
      socialOpener,
      primaryAct: 'thanks',
      domainIntent: null,
      responseMode: 'conversation',
      shouldRunAnalysis: false,
      userRole,
      dataLiteracyNeed,
      businessPain,
    };
  }

  if (isAcknowledgement(text)) {
    return {
      socialOpener,
      primaryAct: 'acknowledgement',
      domainIntent: null,
      responseMode: 'conversation',
      shouldRunAnalysis: false,
      userRole,
      dataLiteracyNeed,
      businessPain,
    };
  }

  if (hasAnalyticSignal(text)) {
    return {
      socialOpener,
      primaryAct: 'analytic_request',
      domainIntent: inferDomainIntent(text),
      responseMode: 'analysis',
      shouldRunAnalysis: true,
      userRole,
      dataLiteracyNeed,
      businessPain,
    };
  }

  if (socialOpener) {
    return {
      socialOpener,
      primaryAct: 'social_only',
      domainIntent: null,
      responseMode: 'social',
      shouldRunAnalysis: false,
      userRole,
      dataLiteracyNeed,
      businessPain,
    };
  }

  return {
    socialOpener,
    primaryAct: 'generic_conversation',
    domainIntent: null,
    responseMode: 'conversation',
    shouldRunAnalysis: false,
    userRole,
    dataLiteracyNeed,
    businessPain,
  };
}
