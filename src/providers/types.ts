/**
 * Tipos agnósticos de proveedor.
 *
 * Permite cambiar entre Claude y OpenAI sin tocar el loop agéntico.
 */

export type ProviderMessage = {
  role: 'user' | 'assistant' | 'tool_result';
  content: string;
  tool_call_id?: string;
  toolCalls?: ProviderToolCall[];
  providerData?: unknown;
};

export type ProviderToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ProviderResponse = {
  /** Texto generado por el modelo (puede ser null si solo hay tool calls) */
  text: string | null;
  /** Tool calls solicitados por el modelo */
  toolCalls: ProviderToolCall[];
  /** El modelo terminó (no quiere hacer más tool calls) */
  done: boolean;
  /** Tokens usados */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Stop reason */
  stopReason: string;
  /** Provider-specific payload needed to continue tool conversations. */
  providerData?: unknown;
};

/**
 * Interfaz que debe implementar cada proveedor de IA.
 */
export interface AIProvider {
  /** Nombre del proveedor */
  name: string;

  /** Modelo usado */
  model: string;

  /**
   * Envía un mensaje al modelo con herramientas disponibles.
   * El modelo puede devolver texto, tool calls, o ambos.
   */
  chat(
    systemPrompt: string,
    messages: ProviderMessage[],
    tools: unknown[],
  ): Promise<ProviderResponse>;
}
