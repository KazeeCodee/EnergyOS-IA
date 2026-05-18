import type { AgentAnalysisOutput } from '../schemas/agentOutput.schema.js';
import type { Recommendation } from '../schemas/recommendation.schema.js';

export type ActionPlanItem = {
  id: string;
  recommendationId: string;
  title: string;
  priority: Recommendation['priority'];
  status: 'pendiente';
  ownerEmail: string | null;
  suggestedOwnerArea: string | null;
  dueDate: string;
  reason: string;
  action: string;
  expectedImpact: string;
  requiredData: string[];
  evidence: string[];
};

export type ActionPlan = {
  title: string;
  generatedAt: string;
  companyId: string;
  period: string;
  items: ActionPlanItem[];
  missingOwners: string[];
  limitations: string[];
};

function addDays(date: Date, days: number): string {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString().slice(0, 10);
}

function dueDateFor(priority: Recommendation['priority'], referenceDate: Date): string {
  switch (priority) {
    case 'critical':
      return addDays(referenceDate, 3);
    case 'high':
      return addDays(referenceDate, 7);
    case 'medium':
      return addDays(referenceDate, 21);
    case 'low':
      return addDays(referenceDate, 45);
  }
}

function inferOwnerArea(recommendation: Recommendation): string | null {
  const text = [
    recommendation.title,
    recommendation.reason,
    recommendation.action,
    ...(recommendation.requiredData ?? []),
  ].join(' ').toLowerCase();

  if (text.includes('factura') || text.includes('dte') || text.includes('provision')) return 'finanzas';
  if (text.includes('contrato') || text.includes('cobertura') || text.includes('mater')) return 'energia';
  if (text.includes('smec') || text.includes('medicion')) return 'planta';
  return null;
}

export function generateActionPlan(
  analysis: AgentAnalysisOutput,
  options: { generatedAt?: string } = {},
): ActionPlan {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const referenceDate = new Date(generatedAt);

  const items = analysis.recommendations.map((recommendation): ActionPlanItem => {
    const suggestedOwnerArea = inferOwnerArea(recommendation);

    return {
      id: `action_${recommendation.id}`,
      recommendationId: recommendation.id,
      title: recommendation.title,
      priority: recommendation.priority,
      status: 'pendiente',
      ownerEmail: null,
      suggestedOwnerArea,
      dueDate: dueDateFor(recommendation.priority, referenceDate),
      reason: recommendation.reason,
      action: recommendation.action,
      expectedImpact: recommendation.expectedImpact ?? '',
      requiredData: recommendation.requiredData ?? [],
      evidence: recommendation.evidence,
    };
  });

  return {
    title: `Plan de accion energetico ${analysis.period}`,
    generatedAt,
    companyId: analysis.companyId,
    period: analysis.period,
    items,
    missingOwners: items
      .filter(item => item.ownerEmail === null)
      .map(item => item.title),
    limitations: [
      ...analysis.limitations,
      'Plan generado como propuesta: no crea tareas ni notifica responsables automaticamente.',
    ],
  };
}
