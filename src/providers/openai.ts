/**
 * Proveedor OpenAI (GPT).
 *
 * Implementa la interfaz AIProvider usando la API de OpenAI con function calling.
 */

import type { AIProvider, ProviderMessage, ProviderResponse, ProviderToolCall } from './types.js';

type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
};

type OpenAIToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type OpenAITool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type OpenAIResponse = {
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: 'stop' | 'tool_calls' | 'length';
  }>;
  usage: { prompt_tokens: number; completion_tokens: number };
};

export class OpenAIProvider implements AIProvider {
  name = 'openai';
  model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, model = 'gpt-4o') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = 'https://api.openai.com/v1';
  }

  async chat(
    systemPrompt: string,
    messages: ProviderMessage[],
    tools: unknown[],
  ): Promise<ProviderResponse> {
    const openaiMessages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...this.convertMessages(messages),
    ];

    // Convertir tool definitions al formato OpenAI
    const openaiTools: OpenAITool[] = (tools as Array<{ name: string; description: string; input_schema: Record<string, unknown> }>).map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));

    const body = {
      model: this.model,
      messages: openaiMessages,
      tools: openaiTools,
      max_tokens: 4096,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    return this.convertResponse(data);
  }

  private convertMessages(messages: ProviderMessage[]): OpenAIMessage[] {
    return messages.map(msg => {
      if (msg.role === 'tool_result') {
        return {
          role: 'tool' as const,
          content: msg.content,
          tool_call_id: msg.tool_call_id,
        };
      }
      if (msg.role === 'assistant') {
        return {
          role: 'assistant',
          content: msg.content,
          tool_calls: msg.toolCalls?.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }
      return {
        role: msg.role,
        content: msg.content,
      };
    });
  }

  private convertResponse(data: OpenAIResponse): ProviderResponse {
    const choice = data.choices[0];
    if (!choice) throw new Error('OpenAI returned empty response');

    const toolCalls: ProviderToolCall[] = (choice.message.tool_calls ?? []).map(tc => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));

    return {
      text: choice.message.content,
      toolCalls,
      done: choice.finish_reason === 'stop',
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      },
      stopReason: choice.finish_reason,
    };
  }
}
