/**
 * Proveedor Anthropic (Claude).
 *
 * Implementa la interfaz AIProvider usando la API de Claude con tool-calling.
 */

import type { AIProvider, ProviderMessage, ProviderResponse, ProviderToolCall } from './types.js';

type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
};

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

type AnthropicTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

type AnthropicResponse = {
  id: string;
  content: AnthropicContentBlock[];
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens';
  usage: { input_tokens: number; output_tokens: number };
};

export class AnthropicProvider implements AIProvider {
  name = 'anthropic';
  model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, model = 'claude-sonnet-4-20250514') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = 'https://api.anthropic.com/v1';
  }

  async chat(
    systemPrompt: string,
    messages: ProviderMessage[],
    tools: unknown[],
  ): Promise<ProviderResponse> {
    // Convertir mensajes al formato Anthropic
    const anthropicMessages = this.convertMessages(messages);

    const body = {
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: anthropicMessages,
      tools: tools as AnthropicTool[],
    };

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    return this.convertResponse(data);
  }

  private convertMessages(messages: ProviderMessage[]): AnthropicMessage[] {
    const result: AnthropicMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'tool_result') {
        // Tool results van como content blocks dentro de un mensaje user
        const lastMsg = result[result.length - 1];
        if (lastMsg?.role === 'user' && Array.isArray(lastMsg.content)) {
          (lastMsg.content as AnthropicContentBlock[]).push({
            type: 'tool_result',
            tool_use_id: msg.tool_call_id!,
            content: msg.content,
          });
        } else {
          result.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: msg.tool_call_id!,
              content: msg.content,
            }],
          });
        }
      } else if (msg.role === 'assistant') {
        const content: AnthropicContentBlock[] = [];
        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
        }
        for (const toolCall of msg.toolCalls ?? []) {
          content.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.name,
            input: toolCall.arguments,
          });
        }
        result.push({ role: 'assistant', content: content.length > 0 ? content : msg.content });
      } else {
        result.push({ role: 'user', content: msg.content });
      }
    }

    return result;
  }

  private convertResponse(data: AnthropicResponse): ProviderResponse {
    let text: string | null = null;
    const toolCalls: ProviderToolCall[] = [];

    for (const block of data.content) {
      if (block.type === 'text') {
        text = (text ?? '') + block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input,
        });
      }
    }

    return {
      text,
      toolCalls,
      done: data.stop_reason === 'end_turn',
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      },
      stopReason: data.stop_reason,
    };
  }
}
