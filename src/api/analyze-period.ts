import { Hono } from 'hono';
import { AnalyzePeriodInputSchema } from '../schemas/api.schema.js';
import { analyzePeriod } from '../orchestrator/analyzePeriod.js';
import { requireAuthIfConfigured } from './auth.js';

const app = new Hono();

/**
 * POST /agent/analyze-period
 *
 * Genera diagnóstico automático de un período para una empresa.
 *
 * Input:
 * {
 *   "companyId": "uuid",
 *   "period": "2026-04",
 *   "analysisType": "monthly_diagnosis"
 * }
 */
app.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = AnalyzePeriodInputSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({
      error: 'Input inválido',
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

  try {
    const result = await analyzePeriod(companyId, period, {
      nemo,
      includePrivateContext,
      userToken: auth.token,
    });
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del agente';
    console.error('Error in analyze-period:', error);
    return c.json({ error: message }, 500);
  }
});

export default app;
