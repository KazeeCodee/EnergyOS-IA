import { createRailwaySql } from '../db/client.js';
import { getClientPrivateContext } from '../tools/clientPrivateContext.js';
import {
  EnergySnapshotSchema,
  type EnergySnapshot,
} from '../schemas/advisor.schema.js';
import type { ClientPrivateContextResult } from '../tools/clientPrivateContext.js';

export type SnapshotSql = {
  <T extends unknown[] = unknown[]>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  end?: (options?: { timeout?: number }) => Promise<void>;
};

export type EnergySnapshotInput = {
  companyId: string;
  companyName?: string;
  nemo: string;
  period?: string;
  includePrivateContext?: boolean;
  userToken?: string;
  sqlFactory?: () => SnapshotSql;
  privateContextLoader?: typeof getClientPrivateContext;
};

type AgentRow = {
  nemo: string;
  descripcion: string | null;
  tipo_agente: string | null;
  agrupacion: string | null;
};

type ConsumptionRow = {
  tipo_agente?: string | null;
  nemo: string;
  anio: number;
  mes: number;
  demanda_real_mwh: string | number | null;
  demanda_contratada_mwh: string | number | null;
  compra_spot_mwh: string | number | null;
  demanda_real_pico_mwh: string | number | null;
  demanda_real_valle_mwh: string | number | null;
  demanda_real_resto_mwh: string | number | null;
};

type ExposureRow = {
  anio: number;
  mes: number;
  pct_spot: string | number | null;
  pct_mat: string | number | null;
  spot_pesos: string | number | null;
  costo_spot_promedio_pesos_mwh: string | number | null;
  sub_contrato_mwh: string | number | null;
  sobre_contrato_mwh: string | number | null;
  calidad_dato: string | null;
};

type InvoiceRow = {
  anio: number;
  mes: number;
  factura_total_pesos: string | number | null;
  costo_dte_pesos_mwh: string | number | null;
  energia_pesos: string | number | null;
  potencia_pesos: string | number | null;
  transporte_pesos: string | number | null;
  importe_revisable_pesos: string | number | null;
  estado_auditoria: string | null;
  conceptos_count: string | number | null;
};

type InvoiceConceptRow = {
  bloque_codigo: string | null;
  bloque_nombre: string | null;
  concepto_codigo: string | null;
  concepto_nombre: string | null;
  importe_pesos: string | number | null;
  source_file: string | null;
  source_row_desde: number | null;
  source_row_hasta: number | null;
  source_rows_count: number | null;
};

type ComplianceRow = {
  anio: number;
  mes: number;
  pct_renovable_real: string | number | null;
  pct_renovable_ytd: string | number | null;
  cumple_mes: boolean | null;
  cumple_ytd: boolean | null;
  brecha_mwh: string | number | null;
  brecha_ytd_mwh: string | number | null;
  multa_estimada_pesos: string | number | null;
  calidad_dato: string | null;
};

type LoadFactorRow = {
  anio: number;
  mes: number;
  pct_pico: string | number | null;
  pct_valle: string | number | null;
  pct_resto: string | number | null;
  ratio_pico_valle: string | number | null;
  calidad_dato: string | null;
};

type MarketRow = {
  anio: number;
  mes: number;
  fuente: string | null;
  periodo_completo: boolean | null;
  generacion_total_gwh: string | number | null;
  renovable_ley_26190_pct: string | number | null;
};

function normalizeNemo(nemo: string): string {
  return nemo.trim().toUpperCase().slice(0, 8);
}

function parsePeriod(period: string): { anio: number; mes: number } {
  const match = period.match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error(`Periodo invalido: ${period}`);
  const anio = Number(match[1]);
  const mes = Number(match[2]);
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new Error(`Periodo invalido: ${period}`);
  }
  return { anio, mes };
}

