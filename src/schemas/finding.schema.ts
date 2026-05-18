import { z } from 'zod';

export const SeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const ConfidenceSchema = z.enum(['low', 'medium', 'high']);

/**
 * Hallazgo detectado por el Anomaly Detector.
 * Corresponde a la sección 10.2 del documento base.
 */
export const FindingSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  severity: SeveritySchema,
  evidence: z.record(z.unknown()),
  interpretation: z.string().optional(),
  likelyCauses: z.array(z.string()).optional(),
  recommendedChecks: z.array(z.string()).optional(),
  missingData: z.array(z.string()).optional(),
  confidence: ConfidenceSchema,
});

export type Finding = z.infer<typeof FindingSchema>;
export type Severity = z.infer<typeof SeveritySchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;
