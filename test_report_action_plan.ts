import assert from 'node:assert/strict';
import { generateReport } from './src/reports/reportGenerator.js';
import { generateActionPlan } from './src/actionPlan/actionPlanGenerator.js';
import type { AgentAnalysisOutput } from './src/schemas/agentOutput.schema.js';

const analysis: AgentAnalysisOutput = {
  companyId: '11111111-1111-4111-8111-111111111111',
  period: '2026-04',
  executiveSummary: 'El periodo requiere atencion por cobertura contractual.',
  overallStatus: 'attention_required',
  riskLevel: 'high',
  findings: [
    {
      id: 'finding_1',
      type: 'contract_coverage_shortfall',
      title: 'La energia contratada cubre menos del 80% de la demanda',
      severity: 'high',
      evidence: { totalConsumptionMwh: 1000, totalContractedMonthlyMwh: 600 },
      confidence: 'medium',
    },
  ],
  recommendations: [
    {
      id: 'rec_1',
      findingId: 'finding_1',
      title: 'Validar cobertura contractual',
      priority: 'high',
      reason: 'La energia contratada es menor a la demanda.',
      evidence: ['Demanda: 1000 MWh', 'Contratado: 600 MWh'],
      action: 'Confirmar si faltan contratos o si la diferencia es exposicion spot.',
      expectedImpact: 'Reduce riesgo de exposicion.',
      requiredData: ['contratos faltantes', 'DTE/facturas'],
      confidence: 'medium',
      status: 'pending',
    },
  ],
  missingData: ['DTE/facturas', 'responsable interno'],
  dataUsed: ['datos_mensuales 2026-04', 'Data Room privado ABCDEFGH'],
  confidence: 'medium',
  limitations: ['Sin facturas/DTE no se confirma la causa exacta.'],
  privateContextUsed: true,
  privateContextSummary: {
    nemo: 'ABCDEFGH',
    completenessPct: 25,
    contractsCount: 1,
    warningsCount: 3,
    missingDataCount: 2,
  },
  evidence: [
    {
      id: 'doc_1',
      documentType: 'contrato',
      fileName: 'contrato.pdf',
      entityType: 'contract',
      entityId: 'contract_1',
      evidenceNote: 'Contrato fuente',
    },
  ],
};

const report = generateReport(analysis, { generatedAt: '2026-05-17T12:00:00.000Z' });
assert.equal(report.title, 'Reporte energetico 2026-04');
assert.equal(report.privateContext?.nemo, 'ABCDEFGH');
assert.equal(report.sections.find((section) => section.id === 'findings')?.items.length, 1);
assert.equal(report.sections.find((section) => section.id === 'missing_data')?.items.includes('DTE/facturas'), true);

const plan = generateActionPlan(analysis, { generatedAt: '2026-05-17T12:00:00.000Z' });
assert.equal(plan.items.length, 1);
assert.equal(plan.items[0].priority, 'high');
assert.equal(plan.items[0].status, 'pendiente');
assert.equal(plan.items[0].requiredData.includes('contratos faltantes'), true);
assert.equal(plan.missingOwners.includes('Validar cobertura contractual'), true);

console.log('report and action plan tests passed');
