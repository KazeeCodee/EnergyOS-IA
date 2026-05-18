/**
 * Agentic Loop — El corazón del agente.
 *
 * Implementa el patrón recomendado por Anthropic:
 * PIENSA → ACTÚA → OBSERVA → ¿SUFICIENTE? → RESPONDE
 *
 * El LLM decide qué herramientas usar, en qué orden,
 * y cuándo tiene suficiente información para responder.
 *
 * Guardrails incluidos:
 * - Máximo de iteraciones (previene loops infinitos)
 * - Timeout por iteración
 * - Logging de cada paso
 * - Tracking de tokens usados
 */

import type { AIProvider, ProviderMessage } from '../providers/types.js';
import { SYSTEM_PROMPT } from '../prompts/system.js';
import { TOOL_DEFINITIONS } from '../tools/definitions.js';
import { executeTool, type ToolExecutionContext } from '../tools/executor.js';

// ─── Configuración ─────────────────────────────────────────────────────────

const MAX_ITERATIONS = 15;      // Máximo de ciclos piensa/actúa
const MAX_TOOL_CALLS_PER_TURN = 5; // Máximo de tools por iteración

// ─── Tipos ─────────────────────────────────────────────────────────────────

export type AgentStep = {
  iteration: number;
  type: 'thinking' | 'tool_call' | 'tool_result' | 'response';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  timestamp: string;
  tokens?: { input: number; output: number };
};

export type AgentRunResult = {
  /** Respuesta final del agente en lenguaje natural */
  response: string;
  /** Pasos intermedios (traza completa del razonamiento) */
  steps: AgentStep[];
  /** Total de iteraciones del loop */
  iterations: number;
  /** Tokens totales usados */
  totalTokens: { input: number; output: number };
  /** Modelo usado */
  model: string;
  /** Proveedor usado */
  provider: string;
};

// ─── Loop principal ────────────────────────────────────────────────────────

/**
 * Ejecuta el loop agéntico completo.
 *
 * @param provider - Proveedor de IA (Claude/GPT)
 * @param userMessage - Mensaje o tarea del usuario
 * @returns Resultado con respuesta final y traza completa
 */
export async function runAgenticLoop(
  provider: AIProvider,
  userMessage: string,
  toolContext: ToolExecutionContext = {},
): Promise<AgentRunResult> {
  const steps: AgentStep[] = [];
  const messages: ProviderMessage[] = [];
  const totalTokens = { input: 0, output: 0 };

  // Mensaje inicial del usuario
  messages.push({ role: 'user', content: userMessage });

  console.log(`\n🧠 Agentic Loop iniciado (${provider.name}/${provider.model})`);
  console.log(`📝 Tarea: ${userMessage.slice(0, 100)}...`);

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    console.log(`\n--- Iteración ${iteration}/${MAX_ITERATIONS} ---`);

    // 1. Enviar al LLM con herramientas disponibles
    const response = await provider.chat(
      SYSTEM_PROMPT,
      messages,
      TOOL_DEFINITIONS,
    );

    totalTokens.input += response.usage.inputTokens;
    totalTokens.output += response.usage.outputTokens;

    // 2. Si el modelo generó texto, registrarlo
    if (response.text) {
      const stepType = response.done ? 'response' : 'thinking';
      steps.push({
        iteration,
        type: stepType,
        content: response.text,
        timestamp: new Date().toISOString(),
        tokens: {
          input: response.usage.inputTokens,
          output: response.usage.outputTokens,
        },
      });

      if (stepType === 'thinking') {
        console.log(`💭 Pensando: ${response.text.slice(0, 150)}...`);
      }
    }

    // 3. Si el modelo terminó (no quiere más tools), devolver respuesta
    if (response.done) {
      console.log(`\n✅ Agente completó en ${iteration} iteraciones`);
      console.log(`📊 Tokens: ${totalTokens.input} input + ${totalTokens.output} output`);

      return {
        response: response.text ?? 'El agente no generó respuesta.',
        steps,
        iterations: iteration,
        totalTokens,
        model: provider.model,
        provider: provider.name,
      };
    }

    // 4. Si hay tool calls, ejecutarlos
    if (response.toolCalls.length > 0) {
      // Registrar el mensaje del asistente con los tool calls
      // (necesario para mantener el historial correcto)
      messages.push({
        role: 'assistant',
        content: response.text ?? '',
      });

      const toolCallsToExecute = response.toolCalls.slice(0, MAX_TOOL_CALLS_PER_TURN);

      for (const toolCall of toolCallsToExecute) {
        console.log(`🔧 Tool call: ${toolCall.name}(${JSON.stringify(toolCall.arguments).slice(0, 100)})`);

        // Registrar la llamada
        steps.push({
          iteration,
          type: 'tool_call',
          content: `Llamando a ${toolCall.name}`,
          toolName: toolCall.name,
          toolArgs: toolCall.arguments,
          timestamp: new Date().toISOString(),
        });

        // Ejecutar la herramienta
        const result = await executeTool(toolCall.name, toolCall.arguments, toolContext);

        // Registrar el resultado
        const resultStr = JSON.stringify(result.data, null, 2);
        steps.push({
          iteration,
          type: 'tool_result',
          content: result.success ? `OK (${resultStr.length} chars)` : `Error: ${result.error}`,
          toolName: toolCall.name,
          toolResult: result.data,
          timestamp: new Date().toISOString(),
        });

        console.log(`  → ${result.success ? '✅' : '❌'} ${resultStr.slice(0, 200)}`);

        // Agregar resultado al historial de mensajes
        messages.push({
          role: 'tool_result',
          content: resultStr,
          tool_call_id: toolCall.id,
        });
      }
    }
  }

  // Si llegamos acá, se agotaron las iteraciones
  console.warn(`⚠️ Máximo de iteraciones (${MAX_ITERATIONS}) alcanzado`);

  const lastText = steps
    .filter(s => s.type === 'thinking' || s.type === 'response')
    .pop()?.content;

  return {
    response: lastText ?? 'El agente no pudo completar el análisis dentro del límite de iteraciones.',
    steps,
    iterations: MAX_ITERATIONS,
    totalTokens,
    model: provider.model,
    provider: provider.name,
  };
}
