/**
 * Google Gemini provider.
 *
 * Uses the Gemini REST generateContent endpoint with function calling.
 */

import type { AIProvider, ProviderMessage, ProviderResponse, ProviderToolCall } from './types.js';

type GeminiPart =
  | { text: string }
  | { functionCall: { id?: string; name: string; args?: Record<string, unknown> } }
  | { functionResponse: { id?: string; name: string; response: Record<string, unknown> } };

type GeminiContent = {
  role: 'user' | 'model';
  parts: GeminiPart[];
};

type GeminiTool = {
  functionDeclarations: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: GeminiContent;
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
};

export class GeminiProvider implements AIProvider {
  name = 'gemini';
  model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, model = 'gemini-2.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }

  async chat(
    systemPrompt: string,
    messages: ProviderMessage[],
    tools: unknown[],
  ): Promise<ProviderResponse> {
    const body = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: this.convertMessages(messages),
      tools: this.convertTools(tools),
      generationConfig: {
        maxOutputTokens: 4096,
      },
    };

    const response = await fetch(
      `${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as GeminiResponse;
    return this.convertResponse(data);
  }

  private convertTools(tools: unknown[]): GeminiTool[] {
    const functionDeclarations = (tools as Array<{
      name: string;
      description: string;
      input_schema: Record<string, unknown>;
    }>).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    }));

    return functionDeclarations.length > 0 ? [{ functionDeclarations }] : [];
  }

  private convertMessages(messages: ProviderMessage[]): GeminiContent[] {
    const toolNamesById = new Map<string, string>();

    return messages.map(msg => {
      if (this.isGeminiContent(msg.providerData)) {
        for (const part of msg.providerData.parts) {
          if ('functionCall' in part && part.functionCall.id) {
            toolNamesById.set(part.functionCall.id, part.functionCall.name);
          }
        }
        for (const toolCall of msg.toolCalls ?? []) {
          toolNamesById.set(toolCall.id, toolCall.name);
        }
        return msg.providerData;
      }

      if (msg.role === 'assistant') {
        const parts: GeminiPart[] = [];
        if (msg.content) {
          parts.push({ text: msg.content });
        }
        for (const toolCall of msg.toolCalls ?? []) {
          toolNamesById.set(toolCall.id, toolCall.name);
          parts.push({
            functionCall: {
              id: toolCall.id,
              name: toolCall.name,
              args: toolCall.arguments,
            },
          });
        }
        return { role: 'model', parts: parts.length > 0 ? parts : [{ text: '' }] };
      }

      if (msg.role === 'tool_result') {
        const toolName = msg.tool_call_id ? toolNamesById.get(msg.tool_call_id) : undefined;
        return {
          role: 'user',
          parts: [{
            functionResponse: {
              id: this.isSyntheticGeminiCallId(msg.tool_call_id) ? undefined : msg.tool_call_id,
              name: toolName ?? 'tool_result',
              response: { result: this.parseToolResult(msg.content) },
            },
          }],
        };
      }

      return {
        role: 'user',
        parts: [{ text: msg.content }],
      };
    });
  }

  private convertResponse(data: GeminiResponse): ProviderResponse {
    const candidate = data.candidates?.[0];
    if (!candidate?.content) {
      throw new Error('Gemini returned empty response');
    }

    let text: string | null = null;
    const toolCalls: ProviderToolCall[] = [];

    for (const [index, part] of candidate.content.parts.entries()) {
      if ('text' in part) {
        text = (text ?? '') + part.text;
      } else if ('functionCall' in part) {
        toolCalls.push({
          id: part.functionCall.id ?? `gemini-call-${index}`,
          name: part.functionCall.name,
          arguments: part.functionCall.args ?? {},
        });
      }
    }

    return {
      text,
      toolCalls,
      done: toolCalls.length === 0,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
      stopReason: candidate.finishReason ?? (toolCalls.length > 0 ? 'FUNCTION_CALL' : 'STOP'),
      providerData: candidate.content,
    };
  }

  private parseToolResult(content: string): unknown {
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  }

  private isSyntheticGeminiCallId(value: string | undefined): boolean {
    return value?.startsWith('gemini-call-') ?? false;
  }

  private isGeminiContent(value: unknown): value is GeminiContent {
    if (!value || typeof value !== 'object') return false;
    const content = value as Partial<GeminiContent>;
    return (content.role === 'user' || content.role === 'model') && Array.isArray(content.parts);
  }
}
