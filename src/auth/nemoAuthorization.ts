export type SupabaseNemoAuthClient = {
  auth: {
    getUser: (token: string) => Promise<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
  };
  rpc: (name: 'current_user_nemos') => PromiseLike<{
    data: unknown;
    error: { message?: string } | null;
  }>;
};

export type NemoAuthorizationResult = {
  ok: boolean;
  status?: number;
  error?: string;
  token?: string;
  userId?: string;
  nemo?: string;
  authorizedNemos?: string[];
};

export function normalizeNemo(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase().slice(0, 8);
}

export function readAuthorizedNemos(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  const nemos = data
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'nemo' in item) {
        const value = (item as { nemo?: unknown }).nemo;
        return typeof value === 'string' ? value : '';
      }
      return '';
    })
    .map(normalizeNemo)
    .filter((value) => /^[A-Z0-9]{8}$/.test(value));

  return [...new Set(nemos)];
}

export async function authorizeNemo(input: {
  token: string | undefined;
  requestedNemo: string | undefined;
  supabaseClient: SupabaseNemoAuthClient;
}): Promise<NemoAuthorizationResult> {
  if (!input.token) {
    return { ok: false, status: 401, error: 'Authorization Bearer token requerido' };
  }

  const { data: userData, error: userError } = await input.supabaseClient.auth.getUser(input.token);
  if (userError || !userData.user) {
    return { ok: false, status: 401, error: 'JWT invalido' };
  }

  const { data: nemosData, error: nemosError } = await input.supabaseClient.rpc('current_user_nemos');
  if (nemosError) {
    return { ok: false, status: 500, error: nemosError.message ?? 'No se pudieron resolver NEMOs autorizados' };
  }

  const authorizedNemos = readAuthorizedNemos(nemosData);
  if (authorizedNemos.length === 0) {
    return { ok: false, status: 403, error: 'El usuario no tiene agentes vinculados' };
  }

  const requestedNemo = normalizeNemo(input.requestedNemo);
  if (!requestedNemo) {
    if (authorizedNemos.length === 1) {
      return {
        ok: true,
        token: input.token,
        userId: userData.user.id,
        nemo: authorizedNemos[0],
        authorizedNemos,
      };
    }
    return { ok: false, status: 400, error: 'Parametro nemo requerido para usuarios multi-agente' };
  }

  if (!authorizedNemos.includes(requestedNemo)) {
    return { ok: false, status: 403, error: `NEMO no autorizado para este usuario: ${requestedNemo}` };
  }

  return {
    ok: true,
    token: input.token,
    userId: userData.user.id,
    nemo: requestedNemo,
    authorizedNemos,
  };
}
