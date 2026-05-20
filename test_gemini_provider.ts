import assert from 'node:assert/strict';
import { createProvider, createProviderFromEnv } from './src/providers/factory.js';
import { GeminiProvider } from './src/providers/gemini.js';

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

const successfulProvider = new GeminiProvider('test-key', 'gemini-test', {
  fetchImpl: async () => new Response(JSON.stringify({
    candidates: [{
      content: {
        role: 'model',
        parts: [{ text: 'ok' }],
      },
      finishReason: 'STOP',
    }],
    usageMetadata: {
      promptTokenCount: 2,
      candidatesTokenCount: 1,
    },
  }), { status: 200 }),
});

const successfulResponse = await successfulProvider.chat('system', [{ role: 'user', content: 'hola' }], []);
assert.equal(successfulResponse.text, 'ok');

const timeoutProvider = new GeminiProvider('test-key', 'gemini-timeout', {
  timeoutMs: 5,
  fetchImpl: (_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    });
  }),
});

await assert.rejects(
  () => timeoutProvider.chat('system', [{ role: 'user', content: 'hola' }], []),
  /Gemini API timeout/,
);

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
