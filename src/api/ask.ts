import { Hono } from 'hono';
import { AskInputSchema } from '../schemas/api.schema.js';
import { createProviderFromEnv } from '../providers/factory.js';
import { runAgenticLoop } from '../reasoning/agenticLoop.js';
import { requireAuthIfConfigured } from './auth.js';
import { buildAskTaskMessage, buildGreetingResponse, isSimpleGreeting } from '../utils/chatIntent.js';

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

  const { companyId, companyName, nemo, period, question, includePrivateContext } = parsed.data;
  const auth = await requireAuthIfConfigured(c);
  if (!auth.ok) return auth.response;

  if (includePrivateContext && !auth.token) {
    return c.json({
      error: 'Authorization Bearer token requerido para usar contexto privado',
    }, 401);
  }

  if (isSimpleGreeting(question)) {
    return c.json({
      response: buildGreetingResponse({ companyName, nemo, period }),
      model: 'deterministic',
      provider: 'energyos',
      iterations: 0,
      totalTokens: { input: 0, output: 0 },
    });
  }

  const provider = createProviderFromEnv();
  if (!provider) {
    return c.json({
      error: 'No hay proveedor de IA configurado para responder chat.',
    }, 503);
  }

  const taskMessage = buildAskTaskMessage({ companyId, companyName, nemo, period, question, includePrivateContext });

  let result;
  try {
    result = await runAgenticLoop(provider, taskMessage, { userToken: auth.token });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido del proveedor IA';
    console.error('Error in ask:', error);
    if (isProviderUnavailableError(message)) {
      return c.json({
        error: 'El proveedor de IA esta temporalmente saturado. Proba nuevamente en unos minutos.',
        provider: provider.name,
        model: provider.model,
      }, 503);
    }
    return c.json({ error: 'Error interno del agente al responder la consulta.' }, 500);
  }

  return c.json({
    response: result.response,
    model: result.model,
    provider: result.provider,
    iterations: result.iterations,
    totalTokens: result.totalTokens,
  });
});

function isProviderUnavailableError(message: string): boolean {
  return /Gemini API error (429|500|502|503|504)|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand/i.test(message);
}

export default app;
