import type { AgentAnalysisOutput } from '../schemas/agentOutput.schema.js';

export type ReportSection = {
  id: string;
  title: string;
  items: unknown[];
};

export type EnergyReport = {
  title: string;
  generatedAt: string;
  companyId: string;
  period: string;
  executiveSummary: string;
  status: {
    overall: AgentAnalysisOutput['overallStatus'];
    risk: AgentAnalysisOutput['riskLevel'];
    confidence: AgentAnalysisOutput['confidence'];
  };
  privateContext?: AgentAnalysisOutput['privateContextSummary'];
  sections: ReportSection[];
  limitations: string[];
};

export function generateReport(
  analysis: AgentAnalysisOutput,
  options: { generatedAt?: string } = {},
): EnergyReport {
  const generatedAt = options.generatedAt ?? new Date().toISOString();

  return {
    title: `Reporte energetico ${analysis.period}`,
    generatedAt,
    companyId: analysis.companyId,
    period: analysis.period,
    executiveSummary: analysis.executiveSummary,
    status: {
      overall: analysis.overallStatus,
      risk: analysis.riskLevel,
      confidence: analysis.confidence,
    },
    privateContext: analysis.privateContextSummary,
    sections: [
      {
        id: 'data_used',
        title: 'Datos usados',
        items: analysis.dataUsed,
      },
      {
        id: 'findings',
        title: 'Hallazgos principales',
        items: analysis.findings.map(finding => ({
          id: finding.id,
          type: finding.type,
          title: finding.title,
          severity: finding.severity,
          evidence: finding.evidence,
          confidence: finding.confidence,
          likelyCauses: finding.likelyCauses ?? [],
          missingData: finding.missingData ?? [],
        })),
      },
      {
        id: 'recommendations',
        title: 'Recomendaciones',
        items: analysis.recommendations.map(recommendation => ({
          id: recommendation.id,
          findingId: recommendation.findingId,
          title: recommendation.title,
          priority: recommendation.priority,
          reason: recommendation.reason,
          action: recommendation.action,
          expectedImpact: recommendation.expectedImpact ?? '',
          requiredData: recommendation.requiredData ?? [],
          status: recommendation.status,
          confidence: recommendation.confidence,
        })),
      },
      {
        id: 'missing_data',
        title: 'Datos faltantes',
        items: analysis.missingData,
      },
      {
        id: 'evidence',
        title: 'Evidencia',
        items: analysis.evidence ?? [],
      },
    ],
    limitations: analysis.limitations,
  };
}
