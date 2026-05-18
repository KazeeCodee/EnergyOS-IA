import { z } from 'zod';
import { AdvisorFileSchema } from './advisor.schema.js';

/** Input para el endpoint POST /agent/analyze-period */
export const AnalyzePeriodInputSchema = z.object({
  companyId: z.string().uuid(),
  nemo: z.string().regex(/^[A-Za-z0-9]{8}$/).optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Formato esperado: YYYY-MM'),
  analysisType: z.enum(['monthly_diagnosis', 'quick_check']).default('monthly_diagnosis'),
  includePrivateContext: z.boolean().default(false),
});

export type AnalyzePeriodInput = z.infer<typeof AnalyzePeriodInputSchema>;

/** Input para el endpoint POST /agent/ask */
export const AskInputSchema = z.object({
  companyId: z.string().uuid(),
  companyName: z.string().trim().min(1).max(200).optional(),
  nemo: z.string().regex(/^[A-Za-z0-9]{8}$/).optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  question: z.string().min(1).max(2000),
  includePrivateContext: z.boolean().default(false),
  files: z.array(AdvisorFileSchema).default([]),
});

export type AskInput = z.infer<typeof AskInputSchema>;

export const NormalizedInvoiceLineInputSchema = z.object({
  conceptName: z.string().min(1),
  energyMwh: z.number().nonnegative().nullable().optional(),
  powerMw: z.number().nonnegative().nullable().optional(),
  unitPrice: z.number().nullable().optional(),
  amount: z.number(),
  currency: z.enum(['ARS', 'USD']),
});

export const NormalizedInvoiceInputSchema = z.object({
  id: z.string(),
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
  invoiceType: z.string().min(1),
  currency: z.enum(['ARS', 'USD']),
  totalAmount: z.number().nullable(),
  lines: z.array(NormalizedInvoiceLineInputSchema),
});

export const ReconcileInvoiceInputSchema = z.object({
  companyId: z.string().uuid().optional(),
  nemo: z.string().regex(/^[A-Za-z0-9]{8}$/),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  includePrivateContext: z.boolean().default(true),
  invoices: z.array(NormalizedInvoiceInputSchema).default([]),
});

export type ReconcileInvoiceInput = z.infer<typeof ReconcileInvoiceInputSchema>;

/** Input para el endpoint POST /agent/feedback */
export const FeedbackInputSchema = z.object({
  recommendationId: z.string(),
  status: z.enum(['accepted', 'rejected', 'in_progress', 'completed']),
  comment: z.string().optional(),
});

export type FeedbackInput = z.infer<typeof FeedbackInputSchema>;
