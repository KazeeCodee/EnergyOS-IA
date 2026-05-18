import { z } from 'zod';
import { FindingSchema, ConfidenceSchema } from './finding.schema.js';
import { RecommendationSchema } from './recommendation.schema.js';

export const OverallStatusSchema = z.enum(['normal', 'attention_required', 'critical']);
export const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

/**
 * Output completo del análisis de un período.
 * Corresponde a la sección 10.4 del documento base.
 */
export const AgentAnalysisOutputSchema = z.object({
  companyId: z.string(),
  period: z.string(),
  executiveSummary: z.string(),
  overallStatus: OverallStatusSchema,
  riskLevel: RiskLevelSchema,
  findings: z.array(FindingSchema),
  recommendations: z.array(RecommendationSchema),
  missingData: z.array(z.string()),
  dataUsed: z.array(z.string()),
  confidence: ConfidenceSchema,
  limitations: z.array(z.string()),
  privateContextUsed: z.boolean().optional(),
  privateContextSummary: z.object({
    nemo: z.string(),
    completenessPct: z.number(),
    contractsCount: z.number(),
    warningsCount: z.number(),
    missingDataCount: z.number(),
  }).optional(),
  evidence: z.array(z.record(z.unknown())).optional(),
});

export type AgentAnalysisOutput = z.infer<typeof AgentAnalysisOutputSchema>;
export type OverallStatus = z.infer<typeof OverallStatusSchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
