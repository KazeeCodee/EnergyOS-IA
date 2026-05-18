import { Hono } from 'hono';
import { z } from 'zod';
import {
  AdvisorConversationCreateInputSchema,
  AdvisorConversationListQuerySchema,
  AdvisorConversationUpdateInputSchema,
} from '../schemas/advisor.schema.js';
import {
  createConversation,
  getConversationForUser,
  listConversations,
  loadConversationContext,
  softDeleteConversation,
  updateConversation,
  type CreateConversationInput,
  type DeleteConversationInput,
  type GetConversationInput,
  type ListConversationsInput,
  type LoadConversationContextInput,
  type UpdateConversationInput,
} from '../advisor/conversationStore.js';
import {
  requireAuthorizedNemoIfConfigured,
  type AuthResult,
} from './auth.js';
import type { Context } from 'hono';

const ConversationScopeQuerySchema = z.object({
  companyId: z.string().uuid(),
  nemo: z.string().trim().regex(/^[A-Za-z0-9]{8}$/).transform((value) => value.toUpperCase()),
});

const ConversationPatchInputSchema = z.object({
  companyId: z.string().uuid(),
  nemo: z.string().trim().regex(/^[A-Za-z0-9]{8}$/).transform((value) => value.toUpperCase()),
  title: z.string().trim().min(1).max(120).optional(),
  status: z.enum(['active', 'archived']).optional(),
}).refine((value) => value.title !== undefined || value.status !== undefined, {
  message: 'Debe enviar title o status',
});

export type AdvisorConversationsApiStore = {
  createConversation: (input: CreateConversationInput) => Promise<unknown>;
  listConversations: (input: ListConversationsInput) => Promise<unknown>;
  getConversationForUser: (input: GetConversationInput) => Promise<unknown | null>;
  loadConversationContext: (input: LoadConversationContextInput) => Promise<{
    summary: string | null;
    recentMessages: unknown[];
  }>;
  updateConversation: (input: UpdateConversationInput) => Promise<void>;
  softDeleteConversation: (input: DeleteConversationInput) => Promise<void>;
};

export type AdvisorConversationsApiOptions = {
  authorizeNemo?: (c: Context, requestedNemo: string | undefined) => Promise<AuthResult>;
  store?: AdvisorConversationsApiStore;
};

function defaultStore(): AdvisorConversationsApiStore {
  return {
    createConversation,
    listConversations,
    getConversationForUser,
    loadConversationContext,
    updateConversation,
    softDeleteConversation,
  };
}

function requireUserId(c: Context, auth: AuthResult): string | Response {
  if (auth.userId) return auth.userId;
  return c.json({ error: 'Usuario autenticado requerido para conversaciones del advisor' }, 401);
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

export function createAdvisorConversationsApi(options: AdvisorConversationsApiOptions = {}) {
  const app = new Hono();
  const authorizeNemo = options.authorizeNemo ?? requireAuthorizedNemoIfConfigured;
  const store = options.store ?? defaultStore();

  app.get('/', async (c) => {
    const parsed = AdvisorConversationListQuerySchema.safeParse({
      nemo: c.req.query('nemo'),
    });
    if (!parsed.success) {
      return c.json({ error: 'Input invalido', details: parsed.error.issues }, 400);
    }

    const auth = await authorizeNemo(c, parsed.data.nemo);
    if (!auth.ok) return auth.response;
    const userId = requireUserId(c, auth);
    if (userId instanceof Response) return userId;

    const conversations = await store.listConversations({
      userId,
      nemo: auth.nemo ?? parsed.data.nemo,
    });

    return c.json({ conversations });
  });

  app.post('/', async (c) => {
    const json = await parseJson(c);
    if (!json.ok) return json.response;

    const parsed = AdvisorConversationCreateInputSchema.safeParse(json.body);
    if (!parsed.success) {
      return c.json({ error: 'Input invalido', details: parsed.error.issues }, 400);
    }

    const auth = await authorizeNemo(c, parsed.data.nemo);
    if (!auth.ok) return auth.response;
    const userId = requireUserId(c, auth);
    if (userId instanceof Response) return userId;

    const conversation = await store.createConversation({
      userId,
      companyId: parsed.data.companyId,
      nemo: auth.nemo ?? parsed.data.nemo,
      title: parsed.data.title,
    });

    return c.json({ conversation });
  });

  app.get('/:id/messages', async (c) => {
    const conversationId = c.req.param('id');
    const parsed = ConversationScopeQuerySchema.safeParse({
      companyId: c.req.query('companyId'),
      nemo: c.req.query('nemo'),
    });
    if (!parsed.success) {
      return c.json({ error: 'Input invalido', details: parsed.error.issues }, 400);
    }

    const auth = await authorizeNemo(c, parsed.data.nemo);
    if (!auth.ok) return auth.response;
    const userId = requireUserId(c, auth);
    if (userId instanceof Response) return userId;
    const nemo = auth.nemo ?? parsed.data.nemo;

    const conversation = await store.getConversationForUser({
      conversationId,
      userId,
      companyId: parsed.data.companyId,
      nemo,
    });
    if (!conversation) return c.json({ error: 'Conversacion no encontrada' }, 404);

    const context = await store.loadConversationContext({
      conversationId,
      userId,
      companyId: parsed.data.companyId,
      nemo,
    });

    return c.json({
      conversation,
      messages: context.recentMessages,
      summary: context.summary,
    });
  });

  app.patch('/:id', async (c) => {
    const conversationId = c.req.param('id');
    const json = await parseJson(c);
    if (!json.ok) return json.response;

    const parsed = ConversationPatchInputSchema.safeParse(json.body);
    if (!parsed.success) {
      return c.json({ error: 'Input invalido', details: parsed.error.issues }, 400);
    }

    const auth = await authorizeNemo(c, parsed.data.nemo);
    if (!auth.ok) return auth.response;
    const userId = requireUserId(c, auth);
    if (userId instanceof Response) return userId;

    await store.updateConversation({
      conversationId,
      userId,
      companyId: parsed.data.companyId,
      nemo: auth.nemo ?? parsed.data.nemo,
      title: parsed.data.title,
      status: parsed.data.status,
    });

    return c.json({ ok: true });
  });

  app.delete('/:id', async (c) => {
    const conversationId = c.req.param('id');
    const parsed = ConversationScopeQuerySchema.safeParse({
      companyId: c.req.query('companyId'),
      nemo: c.req.query('nemo'),
    });
    if (!parsed.success) {
      return c.json({ error: 'Input invalido', details: parsed.error.issues }, 400);
    }

    const auth = await authorizeNemo(c, parsed.data.nemo);
    if (!auth.ok) return auth.response;
    const userId = requireUserId(c, auth);
    if (userId instanceof Response) return userId;

    await store.softDeleteConversation({
      conversationId,
      userId,
      companyId: parsed.data.companyId,
      nemo: auth.nemo ?? parsed.data.nemo,
    });

    return c.json({ ok: true });
  });

  return app;
}

export default createAdvisorConversationsApi();
