type SmokeConfig = {
  dataRoomUrl: string;
  agentUrl?: string;
  token: string;
  nemo: string;
  companyId?: string;
  period?: string;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

function loadConfig(): SmokeConfig {
  return {
    dataRoomUrl: required('ENERGYOS_DATA_ROOM_FUNCTION_URL'),
    agentUrl: process.env.ENERGYOS_AGENT_URL,
    token: required('ENERGYOS_SMOKE_USER_JWT'),
    nemo: required('ENERGYOS_SMOKE_NEMO').trim().toUpperCase(),
    companyId: process.env.ENERGYOS_SMOKE_COMPANY_ID,
    period: process.env.ENERGYOS_SMOKE_PERIOD,
  };
}

async function getJson(url: string, token?: string) {
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Keep plain text body for diagnostics.
  }
  return { status: response.status, body };
}

async function postJson(url: string, token: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const responseBody = await response.json().catch(() => null);
  return { status: response.status, body: responseBody };
}

function withNemo(baseUrl: string, nemo: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set('nemo', nemo);
  return url.toString();
}

const config = loadConfig();

const noToken = await getJson(withNemo(config.dataRoomUrl, config.nemo));
console.log('ai-context without token:', noToken.status);
if (noToken.status !== 401) throw new Error(`Expected 401 without token, got ${noToken.status}`);

const authorized = await getJson(withNemo(config.dataRoomUrl, config.nemo), config.token);
console.log('ai-context authorized:', authorized.status);
if (authorized.status !== 200) throw new Error(`Expected 200 with token, got ${authorized.status}`);

if (authorized.body && typeof authorized.body === 'object') {
  const body = authorized.body as {
    contracts?: unknown[];
    missingData?: unknown[];
    warnings?: unknown[];
    completeness?: { overallPct?: number };
  };
  console.log('ai-context summary:', {
    contracts: body.contracts?.length ?? 0,
    missingData: body.missingData?.length ?? 0,
    warnings: body.warnings?.length ?? 0,
    completenessPct: body.completeness?.overallPct ?? null,
  });
}

if (config.agentUrl && config.companyId && config.period) {
  const agentResponse = await postJson(`${config.agentUrl.replace(/\/$/, '')}/agent/analyze-period`, config.token, {
    companyId: config.companyId,
    nemo: config.nemo,
    period: config.period,
    includePrivateContext: true,
  });
  console.log('agent analyze-period with private context:', agentResponse.status);
  if (agentResponse.status !== 200) {
    throw new Error(`Expected agent 200, got ${agentResponse.status}`);
  }
}

console.log('smoke ai-context completed');
