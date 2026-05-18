import { supabase } from '../db/client.js';
import type { RecommendationInput } from '../schemas/recommendation.schema.js';

/**
 * Guarda las recomendaciones generadas en una ejecución del agente.
 */
export async function saveRecommendations(
  companyId: string,
  period: string,
  recommendations: RecommendationInput[],
): Promise<void> {
  if (recommendations.length === 0) return;

  const rows = recommendations.map(r => ({
    company_id: companyId,
    period,
    finding_id: r.findingId ?? null,
    title: r.title,
    priority: r.priority,
    reason: r.reason,
    action: r.action,
    expected_impact: r.expectedImpact ?? null,
    required_data_json: r.requiredData ?? null,
    confidence: r.confidence,
    status: 'pending',
  }));

  const { error } = await supabase
    .from('agent_recommendations')
    .insert(rows);

  if (error) {
    console.error('Error saving recommendations:', error.message);
  }
}

/**
 * Actualiza el estado de una recomendación (feedback del usuario).
 */
export async function updateRecommendationStatus(
  recommendationId: string,
  status: string,
  comment?: string,
): Promise<boolean> {
  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  // Guardar comentario en un campo genérico si lo hay
  if (comment) {
    updateData.feedback_comment = comment;
  }

  const { error } = await supabase
    .from('agent_recommendations')
    .update(updateData)
    .eq('id', recommendationId);

  if (error) {
    console.error('Error updating recommendation:', error.message);
    return false;
  }
  return true;
}

/**
 * Obtiene recomendaciones activas de una empresa.
 */
export async function getActiveRecommendations(companyId: string) {
  const { data, error } = await supabase
    .from('agent_recommendations')
    .select('*')
    .eq('company_id', companyId)
    .in('status', ['pending', 'accepted', 'in_progress'])
    .order('created_at', { ascending: false });

  if (error) return [];
  return data ?? [];
}
