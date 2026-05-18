import postgres from 'postgres';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

async function run() {
  loadEnvLocal();

  const url = process.env.RAILWAY_DATABASE_URL;
  if (!url) {
    throw new Error('RAILWAY_DATABASE_URL no esta configurada.');
  }

  const migrationPath = process.argv[2] ?? 'src/db/migrations/002_advisor_conversation_memory.sql';
  const file = readFileSync(resolve(process.cwd(), migrationPath), 'utf8');
  const sql = postgres(url, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 20,
    prepare: false,
    ssl: false,
  });

  try {
    await sql.unsafe(file);
    console.log(`Migracion aplicada correctamente: ${migrationPath}`);
  } catch (err) {
    console.error('Error aplicando migracion:', err);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

run();
