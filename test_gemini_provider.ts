import assert from 'node:assert/strict';
import { createProvider, createProviderFromEnv } from './src/providers/factory.js';

const provider = createProvider({
  provider: 'gemini',
  apiKey: 'test-key',
  model: 'gemini-1.5-pro',
});

assert.equal(provider.name, 'gemini');
assert.equal(provider.model, 'gemini-1.5-pro');

const previousGeminiKey = process.env.GEMINI_API_KEY;
const previousGeminiModel = process.env.GEMINI_MODEL;
const previousOpenAIKey = process.env.OPENAI_API_KEY;
const previousAnthropicKey = process.env.ANTHROPIC_API_KEY;

delete process.env.OPENAI_API_KEY;
delete process.env.ANTHROPIC_API_KEY;
process.env.GEMINI_API_KEY = 'test-key';
process.env.GEMINI_MODEL = 'gemini-2.5-flash';

const envProvider = createProviderFromEnv();
assert.equal(envProvider?.name, 'gemini');
assert.equal(envProvider?.model, 'gemini-2.5-flash');

restoreEnv('GEMINI_API_KEY', previousGeminiKey);
restoreEnv('GEMINI_MODEL', previousGeminiModel);
restoreEnv('OPENAI_API_KEY', previousOpenAIKey);
restoreEnv('ANTHROPIC_API_KEY', previousAnthropicKey);

console.log('Gemini provider test passed');

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
