import { z } from 'zod';

export const ReadinessBlockSchema = z.object({
  label: z.string(),
  status: z.enum(['completo', 'parcial', 'pendiente']),
  pct: z.number().min(0).max(100),
  detail: z.string(),
});

export const DataRoomCompletenessSchema = z.object({
  overallPct: z.number().min(0).max(100),
  blocks: z.object({
    sites: ReadinessBlockSchema,
    contracts: ReadinessBlockSchema,
    invoices: ReadinessBlockSchema,
    forecast: ReadinessBlockSchema,
    claims: ReadinessBlockSchema,
    smec: ReadinessBlockSchema,
    responsibles: ReadinessBlockSchema,
    documents: ReadinessBlockSchema,
  }),
});

export const AiContractSummarySchema = z.object({
  id: z.string(),
  versionId: z.string().nullable().optional(),
  versionNumber: z.number().nullable().optional(),
  contractName: z.string(),
  contractType: z.string(),
  status: z.string(),
  buyerNemo: z.string().regex(/^[A-Z0-9]{8}$/),
  sellerNemo: z.string(),
  generatorGroup: z.string(),
  marketerNemo: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  signedDate: z.string(),
  monthlyEnergyMwh: z.number().nullable(),
  annualEnergyMwh: z.number().nullable(),
  contractedPowerMw: z.number().nullable(),
  priceCurrency: z.enum(['ARS', 'USD']),
  basePrice: z.number().nullable(),
  priceType: z.string(),
  renewable: z.boolean(),
  technology: z.string(),
  internalOwnerEmail: z.string(),
  renewalDeadline: z.string(),
  adjustmentIndex: z.string(),
  adjustmentFrequency: z.string(),
  sourceDocumentName: z.string(),
  savedAt: z.string(),
});

export const AiContextSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const AiDeadlineSchema = z.object({
  type: z.enum(['contract_expiration', 'contract_renewal', 'claim_due', 'audit_due']),
  entityId: z.string(),
  entityName: z.string(),
  dueDate: z.string(),
  severity: AiContextSeveritySchema,
  message: z.string(),
});

export const AiMissingDataSchema = z.object({
  area: z.string(),
  field: z.string(),
  severity: AiContextSeveritySchema,
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  message: z.string(),
});

export const AiEvidenceSummarySchema = z.object({
  id: z.string(),
  documentType: z.string(),
  fileName: z.string(),
  uploadedAt: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  evidenceNote: z.string(),
});

export const AiContextWarningSchema = z.object({
  code: z.string(),
  severity: AiContextSeveritySchema,
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  entityName: z.string().optional(),
  field: z.string().optional(),
  message: z.string(),
});

export const AiClaimSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  ownerEmail: z.string(),
  dueDate: z.string(),
  estimatedImpactAmount: z.number().nullable(),
  currency: z.string(),
});

export const AiAuditObservationSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  observationType: z.string(),
  status: z.string(),
  ownerEmail: z.string(),
  dueDate: z.string(),
});

export const ClientPrivateContextSchema = z.object({
  nemo: z.string().regex(/^[A-Z0-9]{8}$/),
  generatedAt: z.string(),
  completeness: DataRoomCompletenessSchema,
  contracts: z.array(AiContractSummarySchema),
  activeDeadlines: z.array(AiDeadlineSchema),
  openClaims: z.array(AiClaimSummarySchema),
  auditObservations: z.array(AiAuditObservationSummarySchema),
  missingData: z.array(AiMissingDataSchema),
  evidence: z.array(AiEvidenceSummarySchema),
  warnings: z.array(AiContextWarningSchema),
});

export type ClientPrivateContext = z.infer<typeof ClientPrivateContextSchema>;
export type AiContractSummary = z.infer<typeof AiContractSummarySchema>;
export type AiContextSeverity = z.infer<typeof AiContextSeveritySchema>;
