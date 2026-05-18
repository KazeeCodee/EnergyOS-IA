import type { Context } from 'hono';
import { env } from '../config/env.js';
import { supabase } from '../db/client.js';

export type AuthResult = {
  ok: boolean;
  token?: string;
  userId?: string;
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
