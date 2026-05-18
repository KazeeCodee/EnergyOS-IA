import { Hono } from 'hono';
import { ReconcileInvoiceInputSchema } from '../schemas/api.schema.js';
import { requireAuthIfConfigured } from './auth.js';
import { getClientPrivateContext } from '../tools/clientPrivateContext.js';
import { reconcileInvoice } from '../reconciliation/reconciliationEngine.js';

const app = new Hono();

app.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = ReconcileInvoiceInputSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({
      error: 'Input invalido',
      details: parsed.error.issues,
    }, 400);
  }

  const auth = await requireAuthIfConfigured(c);
  if (!auth.ok) return auth.response;

  const { nemo, period, includePrivateContext, invoices } = parsed.data;

  if (includePrivateContext && !auth.token) {
    return c.json({
      error: 'Authorization Bearer token requerido para usar contexto privado',
    }, 401);
  }

  const contextResult = includePrivateContext
    ? await getClientPrivateContext({ nemo, userToken: auth.token })
    : { ok: false as const, context: null, limitation: 'Contexto privado no solicitado.' };

  const reconciliation = reconcileInvoice({
    period,
    context: contextResult.context,
    invoices,
  });

  const limitations = [...reconciliation.limitations];
  if (!contextResult.ok && contextResult.limitation) {
    limitations.push(contextResult.limitation);
  }

  return c.json({
    reconciliation: {
      ...reconciliation,
      limitations,
    },
  });
});

export default app;
