import assert from 'node:assert/strict';
import { understandAdvisorTurn } from './src/advisor/turnUnderstanding.js';

const pureGreeting = understandAdvisorTurn({
  question: 'Hola, como estas?',
  files: [],
});

assert.equal(pureGreeting.socialOpener, true);
assert.equal(pureGreeting.primaryAct, 'social_only');
assert.equal(pureGreeting.shouldRunAnalysis, false);
assert.equal(pureGreeting.responseMode, 'social');
assert.equal(pureGreeting.domainIntent, null);

const identityQuestion = understandAdvisorTurn({
  question: 'Cual es tu fuicnion?',
  files: [],
});

assert.equal(identityQuestion.primaryAct, 'identity');
assert.equal(identityQuestion.shouldRunAnalysis, false);
assert.equal(identityQuestion.responseMode, 'identity');
assert.equal(identityQuestion.domainIntent, null);

const guidedHelp = understandAdvisorTurn({
  question: 'Como estas? soy el director, pague por este sistema, tengo problemas con las finanzas energeticas y no se leer los datos. ayudame',
  files: [],
});

assert.equal(guidedHelp.socialOpener, true);
assert.equal(guidedHelp.primaryAct, 'guided_help');
assert.equal(guidedHelp.userRole, 'director');
assert.equal(guidedHelp.dataLiteracyNeed, true);
assert.equal(guidedHelp.businessPain, true);
assert.equal(guidedHelp.shouldRunAnalysis, true);
assert.equal(guidedHelp.domainIntent, 'guided_diagnosis');
assert.equal(guidedHelp.responseMode, 'guided_onboarding');

const directAnalysis = understandAdvisorTurn({
  question: 'dame un resumen del ultimo mes',
  files: [],
});

assert.equal(directAnalysis.primaryAct, 'analytic_request');
assert.equal(directAnalysis.shouldRunAnalysis, true);
assert.equal(directAnalysis.domainIntent, 'monthly_summary');
assert.equal(directAnalysis.responseMode, 'analysis');

console.log('advisor turn understanding tests passed');
