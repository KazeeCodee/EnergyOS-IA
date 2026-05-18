import type { AdvisorMessageOutput } from '../schemas/advisor.schema.js';
import {
  getConversationSummaryState,
  updateConversationSummary,
  type ConversationSummaryState,
  type GetConversationInput,
} from './conversationStore.js';

export type ConversationSummaryWriterInput = ConversationSummaryState;

export type ConversationSummaryWriter = (input: ConversationSummaryWriterInput) => Promise<string>;

export type ConversationSummaryStore = {
  getConversationSummaryState: (input: GetConversationInput & { limit?: number }) => Promise<ConversationSummaryState>;
  updateConversationSummary: (input: GetConversationInput & { summary: string }) => Promise<void>;
};

export type MaybeUpdateConversationSummaryInput = GetConversationInput & {
  threshold?: number;
  keepMessages?: number;
  store?: ConversationSummaryStore;
  writer?: ConversationSummaryWriter;
};

const DEFAULT_THRESHOLD = 20;
const DEFAULT_KEEP_MESSAGES = 40;
const MAX_SUMMARY_LENGTH = 2500;

export function shouldSummarizeConversation(input: { messageCount: number; threshold?: number }): boolean {
  return input.messageCount > (input.threshold ?? DEFAULT_THRESHOLD);
}

function cleanContent(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function selectLines(messages: AdvisorMessageOutput[], patterns: RegExp[], limit: number): string[] {
  const lines: string[] = [];
  for (const message of messages) {
    if (lines.length >= limit) break;
    if (!patterns.some((pattern) => pattern.test(message.content))) continue;
    const content = cleanContent(message.content);
    if (content) lines.push(`- ${content.slice(0, 220)}`);
  }
  return lines;
}

export function buildDeterministicConversationSummary(input: ConversationSummaryWriterInput): string {
  const preferences = selectLines(input.messages, [/prefiero/i, /me gusta/i, /quiero que/i], 4);
  const decisions = selectLines(input.messages, [/decidimos/i, /se decidio/i, /vamos a/i], 5);
  const pending = selectLines(input.messages, [/queda pendiente/i, /falta/i, /hay que/i, /revisar/i], 6);
  const questions = selectLines(input.messages.filter((message) => message.role === 'user'), [/\?/], 5);

  const sections = [
    'Resumen conversacional del chat actual.',
    'Este resumen ayuda a continuar la conversacion, pero no reemplaza los datos operativos actuales de EnergyOS.',
  ];

  if (input.currentSummary) {
    sections.push('', 'Resumen previo:', input.currentSummary.slice(0, 800));
  }

  if (preferences.length > 0) sections.push('', 'Preferencias:', ...preferences);
  if (decisions.length > 0) sections.push('', 'Decisiones:', ...decisions);
  if (pending.length > 0) sections.push('', 'Pendientes:', ...pending);
  if (questions.length > 0) sections.push('', 'Preguntas abiertas:', ...questions);

  if (sections.length <= 2) {
    const recent = input.messages.slice(-6).map((message) => `- ${message.role}: ${cleanContent(message.content).slice(0, 180)}`);
    sections.push('', 'Intercambio reciente:', ...recent);
  }

  return sections.join('\n').slice(0, MAX_SUMMARY_LENGTH);
}

function defaultStore(): ConversationSummaryStore {
  return {
    getConversationSummaryState,
    updateConversationSummary,
  };
}

export async function maybeUpdateConversationSummary(input: MaybeUpdateConversationSummaryInput): Promise<void> {
  const store = input.store ?? defaultStore();
  const state = await store.getConversationSummaryState({
    conversationId: input.conversationId,
    userId: input.userId,
    companyId: input.companyId,
    nemo: input.nemo,
    limit: input.keepMessages ?? DEFAULT_KEEP_MESSAGES,
  });

  if (!shouldSummarizeConversation({
    messageCount: state.messageCount,
    threshold: input.threshold,
  })) {
    return;
  }

  const summary = input.writer
    ? await input.writer(state)
    : buildDeterministicConversationSummary(state);

  await store.updateConversationSummary({
    conversationId: input.conversationId,
    userId: input.userId,
    companyId: input.companyId,
    nemo: input.nemo,
    summary: summary.slice(0, MAX_SUMMARY_LENGTH),
  });
}
