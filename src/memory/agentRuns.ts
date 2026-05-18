import { supabase } from '../db/client.js';
import type { AgentAnalysisOutput } from '../schemas/agentOutput.schema.js';

export type AgentRunRecord = {
  id?: string;
  company_id: string;
  period: string;
  task_type: string;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown> | null;
  status: 'running' | 'completed' | 'failed';
  confidence: string | null;
  created_at?: string;
  updated_at?: string;
};

/**
 * Crea un registro de ejecución del agente.
 */
export async function createAgentRun(
  companyId: string,
  period: string,
  taskType: string,
  inputPayload: Record<string, unknown>,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('agent_runs')
    .insert({
      company_id: companyId,
      period,
      task_type: taskType,
      input_payload: inputPayload,
      status: 'running',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating agent run:', error.message);
    return null;
  }
  return data.id;
}

/**
 * Marca un run como completado con su output.
 */
export async function completeAgentRun(
  runId: string,
  output: AgentAnalysisOutput,
): Promise<void> {
  const { error } = await supabase
    .from('agent_runs')
    .update({
      output_payload: output as unknown as Record<string, unknown>,
      status: 'completed',
      confidence: output.confidence,
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId);

  if (error) {
    console.error('Error completing agent run:', error.message);
  }
}

/**
 * Marca un run como fallido.
 */
export async function failAgentRun(runId: string, errorMessage: string): Promise<void> {
  const { error } = await supabase
    .from('agent_runs')
    .update({
      status: 'failed',
      output_payload: { error: errorMessage },
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId);

  if (error) {
    console.error('Error marking agent run as failed:', error.message);
  }
}
