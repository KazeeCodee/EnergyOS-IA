import { supabase } from '../db/client.js';
import type { Finding } from '../schemas/finding.schema.js';

/**
 * Guarda los hallazgos detectados en una ejecución del agente.
 */
export async function saveFindings(
  runId: string,
  companyId: string,
  period: string,
  findings: Finding[],
): Promise<void> {
  if (findings.length === 0) return;

  const rows = findings.map(f => ({
    agent_run_id: runId,
    company_id: companyId,
    period,
    type: f.type,
    title: f.title,
    severity: f.severity,
    evidence_json: f.evidence,
    interpretation: f.interpretation ?? null,
    likely_causes_json: f.likelyCauses ?? null,
    missing_data_json: f.missingData ?? null,
    confidence: f.confidence,
    status: 'detected',
  }));

  const { error } = await supabase
    .from('agent_findings')
    .insert(rows);

  if (error) {
    console.error('Error saving findings:', error.message);
  }
}

/**
 * Obtiene hallazgos previos de una empresa para un período.
 */
export async function getPreviousFindings(companyId: string, period: string) {
  const { data, error } = await supabase
    .from('agent_findings')
    .select('*')
    .eq('company_id', companyId)
    .eq('period', period)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data ?? [];
}
