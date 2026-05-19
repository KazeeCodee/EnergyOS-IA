import assert from 'node:assert/strict';
import { getProviderStatusFromEnv } from './src/providers/status.js';

const originalEnv = { ...process.env };

function restoreEnv() {
  process.env = { ...originalEnv };
}

restoreEnv();
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.GEMINI_API_KEY;
delete process.env.GOOGLE_AI_API_KEY;
delete process.env.GEMINI_MODEL;
delete process.env.GOOGLE_AI_MODEL;
delete process.env.ENABLE_ADVISOR_LLM_WRITER;

assert.deepEqual(getProviderStatusFromEnv(), {
  configured: false,
  provider: null,
  model: null,
  advisorLlmWriterEnabled: false,
});

process.env.GEMINI_API_KEY = 'test-key';
process.env.GEMINI_MODEL = 'gemini-2.5-flash';
process.env.ENABLE_ADVISOR_LLM_WRITER = 'true';

assert.deepEqual(getProviderStatusFromEnv(), {
  configured: true,
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  advisorLlmWriterEnabled: true,
});

process.env.OPENAI_API_KEY = 'test-openai';
process.env.OPENAI_MODEL = 'gpt-4o';

assert.deepEqual(getProviderStatusFromEnv(), {
  configured: true,
  provider: 'openai',
  model: 'gpt-4o',
  advisorLlmWriterEnabled: true,
});

restoreEnv();

console.log('provider status tests passed');
