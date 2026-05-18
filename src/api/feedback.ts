import { Hono } from 'hono';
import { FeedbackInputSchema } from '../schemas/api.schema.js';
import { updateRecommendationStatus } from '../memory/recommendations.js';
import { requireAuthIfConfigured } from './auth.js';

const app = new Hono();

/**
 * POST /agent/feedback
 *
 * Guarda feedback del usuario sobre una recomendación.
 */
app.post('/', async (c) => {
  const auth = await requireAuthIfConfigured(c);
  if (!auth.ok) return auth.response;

  const body = await c.req.json();
  const parsed = FeedbackInputSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({
      error: 'Input inválido',
      details: parsed.error.issues,
    }, 400);
  }

  const { recommendationId, status, comment } = parsed.data;

  const success = await updateRecommendationStatus(recommendationId, status, comment);

  if (!success) {
    return c.json({ error: 'No se pudo actualizar la recomendación' }, 500);
  }

  return c.json({ ok: true, recommendationId, status });
});

export default app;
