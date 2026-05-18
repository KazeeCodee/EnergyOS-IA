import type { Context } from 'hono';
import { env } from '../config/env.js';
import { supabase } from '../db/client.js';
import { authorizeNemo } from '../auth/nemoAuthorization.js';

export type AuthResult = {
  ok: boolean;
  token?: string;
  userId?: string;
  nemo?: string;
  authorizedNemos?: string[];
  response?: Response;
};

export function extractBearerToken(headerValue: string | undefined | null): string | null {
  if (!headerValue) return null;
  const match = /^bearer\s+(.+)$/i.exec(headerValue.trim());
  return match?.[1] ?? null;
}

export function getRequestToken(c: Context): string | undefined {
  return extractBearerToken(c.req.header('Authorization') ?? c.req.header('authorization')) ?? undefined;
}

export async function requireAuthIfConfigured(c: Context): Promise<AuthResult> {
  const token = getRequestToken(c);

  if (!env.REQUIRE_AGENT_AUTH) {
    return { ok: true, token };
  }

  if (!token) {
    return {
      ok: false,
      response: c.json({ error: 'Authorization Bearer token requerido' }, 401),
    };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return {
      ok: false,
      response: c.json({ error: 'JWT invalido' }, 401),
    };
  }

  return {
    ok: true,
    token,
    userId: data.user.id,
  };
}

export async function requireAuthorizedNemoIfConfigured(
  c: Context,
  requestedNemo: string | undefined,
): Promise<AuthResult> {
  const auth = await requireAuthIfConfigured(c);
  if (!auth.ok) return auth;

  if (!env.REQUIRE_AGENT_AUTH) {
    return {
      ...auth,
      nemo: requestedNemo?.trim().toUpperCase().slice(0, 8),
    };
  }

  const result = await authorizeNemo({
    token: auth.token,
    requestedNemo,
    supabaseClient: supabase,
  });

  if (!result.ok) {
    return {
      ok: false,
      response: c.json({ error: result.error }, result.status as 400 | 401 | 403 | 500),
    };
  }

  return {
    ok: true,
    token: auth.token,
    userId: result.userId,
    nemo: result.nemo,
    authorizedNemos: result.authorizedNemos,
  };
}
