import { Hono } from 'hono';
import { AdvisorChatInputSchema, type AdvisorRunOutput } from '../schemas/advisor.schema.js';
import { runAdvisorChat as defaultRunAdvisorChat } from '../advisor/orchestrator.js';
import { requireAuthorizedNemoIfConfigured, type AuthResult } from './auth.js';
import { createDefaultAdvisorRunStore, type AdvisorRunStore } from '../advisor/runStore.js';
import {
  appendMessage,
  createConversation,
  getConversationForUser,
  loadConversationContext,
  type AppendMessageInput,
  type CreateConversationInput,
  type GetConversationInput,
  type LoadConversationContextInput,
} from '../advisor/conversationStore.js';
import { maybeUpdateConversationSummary } from '../advisor/conversationSummary.js';
import { extractMemoryCandidates, type MemoryCandidate } from '../advisor/memoryExtractor.js';
import { createMemoryItem } from '../advisor/memoryStore.js';
import type { Context } from 'hono';
import type { AdvisorOrchestratorOptions } from '../advisor/orchestrator.js';

export type AdvisorChatConversationStore = {
  createConversation: (input: CreateConversationInput) => Promise<{ id: string }>;
  getConversationForUser: (input: GetConversationInput) => Promise<unknown | null>;
  appendMessage: (input: AppendMessageInput) => Promise<{ id: string }>;
  loadConversationContext: (input: LoadConversationContextInput) => Promise<NonNullable<AdvisorOrchestratorOptions['conversationContext']>>;
};

export type AdvisorChatApiOptions = {
  authorizeNemo?: (c: Context, requestedNemo: string | undefined) => Promise<AuthResult>;
  createRunStore?: () => Promise<AdvisorRunStore>;
  conversationStore?: AdvisorChatConversationStore;
  runAdvisorChat?: (
    input: Parameters<typeof defaultRunAdvisorChat>[0],
    options: AdvisorOrchestratorOptions,
  ) => Promise<AdvisorRunOutput>;
  updateConversationSummary?: (input: {
    conversationId: string;
    userId: string;
    companyId: string;
    nemo: string;
  }) => Promise<void>;
  extractMemoryCandidates?: typeof extractMemoryCandidates;
  createMemoryItem?: (input: MemoryCandidate) => Promise<unknown>;
};

function defaultConversationStore(): AdvisorChatConversationStore {
  return {
    createConversation,
    getConversationForUser,
    appendMessage,
    loadConversationContext,
  };
}

function requireUserId(c: Context, auth: AuthResult): string | Response {
  if (auth.userId) return auth.userId;
  return c.json({ error: 'Usuario autenticado requerido para conversaciones del advisor' }, 401);
}

function buildTitleFromQuestion(question: string): string {
  const clean = question.trim().replace(/\s+/g, ' ');
  if (!clean) return 'Nueva conversacion';
  return clean.length > 80 ? `${clean.slice(0, 80)}...` : clean;
}

async function parseJson(c: Context): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, body: await c.req.json() };
  } catch {
    return {
      ok: false,
      response: c.json({ error: 'Input invalido', details: 'JSON invalido' }, 400),
    };
  }
}

export function createAdvisorChatApi(options: AdvisorChatApiOptions = {}) {
  const app = new Hono();
  const authorizeNemo = options.authorizeNemo ?? requireAuthorizedNemoIfConfigured;
  const createRunStore = options.createRunStore ?? createDefaultAdvisorRunStore;
  const conversationStore = options.conversationStore ?? defaultConversationStore();
  const runAdvisorChat = options.runAdvisorChat ?? defaultRunAdvisorChat;
  const updateSummary = options.updateConversationSummary ?? maybeUpdateConversationSummary;
  const extractMemory = options.extractMemoryCandidates ?? extractMemoryCandidates;
  const persistMemory = options.createMemoryItem ?? createMemoryItem;

  app.post('/', async (c) => {
    const json = await parseJson(c);
    if (!json.ok) return json.response;

    const parsed = AdvisorChatInputSchema.safeParse(json.body);

    if (!parsed.success) {
      return c.json({
        error: 'Input invalido',
        details: parsed.error.issues,
      }, 400);
    }

    const auth = await authorizeNemo(c, parsed.data.nemo);
    if (!auth.ok) return auth.response;
    const userId = requireUserId(c, auth);
    if (userId instanceof Response) return userId;

    if (parsed.data.includePrivateContext && !auth.token) {
      return c.json({
        error: 'Authorization Bearer token requerido para usar contexto privado',
      }, 401);
    }

    try {
      const nemo = auth.nemo ?? parsed.data.nemo;
      const conversation = parsed.data.conversationId
        ? await conversationStore.getConversationForUser({
          conversationId: parsed.data.conversationId,
          userId,
          companyId: parsed.data.companyId,
          nemo,
        })
        : await conversationStore.createConversation({
          userId,
          companyId: parsed.data.companyId,
          nemo,
          title: buildTitleFromQuestion(parsed.data.question),
        });

      if (!conversation || typeof conversation !== 'object' || !('id' in conversation) || typeof conversation.id !== 'string') {
        return c.json({ error: 'Conversacion no encontrada' }, 404);
      }

      const conversationId = conversation.id;
      const userMessage = await conversationStore.appendMessage({
        conversationId,
        userId,
        companyId: parsed.data.companyId,
        nemo,
        role: 'user',
        content: parsed.data.question,
        metadata: {
          filesCount: parsed.data.files.length,
        },
      });

      const conversationContext = await conversationStore.loadConversationContext({
        conversationId,
        userId,
        companyId: parsed.data.companyId,
        nemo,
      });

      const runStore = await createRunStore();
      const result = await runAdvisorChat({
        ...parsed.data,
        conversationId,
        nemo,
      }, {
        userToken: auth.token,
        runStore,
        conversationContext,
      });

      const assistantMessage = await conversationStore.appendMessage({
        conversationId,
        userId,
        companyId: parsed.data.companyId,
        nemo,
        role: 'assistant',
        content: result.response,
        intent: result.intent,
        metadata: result as unknown as Record<string, unknown>,
      });

      await updateSummary({
        conversationId,
        userId,
        companyId: parsed.data.companyId,
        nemo,
      }).catch((error) => {
        console.error('Error updating advisor conversation summary:', error);
      });

      const memoryCandidates = extractMemory({
        userId,
        companyId: parsed.data.companyId,
        nemo,
        conversationId,
        sourceMessageId: userMessage.id,
        role: 'user',
        content: parsed.data.question,
      });

      await Promise.all(memoryCandidates.map((candidate) => persistMemory(candidate))).catch((error) => {
        console.error('Error creating advisor memory:', error);
      });

      return c.json({
        ...result,
        conversationId,
        messageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error interno del advisor';
      console.error('Error in advisor-chat:', error);
      return c.json({ error: message }, 500);
    }
  });

  return app;
}

export default createAdvisorChatApi();
