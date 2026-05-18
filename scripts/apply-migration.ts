import postgres from 'postgres';
import { readFileSync } from 'fs';

const url = 'postgresql://postgres:aG3YeUyBrBysGXl5@db.vhdfkxtkhxuurlbduqru.supabase.co:5432/postgres';
const sql = postgres(url, { ssl: 'require' });

async function run() {
  try {
    const file = readFileSync('src/db/migrations/001_agent_tables.sql', 'utf8');
    await sql.unsafe(file);
    console.log('✅ Migración de Supabase aplicada correctamente.');
  } catch (err) {
    console.error('❌ Error aplicando migración:', err);
  } finally {
    await sql.end();
  }
}

run();
