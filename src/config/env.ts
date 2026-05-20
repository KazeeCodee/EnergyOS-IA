import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Cargar .env.local si existe (Node.js no lo hace automáticamente)
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch {
  // .env.local no existe — usar variables de entorno del sistema
}

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RAILWAY_DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3100),
  ENERGYOS_DATA_ROOM_FUNCTION_URL: z.string().url().optional(),
  ENERGYOS_PRIVATE_CONTEXT_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  ENABLE_PRIVATE_CONTEXT: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
  REQUIRE_AGENT_AUTH: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),

  // IA — al menos uno debe estar configurado para modo agéntico
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
  GEMINI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(4096),
  GOOGLE_AI_API_KEY: z.string().optional(),
  GOOGLE_AI_MODEL: z.string().optional(),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Variables de entorno inválidas:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
export type Env = z.infer<typeof envSchema>;
