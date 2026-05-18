import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { env } from '../config/env.js';

/**
 * Supabase client con service_role key.
 * Se usa para:
 *  - Autenticación / validación de JWT del usuario
 *  - Lectura/escritura de tablas agent_* (resultados del agente)
 *  - Lectura de datos_mensuales, datos_mercado, agentes_monitoreados
 */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/**
 * Conexión directa a Railway PostgreSQL.
 * Se usa para las consultas pesadas sobre datos energéticos reales
 * (vistas L2, raw_dte, parámetros mensuales, exposición, etc.)
 *
 * Mismo patrón que las Edge Functions existentes de EnergyOS.
 */
export function createRailwaySql() {
  return postgres(env.RAILWAY_DATABASE_URL, {
    max: 3,
    idle_timeout: 30,
    connect_timeout: 20,
    prepare: false,
    // Railway public proxy: ssl false como en las Edge Functions existentes
    ssl: false,
  });
}

/** Tipo del cliente SQL de Railway */
export type RailwaySql = ReturnType<typeof createRailwaySql>;
