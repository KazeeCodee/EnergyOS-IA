import { Hono } from 'hono';
import { z } from 'zod';
import type { Context } from 'hono';
import {
  archiveMemoryItem,
  deleteMemoryItem,
  listMemoryItems,
  type ListMemoryItemsInput,
  type MutateMemoryItemInput,
} from '../advisor/memoryStore.js';
import {
  requireAuthorizedNemoIfConfigured,
  type AuthResult,
} from './auth.js';

const MemoryQuerySchema = z.object({
  nemo: z.string().trim().regex(/^[A-Za-z0-9]{8}$/).transform((value) => value.toUpperCase()),
});

const MemoryPatchSchema = z.object({
  nemo: z.string().trim().regex(/^[A-Za-z0-9]{8}$/).transform((value) => value.toUpperCase()),
  status: z.enum(['archived']),
});

export type AdvisorMemoryApiStore = {
  listMemoryItems: (input: ListMemoryItemsInput) => Promise<unknown[]>;
  archiveMemoryItem: (input: MutateMemoryItemInput) => Promise<void>;
  deleteMemoryItem: (input: MutateMemoryItemInput) => Promise<void>;
};

export type AdvisorMemoryApiOptions = {
  authorizeNemo?: (c: Context, requestedNemo: string | undefined) => Promise<AuthResult>;
  store?: AdvisorMemoryApiStore;
};

function defaultStore(): AdvisorMemoryApiStore {
  return {
    listMemoryItems,
    archiveMemoryItem,
    deleteMemoryItem,
  };
}

function requireUserId(c: Context, auth: AuthResult): string | Response {
  if (auth.userId) return auth.userId;
  return c.json({ error: 'Usuario autenticado requerido para memoria del advisor' }, 401);
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

export function createAdvisorMemoryApi(options: AdvisorMemoryApiOptions = {}) {
  const app = new Hono();
  const authorizeNemo = options.authorizeNemo ?? requireAuthorizedNemoIfConfigured;
  const store = options.store ?? defaultStore();

  app.get('/', async (c) => {
    const parsed = MemoryQuerySchema.safeParse({
      nemo: c.req.query('nemo'),
    });
    if (!parsed.success) {
      return c.json({ error: 'Input invalido', details: parsed.error.issues }, 400);
    }

    const auth = await authorizeNemo(c, parsed.data.nemo);
    if (!auth.ok) return auth.response;
    const userId = requireUserId(c, auth);
    if (userId instanceof Response) return userId;

    const memory = await store.listMemoryItems({
      userId,
      nemo: auth.nemo ?? parsed.data.nemo,
    });

    return c.json({ memory });
  });

  app.patch('/:id', async (c) => {
    const json = await parseJson(c);
    if (!json.ok) return json.response;

    const parsed = MemoryPatchSchema.safeParse(json.body);
    if (!parsed.success) {
      return c.json({ error: 'Input invalido', details: parsed.error.issues }, 400);
    }

    const auth = await authorizeNemo(c, parsed.data.nemo);
    if (!auth.ok) return auth.response;
    const userId = requireUserId(c, auth);
    if (userId instanceof Response) return userId;

    await store.archiveMemoryItem({
      memoryId: c.req.param('id'),
      userId,
      nemo: auth.nemo ?? parsed.data.nemo,
    });

    return c.json({ ok: true });
  });

  app.delete('/:id', async (c) => {
    const parsed = MemoryQuerySchema.safeParse({
      nemo: c.req.query('nemo'),
    });
    if (!parsed.success) {
      return c.json({ error: 'Input invalido', details: parsed.error.issues }, 400);
    }

    const auth = await authorizeNemo(c, parsed.data.nemo);
    if (!auth.ok) return auth.response;
    const userId = requireUserId(c, auth);
    if (userId instanceof Response) return userId;

    await store.deleteMemoryItem({
      memoryId: c.req.param('id'),
      userId,
      nemo: auth.nemo ?? parsed.data.nemo,
    });

    return c.json({ ok: true });
  });

  return app;
}

export default createAdvisorMemoryApi();
