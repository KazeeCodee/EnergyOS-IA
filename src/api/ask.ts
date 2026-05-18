import { Hono } from 'hono';
import { AskInputSchema } from '../schemas/api.schema.js';
import { requireAuthorizedNemoIfConfigured } from './auth.js';
import { buildGreetingResponse, isSimpleGreeting } from '../utils/chatIntent.js';
import { runAdvisorChat } from '../advisor/orchestrator.js';

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

  const { companyId, companyName, nemo, period, question, includePrivateContext, files } = parsed.data;
  const auth = await requireAuthorizedNemoIfConfigured(c, nemo);
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

  if (!nemo) {
    return c.json({
      error: 'NEMO requerido para responder con EnergyOS Advisor.',
    }, 400);
  }

  try {
    const result = await runAdvisorChat({
      companyId,
      companyName,
      nemo: auth.nemo ?? nemo,
      period,
      question,
      includePrivateContext,
      files,
    }, {
      userToken: auth.token,
    });

    return c.json({
      response: result.response,
      model: 'advisor-v2',
      provider: 'energyos',
      iterations: 0,
      totalTokens: { input: 0, output: 0 },
      advisor: result,
    });
  } catch (error) {
    console.error('Error in ask:', error);
    return c.json({ error: 'Error interno del agente al responder la consulta.' }, 500);
  }
});

export default app;
