import { Hono } from 'hono';
import {
  AdvisorTaskApprovalSchema,
  createAdvisorTask,
} from '../advisor/taskStore.js';
import { requireAuthorizedNemoIfConfigured } from './auth.js';

const app = new Hono();

app.post('/approve', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Input invalido', details: 'JSON invalido' }, 400);
  }

  const parsed = AdvisorTaskApprovalSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({
      error: 'Input invalido',
      details: parsed.error.issues,
    }, 400);
  }

  const auth = await requireAuthorizedNemoIfConfigured(c, parsed.data.nemo);
  if (!auth.ok) return auth.response;

  try {
    const task = await createAdvisorTask({
      approval: {
        ...parsed.data,
        nemo: auth.nemo ?? parsed.data.nemo,
      },
      createdByUserId: auth.userId,
    });
    return c.json({ task });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno al crear tarea';
    console.error('Error in advisor-tasks:', error);
    return c.json({ error: message }, 500);
  }
});

export default app;
