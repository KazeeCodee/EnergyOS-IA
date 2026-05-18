import { Hono } from 'hono';
import { AnalyzePeriodInputSchema } from '../schemas/api.schema.js';
import { analyzePeriod } from '../orchestrator/analyzePeriod.js';
import { generateActionPlan } from '../actionPlan/actionPlanGenerator.js';
import { requireAuthIfConfigured } from './auth.js';

const app = new Hono();

app.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = AnalyzePeriodInputSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({
      error: 'Input invalido',
      details: parsed.error.issues,
    }, 400);
  }

  const { companyId, period, nemo, includePrivateContext } = parsed.data;
  const auth = await requireAuthIfConfigured(c);
  if (!auth.ok) return auth.response;

  if (includePrivateContext && !auth.token) {
    return c.json({
      error: 'Authorization Bearer token requerido para usar contexto privado',
    }, 401);
  }

  const analysis = await analyzePeriod(companyId, period, {
    nemo,
    includePrivateContext,
    userToken: auth.token,
  });

  return c.json({
    actionPlan: generateActionPlan(analysis),
  });
});

export default app;
