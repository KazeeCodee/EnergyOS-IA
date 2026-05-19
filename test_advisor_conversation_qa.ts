import assert from 'node:assert/strict';
import { validateConversationResponse } from './src/advisor/conversationQa.js';
import { understandAdvisorTurn } from './src/advisor/turnUnderstanding.js';

const guidedQuestion = 'Como estas ? mira yo soy el director de esta empresa y pague por este sistema. se que tengo problemas con las finanzas energeticas pero no se leer los datos. ayudame';
const guidedUnderstanding = understandAdvisorTurn({ question: guidedQuestion, files: [] });

const ignoredHelp = validateConversationResponse({
  question: guidedQuestion,
  understanding: guidedUnderstanding,
  response: 'Bien, listo para ayudarte con ACINDAR PTA. V. CONSTITUCION (ACINVCSZ). Decime que queres revisar y voy directo al punto.',
});

assert.equal(ignoredHelp.passed, false);
assert.equal(ignoredHelp.reason, 'guided_help_ignored');

const vagueFollowup = validateConversationResponse({
  question: guidedQuestion,
  understanding: guidedUnderstanding,
  response: 'Decime que queres revisar y respondo segun el pedido.',
});

assert.equal(vagueFollowup.passed, false);
assert.equal(vagueFollowup.reason, 'vague_followup_after_user_context');

const goodGuidedResponse = validateConversationResponse({
  question: guidedQuestion,
  understanding: guidedUnderstanding,
  response: 'Te ayudo. Vamos a ordenar los datos energeticos en costos, consumo y facturas para entender que problema financiero conviene atacar primero.',
});

assert.equal(goodGuidedResponse.passed, true);

const pureGreeting = validateConversationResponse({
  question: 'Hola, como estas?',
  understanding: understandAdvisorTurn({ question: 'Hola, como estas?', files: [] }),
  response: 'Bien, listo para ayudarte con ACINDAR PTA. V. CONSTITUCION (ACINVCSZ). Decime que queres revisar y voy directo al punto.',
});

assert.equal(pureGreeting.passed, true);

const badIdentity = validateConversationResponse({
  question: 'Que sos ?',
  understanding: understandAdvisorTurn({ question: 'Que sos ?', files: [] }),
  response: 'Estoy listo para ayudarte con ACINDAR PTA. V. CONSTITUCION. Decime que queres revisar.',
});

assert.equal(badIdentity.passed, false);
assert.equal(badIdentity.reason, 'identity_question_ignored');

const goodIdentity = validateConversationResponse({
  question: 'Que sos ?',
  understanding: understandAdvisorTurn({ question: 'Que sos ?', files: [] }),
  response: 'Soy EnergyOS Advisor. Te ayudo a entender datos energeticos y convertirlos en decisiones claras.',
});

assert.equal(goodIdentity.passed, true);

const badReassurance = validateConversationResponse({
  question: 'Pero quiero saber si realmente me vas a ayudar ? estas para mi atencion ?',
  understanding: understandAdvisorTurn({
    question: 'Pero quiero saber si realmente me vas a ayudar ? estas para mi atencion ?',
    files: [],
  }),
  response: 'Te leo. Soy EnergyOS Advisor y puedo ayudarte. Decime que queres entender o revisar.',
});

assert.equal(badReassurance.passed, false);
assert.equal(badReassurance.reason, 'reassurance_ignored');

const goodReassurance = validateConversationResponse({
  question: 'Pero quiero saber si realmente me vas a ayudar ? estas para mi atencion ?',
  understanding: understandAdvisorTurn({
    question: 'Pero quiero saber si realmente me vas a ayudar ? estas para mi atencion ?',
    files: [],
  }),
  response: 'Si, estoy aca para ayudarte de verdad y acompañarte paso a paso.',
});

assert.equal(goodReassurance.passed, true);

console.log('advisor conversation qa tests passed');
