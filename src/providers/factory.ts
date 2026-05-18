/**
 * Factory de proveedores IA.
 *
 * Lee la configuracion y devuelve el proveedor correcto.
 */

import type { AIProvider } from './types.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { GeminiProvider } from './gemini.js';

export type ProviderConfig = {
  provider: 'anthropic' | 'openai' | 'gemini';
  apiKey: string;
  model?: string;
};

/**
 * Crea el proveedor de IA segun la configuracion.
 */
export function createProvider(config: ProviderConfig): AIProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config.apiKey, config.model ?? 'claude-sonnet-4-20250514');
    case 'openai':
      return new OpenAIProvider(config.apiKey, config.model ?? 'gpt-4o');
    case 'gemini':
      return new GeminiProvider(config.apiKey, config.model ?? 'gemini-2.5-flash');
    default:
      throw new Error(`Proveedor desconocido: ${(config as { provider: string }).provider}`);
  }
}

/**
 * Crea el proveedor desde variables de entorno.
 * Prioridad: Anthropic, OpenAI, Gemini. Asi no cambia el proveedor actual si ya existe.
 */
export function createProviderFromEnv(): AIProvider | null {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514';
    console.log(`Proveedor IA: Anthropic (${model})`);
    return new AnthropicProvider(anthropicKey, model);
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o';
    console.log(`Proveedor IA: OpenAI (${model})`);
    return new OpenAIProvider(openaiKey, model);
  }

  const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  if (geminiKey) {
    const model = process.env.GEMINI_MODEL ?? process.env.GOOGLE_AI_MODEL ?? 'gemini-2.5-flash';
    console.log(`Proveedor IA: Gemini (${model})`);
    return new GeminiProvider(geminiKey, model);
  }

  console.warn('No hay API key de IA configurada. El agente operara en modo deterministico sin IA.');
  return null;
}
