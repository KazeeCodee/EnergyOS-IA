import type { AdvisorTurnUnderstanding } from './turnUnderstanding.js';

export type ConversationQaInput = {
  question: string;
  understanding: AdvisorTurnUnderstanding;
  response: string;
};

export type ConversationQaResult = {
  passed: boolean;
  reason?:
    | 'guided_help_ignored'
    | 'vague_followup_after_user_context'
    | 'social_only_response_to_substantive_turn'
    | 'identity_question_ignored'
    | 'reassurance_ignored';
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

function looksLikePureGreeting(response: string): boolean {
  const text = normalize(response);
  if (/^(hola|bien)\b/i.test(text) && /decime que queres revisar|estoy listo|listo para ayudarte/i.test(text)) {
    return true;
  }
  return /^(hola|bien|estoy listo|listo para ayudarte|te leo)\b/i.test(text)
    && !/\b(costo|consumo|factura|finanz|dato|problema|ayud|orden|empecemos)\b/i.test(text);
}

function asksVagueFollowup(response: string): boolean {
  return /decime que queres revisar|que queres revisar|respondo segun el pedido|voy directo al punto/i.test(normalize(response));
}

function acknowledgesGuidedNeed(response: string): boolean {
  return /\b(te ayudo|vamos a ordenar|empecemos|datos|costos|consumo|facturas|finanz|problema|diagnostico)\b/i.test(normalize(response));
}

function answersIdentity(response: string): boolean {
  const text = normalize(response);
  return /\bsoy\b.*\benergyos advisor\b/i.test(text)
    && /\b(ayud|datos|energet|analisis|decisiones|consultor|asistente)\b/i.test(text);
}

function reassuresUser(response: string): boolean {
  const text = normalize(response);
  return /\b(si|claro|por supuesto|estoy aca|estoy para ayudarte|te voy a ayudar|voy a ayudarte)\b/i.test(text)
    && /\b(ayud|acompan|paso a paso|atencion|calma|resolver)\b/i.test(text);
}

export function validateConversationResponse(input: ConversationQaInput): ConversationQaResult {
  if (input.understanding.primaryAct === 'identity' && !answersIdentity(input.response)) {
    return { passed: false, reason: 'identity_question_ignored' };
  }

  if (input.understanding.primaryAct === 'reassurance') {
    if (asksVagueFollowup(input.response) || !reassuresUser(input.response)) {
      return { passed: false, reason: 'reassurance_ignored' };
    }
  }

  if (input.understanding.primaryAct === 'guided_help') {
    if (looksLikePureGreeting(input.response)) {
      return { passed: false, reason: 'guided_help_ignored' };
    }

    if (asksVagueFollowup(input.response)) {
      return { passed: false, reason: 'vague_followup_after_user_context' };
    }

    if (!acknowledgesGuidedNeed(input.response)) {
      return { passed: false, reason: 'guided_help_ignored' };
    }
  }

  if (
    input.question.trim().length > 80
    && input.understanding.primaryAct !== 'social_only'
    && looksLikePureGreeting(input.response)
  ) {
    return { passed: false, reason: 'social_only_response_to_substantive_turn' };
  }

  return { passed: true };
}
