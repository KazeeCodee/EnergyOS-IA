import postgres from 'postgres';
import { env } from './src/config/env.js';

async function describeTable() {
  const sqlRailway = postgres(env.RAILWAY_DATABASE_URL, { ssl: false });
  try {
    const cols = await sqlRailway`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'cammesa_agentes_mem'
    `;
    console.log('--- cammesa_agentes_mem COLUMNS ---');
    cols.forEach(c => console.log(`${c.column_name}: ${c.data_type}`));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sqlRailway.end();
  }
}

describeTable();
