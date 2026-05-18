import assert from 'node:assert/strict';
import {
  buildEnergySnapshot,
  type SnapshotSql,
} from './src/context/energyosSnapshot.js';

function fakeSqlFactory() {
  const calls: string[] = [];

  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join('?').replace(/\s+/g, ' ').trim();
    calls.push(query);

    if (query.includes('from public.cammesa_agentes_mem')) {
      return [{
        nemo: 'ACINVCSZ',
        descripcion: 'Acindar Industria Argentina',
        tipo_agente: 'GUMA',
        agrupacion: null,
      }];
    }

    if (query.includes('from public.vw_consumo_gu_mensual') && query.includes('limit 1')) {
      return [{
        tipo_agente: 'GUMA',
        nemo: 'ACINVCSZ',
        anio: 2026,
        mes: 3,
        demanda_real_mwh: '64904.06',
        demanda_contratada_mwh: '39156.266',
        compra_spot_mwh: '25747.794',
        demanda_real_pico_mwh: null,
        demanda_real_valle_mwh: null,
        demanda_real_resto_mwh: null,
      }];
    }

    if (query.includes('from public.vw_consumo_gu_mensual') && query.includes('order by anio asc')) {
      return [{
        tipo_agente: 'GUMA',
        nemo: 'ACINVCSZ',
        anio: 2026,
        mes: 3,
        demanda_real_mwh: '64904.06',
        demanda_contratada_mwh: '39156.266',
        compra_spot_mwh: '25747.794',
        demanda_real_pico_mwh: null,
        demanda_real_valle_mwh: null,
        demanda_real_resto_mwh: null,
      }];
    }

    if (query.includes('from public.vw_exposicion_spot_mensual')) {
      return [{
        anio: 2026,
        mes: 3,
        pct_spot: '0.396705',
        pct_mat: '0.603295',
        spot_pesos: '1603954947',
        costo_spot_promedio_pesos_mwh: null,
        sub_contrato_mwh: '25747.794',
        sobre_contrato_mwh: null,
        calidad_dato: 'ok',
      }];
    }

    if (query.includes('from public.vw_factura_dte_resumen_mensual')) {
      return [{
        anio: 2026,
        mes: 3,
        factura_total_pesos: '2864505674',
        costo_dte_pesos_mwh: '44134.460525273766',
        energia_pesos: null,
        potencia_pesos: null,
        transporte_pesos: null,
        importe_revisable_pesos: null,
        estado_auditoria: 'ok',
        conceptos_count: 12,
      }];
    }

    if (query.includes('from public.factura_dte_conceptos_mensual')) {
      return [];
    }

    if (query.includes('from public.vw_compliance_27191_mensual')) {
      return [{
        anio: 2026,
        mes: 3,
        pct_renovable_real: null,
        pct_renovable_ytd: '0.2',
        cumple_mes: true,
        cumple_ytd: true,
        brecha_mwh: '0',
        brecha_ytd_mwh: '0',
        multa_estimada_pesos: '0',
        calidad_dato: 'ok',
      }];
    }

    if (query.includes('from public.vw_factor_carga_mensual')) {
      return [];
    }

    if (query.includes('from public.vw_mercado_resumen_mensual')) {
      return [];
    }

    throw new Error(`Unexpected query: ${query}`);
  }) as SnapshotSql;

  sql.end = async () => undefined;
  return { sql, calls };
}

const fake = fakeSqlFactory();

const snapshot = await buildEnergySnapshot({
  companyId: '11111111-1111-4111-8111-111111111111',
  companyName: 'Acindar Industria Argentina',
  nemo: 'ACINVCSZ',
  period: '2026-03',
  includePrivateContext: false,
  sqlFactory: () => fake.sql,
});

assert.equal(snapshot.nemo, 'ACINVCSZ');
assert.equal(snapshot.resolvedPeriod, '2026-03');
assert.equal(snapshot.currentPeriod?.demandaRealMwh, 64904.06);
assert.equal(snapshot.exposure?.pctSpot, 0.396705);
assert.equal(snapshot.exposure?.spotPesos, 1603954947);
assert.equal(snapshot.invoice?.facturaTotalPesos, 2864505674);
assert.equal(snapshot.invoice?.costoDtePesosMwh, 44134.460525273766);
assert.equal(snapshot.compliance?.pctRenovableYtd, 0.2);
assert.equal(snapshot.availability.currentPeriod.available, true);
assert.equal(snapshot.availability.exposure.available, true);
assert.equal(snapshot.availability.invoice.available, true);
assert.equal(snapshot.availability.compliance.available, true);
assert.equal(snapshot.missingData.includes('consumo del periodo 2026-03'), false);
assert.ok(snapshot.dataUsed.includes('public.vw_consumo_gu_mensual'));
assert.ok(snapshot.dataUsed.includes('public.vw_factura_dte_resumen_mensual'));
assert.ok(fake.calls.length >= 7);

console.log('energyos snapshot builder tests passed');
