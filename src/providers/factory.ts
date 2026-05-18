/**
 * Factory de proveedores IA.
 *
 * Lee la configuración y devuelve el proveedor correcto.
 */

import type { AIProvider } from './types.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';

export type ProviderConfig = {
  provider: 'anthropic' | 'openai';
  apiKey: string;
  model?: string;
};

/**
 * Crea el proveedor de IA según la configuración.
 */
export function createProvider(config: ProviderConfig): AIProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config.apiKey, config.model ?? 'claude-sonnet-4-20250514');
    case 'openai':
      return new OpenAIProvider(config.apiKey, config.model ?? 'gpt-4o');
    default:
      throw new Error(`Proveedor desconocido: ${config.provider}`);
  }
}

/**
 * Crea el proveedor desde variables de entorno.
 * Intenta Anthropic primero, luego OpenAI.
 */
export function createProviderFromEnv(): AIProvider | null {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514';
    console.log(`🤖 Proveedor IA: Anthropic (${model})`);
    return new AnthropicProvider(anthropicKey, model);
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o';
    console.log(`🤖 Proveedor IA: OpenAI (${model})`);
    return new OpenAIProvider(openaiKey, model);
  }

  console.warn('⚠️ No hay API key de IA configurada. El agente operará en modo determinístico (sin IA).');
  return null;
}
