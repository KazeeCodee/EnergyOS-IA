import { Hono } from 'hono';
import { AdvisorChatInputSchema } from '../schemas/advisor.schema.js';
import { runAdvisorChat } from '../advisor/orchestrator.js';
import { requireAuthorizedNemoIfConfigured } from './auth.js';
import { createDefaultAdvisorRunStore } from '../advisor/runStore.js';

const app = new Hono();

app.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = AdvisorChatInputSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({
      error: 'Input invalido',
      details: parsed.error.issues,
    }, 400);
  }

  const auth = await requireAuthorizedNemoIfConfigured(c, parsed.data.nemo);
  if (!auth.ok) return auth.response;

  if (parsed.data.includePrivateContext && !auth.token) {
    return c.json({
      error: 'Authorization Bearer token requerido para usar contexto privado',
    }, 401);
  }

  try {
    const runStore = await createDefaultAdvisorRunStore();
    const result = await runAdvisorChat({
      ...parsed.data,
      nemo: auth.nemo ?? parsed.data.nemo,
    }, {
      userToken: auth.token,
      runStore,
    });
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del advisor';
    console.error('Error in advisor-chat:', error);
    return c.json({ error: message }, 500);
  }
});

export default app;
