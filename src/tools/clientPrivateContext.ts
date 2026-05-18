import { env } from '../config/env.js';
import { ClientPrivateContextSchema, type ClientPrivateContext } from '../schemas/clientPrivateContext.schema.js';

export type ClientPrivateContextResult = {
  ok: boolean;
  context: ClientPrivateContext | null;
  limitation?: string;
};

function normalizeNemo(nemo: string): string {
  return nemo.trim().toUpperCase().slice(0, 8);
}

function buildUrl(nemo: string): string {
  if (!env.ENERGYOS_DATA_ROOM_FUNCTION_URL) {
    throw new Error('ENERGYOS_DATA_ROOM_FUNCTION_URL no configurado');
  }

  const url = new URL(env.ENERGYOS_DATA_ROOM_FUNCTION_URL);
  url.searchParams.set('nemo', normalizeNemo(nemo));
  return url.toString();
}

export async function getClientPrivateContext(input: {
  nemo: string;
  userToken?: string;
}): Promise<ClientPrivateContextResult> {
  if (!env.ENABLE_PRIVATE_CONTEXT) {
    return { ok: false, context: null, limitation: 'Contexto privado deshabilitado por configuracion.' };
  }

  if (!env.ENERGYOS_DATA_ROOM_FUNCTION_URL) {
    return { ok: false, context: null, limitation: 'Falta configurar ENERGYOS_DATA_ROOM_FUNCTION_URL.' };
  }

  if (!input.userToken) {
    return { ok: false, context: null, limitation: 'No se recibio JWT de usuario para consultar el Data Room privado.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.ENERGYOS_PRIVATE_CONTEXT_TIMEOUT_MS);

  try {
    const response = await fetch(buildUrl(input.nemo), {
      headers: {
        Authorization: `Bearer ${input.userToken}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        context: null,
        limitation: `Data Room privado no disponible por autorizacion (${response.status}).`,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        context: null,
        limitation: `Data Room privado no disponible (${response.status}).`,
      };
    }

    const payload = await response.json();
    const parsed = ClientPrivateContextSchema.safeParse(payload);
    if (!parsed.success) {
      console.error('Invalid private context schema:', parsed.error.issues);
      return {
        ok: false,
        context: null,
        limitation: 'El Data Room privado respondio con un formato invalido.',
      };
    }

    return { ok: true, context: parsed.data };
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'timeout'
      : 'error de red';
    return {
      ok: false,
      context: null,
      limitation: `No se pudo consultar el Data Room privado: ${message}.`,
    };
  } finally {
    clearTimeout(timeout);
  }
}
