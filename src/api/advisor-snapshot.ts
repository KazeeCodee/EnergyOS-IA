import { Hono } from 'hono';
import { AdvisorSnapshotQuerySchema } from '../schemas/advisor.schema.js';
import { buildEnergySnapshot } from '../context/energyosSnapshot.js';
import { requireAuthorizedNemoIfConfigured } from './auth.js';

const app = new Hono();

app.get('/', async (c) => {
  const parsed = AdvisorSnapshotQuerySchema.safeParse({
    companyId: c.req.query('companyId'),
    companyName: c.req.query('companyName'),
    nemo: c.req.query('nemo'),
    period: c.req.query('period'),
    includePrivateContext: c.req.query('includePrivateContext') ?? false,
  });

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
    const snapshot = await buildEnergySnapshot({
      ...parsed.data,
      nemo: auth.nemo ?? parsed.data.nemo,
      userToken: auth.token,
    });
    return c.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno al construir snapshot';
    console.error('Error in advisor-snapshot:', error);
    return c.json({ error: message }, 500);
  }
});

export default app;
