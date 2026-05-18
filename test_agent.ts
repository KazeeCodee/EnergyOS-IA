import postgres from 'postgres';
import { env } from './src/config/env.js';
import { getPeriodData, getHistoricalData, getExposicionData } from './src/tools/dataRetriever.js';
import { calculateMetrics } from './src/tools/metricsEngine.js';
import { detectAnomalies } from './src/tools/anomalyDetector.js';

async function testDeterministic() {
  const sql = postgres(env.RAILWAY_DATABASE_URL, { ssl: false });
  
  try {
    const agentes = await sql`SELECT nemo, descripcion FROM cammesa_agentes_mem LIMIT 1`;
    const nemo = agentes[0].nemo;
    console.log(`✅ Agente seleccionado: ${agentes[0].descripcion} (${nemo})`);

    const periods = await sql`SELECT anio, mes FROM m1_agum_mensual WHERE nemo = ${nemo} ORDER BY anio DESC, mes DESC LIMIT 1`;
    if (periods.length === 0) return console.log('❌ No hay datos.');
    
    const year = periods[0].anio;
    const month = periods[0].mes;
    const period = `${year}-${String(month).padStart(2, '0')}`;
    console.log(`✅ Período detectado: ${period}`);

    console.log('🔄 Extrayendo datos...');
    const currentData = await getPeriodData('mock-id', year, month, nemo);
    const previousData = await getPeriodData('mock-id', month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1, nemo);
    const historicalData = await getHistoricalData('mock-id', year, month, 6, nemo);
    const exposicionData = await getExposicionData(nemo, 24);

    console.log('🔄 Calculando métricas...');
    const metrics = calculateMetrics({ companyId: 'mock', period, currentData, previousData, historicalData, exposicionData });
    
    console.log('🔄 Detectando anomalías...');
    const { findings, recommendations } = detectAnomalies({ metrics, historicalData });

    console.log('\n--- MÉTRICAS ---');
    console.log(`Costo total: ${metrics.totalCost}`);
    console.log(`Consumo total: ${metrics.totalConsumptionMwh}`);
    console.log(`Variación costo: ${metrics.costChangePct}`);
    console.log(`Exposición spot: ${metrics.spotExposurePct}`);
    
    console.log(`\n--- HALLAZGOS (${findings.length}) ---`);
    findings.forEach(f => console.log(`- [${f.severity.toUpperCase()}] ${f.title}`));
    
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await sql.end();
  }
}

testDeterministic();
