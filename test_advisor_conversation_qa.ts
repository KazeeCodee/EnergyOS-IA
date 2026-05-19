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

console.log('advisor conversation qa tests passed');
