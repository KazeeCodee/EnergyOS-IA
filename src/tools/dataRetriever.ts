import { supabase, createRailwaySql, type RailwaySql } from '../db/client.js';

// ─── Tipos de datos que devuelve cada query ────────────────────────────────

export type MonthlyDataRow = {
  empresa_id: string;
  nemo: string;
  anio: number;
  mes: number;
  demanda_total_mwh: number;
  mater_mwh: number;
  spot_mwh: number;
  porcentaje_renovable: number;
  costo_renovable_usd_mwh: number;
  costo_spot_usd_mwh: number;
  costo_total_estimado_usd: number;
  dato_sospechoso: boolean;
  sospechoso_motivo: string | null;
};

export type ExposicionRow = {
  nemo: string;
  anio: number;
  mes: number;
  demanda_real_mwh: string | null;
  demanda_contratada_mwh: string | null;
  compra_spot_mwh: string | null;
  pct_spot: string | null;
  pct_mat: string | null;
  sub_contrato_mwh: string | null;
  costo_spot_promedio_pesos_mwh: string | null;
};

export type DteResumenRow = {
  anio: number;
  mes: number;
  agente_nemo: string;
  concepto: string;
  pesos: number | null;
  mwh: number | null;
};

export type CompanyProfile = {
  id: string;
  razon_social: string;
  nemo: string;
  tipo_agente: string | null;
};

// ─── Data Retriever ────────────────────────────────────────────────────────

/**
 * Obtiene el perfil de la empresa (agente monitoreado).
 */
export async function getCompanyProfile(companyId: string): Promise<CompanyProfile | null> {
  const { data, error } = await supabase
    .from('agentes_monitoreados')
    .select('id, razon_social, nemo, tipo_agente')
    .eq('id', companyId)
    .single();

  if (error || !data) return null;
  return data as CompanyProfile;
}

/**
 * Obtiene los datos mensuales de una empresa para un rango de períodos.
 * Lee de Supabase (tabla datos_mensuales).
 */
export async function getMonthlyData(
  companyId: string,
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
): Promise<MonthlyDataRow[]> {
  const { data, error } = await supabase
    .from('datos_mensuales')
    .select('*')
    .eq('empresa_id', companyId)
    .or(
      `and(anio.gte.${fromYear},anio.lte.${toYear})`
    )
    .order('anio', { ascending: true })
    .order('mes', { ascending: true });

  if (error) {
    console.error('Error fetching monthly data:', error.message);
    return [];
  }

  // Filtrar por rango exacto de períodos
  return (data ?? []).filter((row: MonthlyDataRow) => {
    const rowPeriod = row.anio * 100 + row.mes;
    const fromPeriod = fromYear * 100 + fromMonth;
    const toPeriod = toYear * 100 + toMonth;
    return rowPeriod >= fromPeriod && rowPeriod <= toPeriod;
  });
}

/**
 * Obtiene datos de un solo período.
 */
export async function getPeriodData(
  companyId: string,
  year: number,
  month: number,
): Promise<MonthlyDataRow | null> {
  const rows = await getMonthlyData(companyId, year, month, year, month);
  return rows[0] ?? null;
}

/**
 * Obtiene el historial de N meses hacia atrás desde un período dado.
 */
export async function getHistoricalData(
  companyId: string,
  year: number,
  month: number,
  monthsBack: number,
): Promise<MonthlyDataRow[]> {
  // Calcular fecha de inicio
  let fromMonth = month - monthsBack;
  let fromYear = year;
  while (fromMonth <= 0) {
    fromMonth += 12;
    fromYear -= 1;
  }
  return getMonthlyData(companyId, fromYear, fromMonth, year, month);
}

/**
 * Obtiene datos de exposición spot desde Railway.
 */
export async function getExposicionData(
  nemo: string,
  months: number = 24,
): Promise<ExposicionRow[]> {
  const sql = createRailwaySql();
  try {
    const rows = await sql<ExposicionRow[]>`
      select
        nemo, anio, mes,
        demanda_real_mwh, demanda_contratada_mwh,
        compra_spot_mwh, pct_spot, pct_mat,
        sub_contrato_mwh, costo_spot_promedio_pesos_mwh
      from public.vw_exposicion_spot_mensual
      where nemo = ${nemo}
      order by anio desc, mes desc
      limit ${months}
    `;
    return rows.reverse();
  } catch (error) {
    console.error('Error fetching exposicion data from Railway:', error);
    return [];
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * Obtiene el resumen DTE (facturación) desde Railway.
 */
export async function getDteResumenData(
  nemo: string,
  year: number,
  month: number,
  monthsBack: number = 12,
): Promise<DteResumenRow[]> {
  const sql = createRailwaySql();
  try {
    const rows = await sql<DteResumenRow[]>`
      select anio, mes, agente_nemo, concepto,
             sum(pesos) as pesos,
             sum(mwh) as mwh
      from public.dte_resumen_agente
      where agente_nemo = ${nemo}
        and (anio * 100 + mes) between
            ${(year * 100 + month) - monthsBack * 100 / 12}
            and ${year * 100 + month}
      group by anio, mes, agente_nemo, concepto
      order by anio, mes
    `;
    return rows;
  } catch (error) {
    console.error('Error fetching DTE data from Railway:', error);
    return [];
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * Obtiene datos de mercado para un período.
 */
export async function getMarketData(year: number, month: number) {
  const { data, error } = await supabase
    .from('datos_mercado')
    .select('*')
    .eq('anio', year)
    .eq('mes', month)
    .single();

  if (error) return null;
  return data;
}

/**
 * Obtiene el análisis previo del agente para un período (si existe).
 */
export async function getPreviousAgentAnalysis(
  companyId: string,
  period: string,
) {
  const { data, error } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('company_id', companyId)
    .eq('period', period)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data;
}
