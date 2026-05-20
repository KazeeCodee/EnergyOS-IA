import { z } from 'zod';
import type { AdvisorChatInput, ConversationContext } from '../schemas/advisor.schema.js';
import type { AIProvider } from '../providers/types.js';
import { routeAdvisorTurn, type AdvisorIntent, type AdvisorTurnRoute } from './intentRouter.js';
import {
  understandAdvisorTurn,
  type AdvisorDomainIntent,
  type AdvisorResponseMode,
  type AdvisorTurnUnderstanding,
} from './turnUnderstanding.js';

const DomainIntentSchema = z.enum([
  'monthly_summary',
  'invoice',
  'contract',
  'compliance',
  'document_intake',
  'action_plan',
  'report',
  'general_question',
  'guided_diagnosis',
]);

export const TurnDirectorOutputSchema = z.object({
  primaryAct: z.enum([
    'social_only',
    'identity',
    'reassurance',
    'thanks',
    'acknowledgement',
    'guided_help',
    'analytic_request',
    'generic_conversation',
  ]),
  domainIntent: DomainIntentSchema.nullable(),
  shouldRunAnalysis: z.boolean(),
  responseMode: z.enum(['brief_conversation', 'guided_onboarding', 'technical_analysis']),
  confidence: z.enum(['low', 'medium', 'high']),
  reason: z.string().max(300),
});

export type TurnDirectorOutput = z.infer<typeof TurnDirectorOutputSchema>;

export type ResolveAdvisorTurnInput = {
  input: AdvisorChatInput;
  conversationContext?: ConversationContext;
  provider?: AIProvider | null;
};

function buildSystemPrompt(): string {
  return [
    'Sos el director de turnos de EnergyOS Advisor.',
    'Decidis si el turno requiere analisis de datos o solo respuesta conversacional.',
    'No ejecutes analisis y no redactes la respuesta final al usuario.',
    'No clasifiques saludos, dudas humanas, identidad, agradecimientos o pedidos de confianza como analisis.',
    'Solo marca shouldRunAnalysis=true cuando el usuario pide entender, calcular, revisar, resumir, comparar, auditar o decidir sobre datos energeticos.',
    'Si el usuario dice que no sabe leer datos y pide ayuda para entender su situacion energetica, usa guided_help y guided_onboarding.',
    'Si hay archivos adjuntos, usa document_intake y shouldRunAnalysis=true.',
    'Devolve exclusivamente JSON valido, sin markdown.',
  ].join('\n');
}

function compactConversationContext(context: ConversationContext | undefined) {
  if (!context) return null;
  return {
    summary: context.summary,
    recentMessages: context.recentMessages.slice(-6).map((message) => ({
      role: message.role,
      content: message.content,
      intent: message.intent,
    })),
    memory: context.memory,
  };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const first = candidate.indexOf('{');
    const last = candidate.lastIndexOf('}');
    if (first >= 0 && last > first) {
      return JSON.parse(candidate.slice(first, last + 1));
    }
    throw new Error('Turn director returned non-JSON response');
  }
}

function mapOutputToUnderstanding(
  base: AdvisorTurnUnderstanding,
  output: TurnDirectorOutput,
): AdvisorTurnUnderstanding {
  const responseModeByDirectorMode: Record<TurnDirectorOutput['responseMode'], AdvisorResponseMode> = {
    brief_conversation: 'conversation',
    guided_onboarding: 'guided_onboarding',
    technical_analysis: 'analysis',
  };

  return {
    ...base,
    primaryAct: output.primaryAct,
    domainIntent: output.domainIntent as AdvisorDomainIntent | null,
    responseMode: responseModeByDirectorMode[output.responseMode],
    shouldRunAnalysis: output.shouldRunAnalysis,
  };
}

function mapOutputToIntent(output: TurnDirectorOutput, input: AdvisorChatInput): AdvisorIntent {
  if ((input.files?.length ?? 0) > 0) return 'document_intake';
  if (!output.shouldRunAnalysis) {
    return output.primaryAct === 'social_only' ? 'greeting' : 'conversation';
  }
  if (output.domainIntent) return output.domainIntent as AdvisorIntent;
  if (output.primaryAct === 'guided_help') return 'guided_diagnosis';
  return 'general_question';
}

export async function resolveAdvisorTurn(input: ResolveAdvisorTurnInput): Promise<AdvisorTurnRoute> {
  const fallback = routeAdvisorTurn({
    question: input.input.question,
    files: input.input.files,
  });

  const provider = input.provider;
  if (!provider) return { ...fallback, routerSource: 'deterministic' };

  try {
    const response = await provider.chat(
      buildSystemPrompt(),
      [{
        role: 'user',
        content: JSON.stringify({
          question: input.input.question,
          companyName: input.input.companyName,
          nemo: input.input.nemo,
          period: input.input.period ?? null,
          filesCount: input.input.files.length,
          deterministicUnderstanding: fallback.understanding,
          conversationContext: compactConversationContext(input.conversationContext),
        }, null, 2),
      }],
      [],
    );
    const text = response.text?.trim();
    if (!text) return { ...fallback, routerSource: 'deterministic' };

    const parsed = TurnDirectorOutputSchema.parse(extractJson(text));
    const deterministicUnderstanding = understandAdvisorTurn({
      question: input.input.question,
      files: input.input.files,
    });
    const understanding = mapOutputToUnderstanding(deterministicUnderstanding, parsed);
    return {
      intent: mapOutputToIntent(parsed, input.input),
      understanding,
      routerSource: 'llm',
    };
  } catch (error) {
    console.error('Advisor turn director fallback:', error instanceof Error ? error.message : error);
    return { ...fallback, routerSource: 'deterministic' };
  }
}
