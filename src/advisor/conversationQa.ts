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
    | 'reassurance_ignored'
    | 'asks_user_to_choose_client'
    | 'analytic_output_in_conversation';
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
  const hasIdentity = /\b(soy|me llamo|funciono como|mi funcion es|estoy para)\b/i.test(text)
    && /\b(energyos advisor|advisor|asistente|consultor|asesor)\b/i.test(text);
  return hasIdentity
    && /\b(ayud|datos|energet|analisis|decisiones|consultor|asistente|costos|consumo|facturas|contratos)\b/i.test(text);
}

function reassuresUser(response: string): boolean {
  const text = normalize(response);
  return /\b(si|claro|por supuesto|estoy aca|estoy para|te voy a ayudar|voy a ayudarte|estoy con vos|te acompano)\b/i.test(text)
    && /\b(ayud|acompan|paso a paso|atencion|calma|resolver|ordenar|entender|trabajar)\b/i.test(text);
}

function asksUserToChooseClient(response: string): boolean {
  return /\b(elegi|elige|selecciona|decime|indicame)\b.*\b(cliente|empresa|nemo)\b/i.test(normalize(response));
}

function containsAnalyticOutput(response: string): boolean {
  return /(consumo total|demanda real|exposicion spot|compra spot|costo dte|factura total|puntaje de riesgo|cumplimiento renovable|\bmwh\b|\bars\b|\bmater\b|ley 27\.?191)/i.test(response);
}

export function validateConversationResponse(input: ConversationQaInput): ConversationQaResult {
  if (asksUserToChooseClient(input.response)) {
    return { passed: false, reason: 'asks_user_to_choose_client' };
  }

  if (input.understanding.primaryAct !== 'analytic_request' && containsAnalyticOutput(input.response)) {
    return { passed: false, reason: 'analytic_output_in_conversation' };
  }

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
