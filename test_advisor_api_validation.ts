import assert from 'node:assert/strict';
import advisorChatApi from './src/api/advisor-chat.js';
import advisorTasksApi from './src/api/advisor-tasks.js';

async function readJson(response: Response) {
  return response.json() as Promise<{ error?: string; details?: unknown }>;
}

async function testAdvisorChatRejectsInvalidJson() {
  const response = await advisorChatApi.request('/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"message":',
  });

  assert.equal(response.status, 400);
  const body = await readJson(response);
  assert.equal(body.error, 'Input invalido');
  assert.equal(body.details, 'JSON invalido');
}

async function testAdvisorTasksRejectsInvalidJson() {
  const response = await advisorTasksApi.request('/approve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"nemo":',
  });

  assert.equal(response.status, 400);
  const body = await readJson(response);
  assert.equal(body.error, 'Input invalido');
  assert.equal(body.details, 'JSON invalido');
}

await testAdvisorChatRejectsInvalidJson();
await testAdvisorTasksRejectsInvalidJson();

console.log('test_advisor_api_validation OK');