function periodo(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function countValue(value: unknown): number {
  const parsed = toNumber(value as string | number | null | undefined);
  return parsed === null ? 0 : Math.max(0, Math.trunc(parsed));
}

function availability(rows: number, reason?: string) {
  return {
    available: rows > 0,
    rows,
    ...(rows > 0 || !reason ? {} : { reason }),
  };
}

function mapConsumption(row: ConsumptionRow) {
  return {
    periodo: periodo(row.anio, row.mes),
    anio: row.anio,
    mes: row.mes,
    demandaRealMwh: toNumber(row.demanda_real_mwh),
    demandaContratadaMwh: toNumber(row.demanda_contratada_mwh),
    compraSpotMwh: toNumber(row.compra_spot_mwh),
    demandaRealPicoMwh: toNumber(row.demanda_real_pico_mwh),
    demandaRealValleMwh: toNumber(row.demanda_real_valle_mwh),
    demandaRealRestoMwh: toNumber(row.demanda_real_resto_mwh),
  };
}

function addDataState(
  rows: number,
  source: string,
  missingLabel: string,
  dataUsed: string[],
  missingData: string[],
) {
  if (rows > 0) dataUsed.push(source);
  else missingData.push(missingLabel);
}

async function resolveSelectedPeriod(
  sql: SnapshotSql,
  nemo: string,
  requestedPeriod?: string,
): Promise<{ anio: number; mes: number; requestedPeriod?: string }> {
  if (requestedPeriod) {
    return { ...parsePeriod(requestedPeriod), requestedPeriod };
  }

  const latestRows = await sql<Array<{ anio: number; mes: number }>>`
    select anio, mes
    from public.vw_consumo_gu_mensual
    where nemo = ${nemo}
    order by anio desc, mes desc
    limit 1
  `;

  const latest = latestRows[0];
  if (!latest) {
    return { anio: new Date().getUTCFullYear(), mes: new Date().getUTCMonth() + 1 };
  }
  return latest;
}

export async function buildEnergySnapshot(input: EnergySnapshotInput): Promise<EnergySnapshot> {
  const nemo = normalizeNemo(input.nemo);
  const sql = input.sqlFactory ? input.sqlFactory() : createRailwaySql() as SnapshotSql;
  const privateContextLoader = input.privateContextLoader ?? getClientPrivateContext;

  try {
    const selected = await resolveSelectedPeriod(sql, nemo, input.period);
    const selectedPeriod = periodo(selected.anio, selected.mes);

    const [
      agentRows,
      currentRows,
      historyRows,
      exposureRows,
      invoiceRows,
      conceptRows,
      complianceRows,
      loadFactorRows,
      marketRows,
    ] = await Promise.all([
      sql<AgentRow[]>`
        select nemo, descripcion, tipo_agente, agrupacion
        from public.cammesa_agentes_mem
        where nemo = ${nemo}
        limit 1
      `,
      sql<ConsumptionRow[]>`
        select tipo_agente, nemo, anio, mes,
               demanda_real_mwh, demanda_contratada_mwh, compra_spot_mwh,
               demanda_real_pico_mwh, demanda_real_valle_mwh, demanda_real_resto_mwh
        from public.vw_consumo_gu_mensual
        where nemo = ${nemo}
          and anio = ${selected.anio}
          and mes = ${selected.mes}
        limit 1
      `,
      sql<ConsumptionRow[]>`
        select tipo_agente, nemo, anio, mes,
               demanda_real_mwh, demanda_contratada_mwh, compra_spot_mwh,
               demanda_real_pico_mwh, demanda_real_valle_mwh, demanda_real_resto_mwh
        from public.vw_consumo_gu_mensual
        where nemo = ${nemo}
          and (anio * 100 + mes) <= ${selected.anio * 100 + selected.mes}
        order by anio asc, mes asc
        limit 12
      `,
      sql<ExposureRow[]>`
        select anio, mes, pct_spot, pct_mat, spot_pesos,
               costo_spot_promedio_pesos_mwh, sub_contrato_mwh,
               sobre_contrato_mwh, calidad_dato
        from public.vw_exposicion_spot_mensual
        where nemo = ${nemo}
          and anio = ${selected.anio}
          and mes = ${selected.mes}
        limit 1
      `,
      sql<InvoiceRow[]>`
        select anio, mes, factura_total_pesos, costo_dte_pesos_mwh,
               energia_pesos, potencia_pesos, transporte_pesos,
               importe_revisable_pesos, estado_auditoria, conceptos_count
        from public.vw_factura_dte_resumen_mensual
        where nemo = ${nemo}
          and anio = ${selected.anio}
          and mes = ${selected.mes}
        limit 1
      `,
      sql<InvoiceConceptRow[]>`
        select bloque_codigo, bloque_nombre, concepto_codigo, concepto_nombre,
               importe_pesos, source_file, source_row_desde,
               source_row_hasta, source_rows_count
        from public.factura_dte_conceptos_mensual
        where nemo = ${nemo}
          and anio = ${selected.anio}
          and mes = ${selected.mes}
        order by abs(importe_pesos) desc
        limit 30
      `,
      sql<ComplianceRow[]>`
        select anio, mes, pct_renovable_real, pct_renovable_ytd,
               cumple_mes, cumple_ytd, brecha_mwh, brecha_ytd_mwh,
               multa_estimada_pesos, calidad_dato
        from public.vw_compliance_27191_mensual
        where nemo = ${nemo}
          and anio = ${selected.anio}
          and mes = ${selected.mes}
        limit 1
      `,
      sql<LoadFactorRow[]>`
        select anio, mes, pct_pico, pct_valle, pct_resto,
               ratio_pico_valle, calidad_dato
        from public.vw_factor_carga_mensual
        where nemo = ${nemo}
          and anio = ${selected.anio}
          and mes = ${selected.mes}
        limit 1
      `,
      sql<MarketRow[]>`
        select anio, mes, fuente, periodo_completo,
               generacion_total_gwh, renovable_ley_26190_pct
        from public.vw_mercado_resumen_mensual
        where anio = ${selected.anio}
          and mes = ${selected.mes}
        limit 1
      `,
    ]);

    const privateContextResult: ClientPrivateContextResult = input.includePrivateContext
      ? await privateContextLoader({ nemo, userToken: input.userToken })
      : { ok: false, context: null, limitation: 'Contexto privado no solicitado.' };

    const agent = agentRows[0] ?? null;
    const current = currentRows[0] ? mapConsumption(currentRows[0]) : null;
    const exposureRow = exposureRows[0] ?? null;
    const invoiceRow = invoiceRows[0] ?? null;
    const complianceRow = complianceRows[0] ?? null;
    const loadFactorRow = loadFactorRows[0] ?? null;
    const marketRow = marketRows[0] ?? null;

    const dataUsed: string[] = [];
    const missingData: string[] = [];
    const warnings: string[] = [];

    addDataState(agentRows.length, 'public.cammesa_agentes_mem', `identidad del cliente ${nemo}`, dataUsed, missingData);
    addDataState(currentRows.length, 'public.vw_consumo_gu_mensual', `consumo del periodo ${selectedPeriod}`, dataUsed, missingData);
    addDataState(exposureRows.length, 'public.vw_exposicion_spot_mensual', `exposicion spot del periodo ${selectedPeriod}`, dataUsed, missingData);
    addDataState(invoiceRows.length, 'public.vw_factura_dte_resumen_mensual', `DTE/facturacion del periodo ${selectedPeriod}`, dataUsed, missingData);
    addDataState(complianceRows.length, 'public.vw_compliance_27191_mensual', `compliance Ley 27.191 del periodo ${selectedPeriod}`, dataUsed, missingData);

    if (historyRows.length > 0) dataUsed.push('public.vw_consumo_gu_mensual historial');
    else missingData.push(`historial energetico hasta ${selectedPeriod}`);

    if (conceptRows.length > 0) dataUsed.push('public.factura_dte_conceptos_mensual');
    if (loadFactorRows.length > 0) dataUsed.push('public.vw_factor_carga_mensual');
    if (marketRows.length > 0) dataUsed.push('public.vw_mercado_resumen_mensual');

    if (input.includePrivateContext) {
      if (privateContextResult.ok && privateContextResult.context) {
        dataUsed.push('client_private.ai_context');
      } else if (privateContextResult.limitation) {
        missingData.push('contexto privado Data Room');
        warnings.push(privateContextResult.limitation);
      }
    }

    const evidence = [
      ...(current ? [{
        source: 'public.vw_consumo_gu_mensual',
        label: `Consumo ${selectedPeriod}`,
        period: selectedPeriod,
        fields: ['demanda_real_mwh', 'demanda_contratada_mwh', 'compra_spot_mwh'],
      }] : []),
      ...(exposureRow ? [{
        source: 'public.vw_exposicion_spot_mensual',
        label: `Exposicion spot ${selectedPeriod}`,
        period: selectedPeriod,
        fields: ['pct_spot', 'pct_mat', 'spot_pesos'],
      }] : []),
      ...(invoiceRow ? [{
        source: 'public.vw_factura_dte_resumen_mensual',
        label: `DTE ${selectedPeriod}`,
        period: selectedPeriod,
        fields: ['factura_total_pesos', 'costo_dte_pesos_mwh'],
      }] : []),
      ...(complianceRow ? [{
        source: 'public.vw_compliance_27191_mensual',
        label: `Ley 27.191 ${selectedPeriod}`,
        period: selectedPeriod,
        fields: ['pct_renovable_ytd', 'cumple_ytd', 'brecha_ytd_mwh'],
      }] : []),
    ];

    return EnergySnapshotSchema.parse({
      companyId: input.companyId,
      companyName: input.companyName,
      nemo,
      requestedPeriod: input.period,
      resolvedPeriod: current?.periodo ?? selectedPeriod,
      generatedAt: new Date().toISOString(),
      identity: agent ? {
        nemo,
        description: agent.descripcion,
        tipoAgente: agent.tipo_agente,
        agrupacion: agent.agrupacion,
      } : null,
      currentPeriod: current,
      historicalConsumption: historyRows.map(mapConsumption),
      exposure: exposureRow ? {
        periodo: periodo(exposureRow.anio, exposureRow.mes),
        pctSpot: toNumber(exposureRow.pct_spot),
        pctMat: toNumber(exposureRow.pct_mat),
        spotPesos: toNumber(exposureRow.spot_pesos),
        costoSpotPromedioPesosMwh: toNumber(exposureRow.costo_spot_promedio_pesos_mwh),
        subContratoMwh: toNumber(exposureRow.sub_contrato_mwh),
        sobreContratoMwh: toNumber(exposureRow.sobre_contrato_mwh),
        calidadDato: exposureRow.calidad_dato ?? 'desconocida',
      } : null,
      invoice: invoiceRow ? {
        periodo: periodo(invoiceRow.anio, invoiceRow.mes),
        facturaTotalPesos: toNumber(invoiceRow.factura_total_pesos),
        costoDtePesosMwh: toNumber(invoiceRow.costo_dte_pesos_mwh),
        energiaPesos: toNumber(invoiceRow.energia_pesos),
        potenciaPesos: toNumber(invoiceRow.potencia_pesos),
        transportePesos: toNumber(invoiceRow.transporte_pesos),
        importeRevisablePesos: toNumber(invoiceRow.importe_revisable_pesos),
        estadoAuditoria: invoiceRow.estado_auditoria ?? 'desconocido',
        conceptosCount: countValue(invoiceRow.conceptos_count),
      } : null,
      invoiceConcepts: conceptRows.map((row) => ({
        bloqueCodigo: row.bloque_codigo ?? '',
        bloqueNombre: row.bloque_nombre ?? '',
        conceptoCodigo: row.concepto_codigo ?? '',
        conceptoNombre: row.concepto_nombre ?? '',
        importePesos: toNumber(row.importe_pesos),
        sourceFile: row.source_file,
        sourceRowDesde: row.source_row_desde,
        sourceRowHasta: row.source_row_hasta,
        sourceRowsCount: row.source_rows_count ?? 0,
      })),
      compliance: complianceRow ? {
        periodo: periodo(complianceRow.anio, complianceRow.mes),
        pctRenovableReal: toNumber(complianceRow.pct_renovable_real),
        pctRenovableYtd: toNumber(complianceRow.pct_renovable_ytd),
        cumpleMes: complianceRow.cumple_mes,
        cumpleYtd: complianceRow.cumple_ytd,
        brechaMwh: toNumber(complianceRow.brecha_mwh),
        brechaYtdMwh: toNumber(complianceRow.brecha_ytd_mwh),
        multaEstimadaPesos: toNumber(complianceRow.multa_estimada_pesos),
        calidadDato: complianceRow.calidad_dato ?? 'desconocida',
      } : null,
      loadFactor: loadFactorRow ? {
        periodo: periodo(loadFactorRow.anio, loadFactorRow.mes),
        pctPico: toNumber(loadFactorRow.pct_pico),
        pctValle: toNumber(loadFactorRow.pct_valle),
        pctResto: toNumber(loadFactorRow.pct_resto),
        ratioPicoValle: toNumber(loadFactorRow.ratio_pico_valle),
        calidadDato: loadFactorRow.calidad_dato ?? 'desconocida',
      } : null,
      market: marketRow ? {
        periodo: periodo(marketRow.anio, marketRow.mes),
        fuente: marketRow.fuente ?? 'desconocida',
        periodoCompleto: marketRow.periodo_completo ?? false,
        generacionTotalGwh: toNumber(marketRow.generacion_total_gwh),
        pctRenovableSistema: toNumber(marketRow.renovable_ley_26190_pct),
      } : null,
      privateContext: privateContextResult.context,
      availability: {
        identity: availability(agentRows.length),
        currentPeriod: availability(currentRows.length),
        historicalConsumption: availability(historyRows.length, 'Sin historial de consumo.'),
        exposure: availability(exposureRows.length, 'Sin exposicion spot.'),
        invoice: availability(invoiceRows.length, 'Sin DTE/facturacion.'),
        compliance: availability(complianceRows.length, 'Sin compliance Ley 27.191.'),
        loadFactor: availability(loadFactorRows.length, 'Sin perfil PVR/factor de carga.'),
        market: availability(marketRows.length, 'Sin contexto de mercado.'),
        privateContext: availability(privateContextResult.context ? 1 : 0, privateContextResult.limitation),
      },
      dataUsed,
      missingData,
      evidence,
      warnings,
    });
  } finally {
    await sql.end?.({ timeout: 5 });
  }
}
