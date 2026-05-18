import { z } from 'zod';
import { ConfidenceSchema } from './finding.schema.js';

export const RecommendationStatusSchema = z.enum([
  'pending', 'accepted', 'rejected', 'in_progress', 'completed', 'obsolete',
]);

/**
 * Recomendación accionable generada a partir de un hallazgo.
 * Corresponde a la sección 10.3 del documento base.
 */
export const RecommendationSchema = z.object({
  id: z.string(),
  findingId: z.string().optional(),
  title: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  reason: z.string(),
  evidence: z.array(z.string()),
  action: z.string(),
  expectedImpact: z.string().optional(),
  requiredData: z.array(z.string()).optional(),
  confidence: ConfidenceSchema,
  status: RecommendationStatusSchema.default('pending'),
});

/** Input type — status is optional (defaults to 'pending') */
export type RecommendationInput = z.input<typeof RecommendationSchema>;

/** Output type — status is always present */
export type Recommendation = z.output<typeof RecommendationSchema>;

export type RecommendationStatus = z.infer<typeof RecommendationStatusSchema>;
