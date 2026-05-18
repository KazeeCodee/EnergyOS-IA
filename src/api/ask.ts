import { Hono } from 'hono';
import { AskInputSchema } from '../schemas/api.schema.js';
import { createProviderFromEnv } from '../providers/factory.js';
import { runAgenticLoop } from '../reasoning/agenticLoop.js';
import { requireAuthIfConfigured } from './auth.js';

const app = new Hono();

app.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = AskInputSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({
      error: 'Input invalido',
      details: parsed.error.issues,
    }, 400);
  }

  const provider = createProviderFromEnv();
  if (!provider) {
    return c.json({
      error: 'No hay proveedor de IA configurado para responder chat.',
    }, 503);
  }

  const { companyId, nemo, period, question, includePrivateContext } = parsed.data;
  const auth = await requireAuthIfConfigured(c);
  if (!auth.ok) return auth.response;

  if (includePrivateContext && !auth.token) {
    return c.json({
      error: 'Authorization Bearer token requerido para usar contexto privado',
    }, 401);
  }

  const taskMessage = `Responde la pregunta del usuario como EnergyOS Analyst.

Contexto solicitado:
- Empresa: ${companyId}
- NEMO: ${nemo ?? 'no informado'}
- Periodo: ${period ?? 'no informado'}
- Usar contexto privado: ${includePrivateContext ? 'si' : 'no'}

Pregunta:
${question}

Instrucciones:
1. Si la pregunta requiere datos energeticos del periodo, usa calculate_metrics y detect_anomalies.
2. Si la pregunta requiere contratos, vencimientos, responsables, evidencia o datos faltantes, usa get_client_private_context con el NEMO.
3. No inventes datos. Si falta informacion, declarala.
4. Separa hechos, interpretacion, recomendacion y limitaciones.`;

  const result = await runAgenticLoop(provider, taskMessage, { userToken: auth.token });

  return c.json({
    response: result.response,
    model: result.model,
    provider: result.provider,
    iterations: result.iterations,
    totalTokens: result.totalTokens,
  });
});

export default app;
