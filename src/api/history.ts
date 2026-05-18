import { Hono } from 'hono';
import { supabase } from '../db/client.js';
import { getActiveRecommendations } from '../memory/recommendations.js';
import { requireAuthIfConfigured } from './auth.js';

const app = new Hono();

/**
 * GET /agent/analysis/:companyId/:period
 *
 * Obtiene un análisis previamente generado.
 */
app.get('/analysis/:companyId/:period', async (c) => {
  const auth = await requireAuthIfConfigured(c);
  if (!auth.ok) return auth.response;

  const companyId = c.req.param('companyId');
  const period = c.req.param('period');

  const { data, error } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('company_id', companyId)
    .eq('period', period)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  if (!data) {
    return c.json({ error: 'No se encontró análisis para este período' }, 404);
  }

  return c.json(data.output_payload);
});

/**
 * GET /agent/recommendations/:companyId
 *
 * Lista recomendaciones activas de una empresa.
 */
app.get('/recommendations/:companyId', async (c) => {
  const auth = await requireAuthIfConfigured(c);
  if (!auth.ok) return auth.response;

  const companyId = c.req.param('companyId');
  const recommendations = await getActiveRecommendations(companyId);
  return c.json({ recommendations });
});

export default app;
