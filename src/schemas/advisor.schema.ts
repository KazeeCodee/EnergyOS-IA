import { z } from 'zod';
import { ClientPrivateContextSchema } from './clientPrivateContext.schema.js';

const NullableNumberSchema = z.number().finite().nullable();

export const AdvisorFileSchema = z.object({
  name: z.string().trim().min(1).max(255),
  type: z.string().trim().min(1).max(120),
  content: z.string().min(1),
});

export const AdvisorChatInputSchema = z.object({
  companyId: z.string().uuid(),
  companyName: z.string().trim().min(1).max(200).optional(),
  nemo: z.string().trim().regex(/^[A-Za-z0-9]{8}$/).transform((value) => value.toUpperCase()),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  question: z.string().trim().min(1).max(5000),
  includePrivateContext: z.boolean().default(true),
  conversationId: z.string().trim().min(1).max(120).optional(),
  files: z.array(AdvisorFileSchema).default([]),
});

export const EvidenceRefSchema = z.object({
  source: z.string().min(1),
  label: z.string().min(1),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  fields: z.array(z.string()).default([]),
  documentId: z.string().optional(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
});

const AvailabilityItemSchema = z.object({
  available: z.boolean(),
  rows: z.number().int().nonnegative(),
  reason: z.string().optional(),
});

export const SnapshotDataAvailabilitySchema = z.object({
  identity: AvailabilityItemSchema,
  currentPeriod: AvailabilityItemSchema,
  historicalConsumption: AvailabilityItemSchema,
  exposure: AvailabilityItemSchema,
  invoice: AvailabilityItemSchema,
  compliance: AvailabilityItemSchema,
  loadFactor: AvailabilityItemSchema,
  market: AvailabilityItemSchema,
  privateContext: AvailabilityItemSchema,
});

export const SnapshotIdentitySchema = z.object({
  nemo: z.string().regex(/^[A-Z0-9]{8}$/),
  description: z.string().nullable(),
  tipoAgente: z.string().nullable(),
  agrupacion: z.string().nullable(),
});

export const SnapshotCurrentPeriodSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
  anio: z.number().int(),
  mes: z.number().int().min(1).max(12),
  demandaRealMwh: NullableNumberSchema,
  demandaContratadaMwh: NullableNumberSchema,
  compraSpotMwh: NullableNumberSchema,
  demandaRealPicoMwh: NullableNumberSchema,
  demandaRealValleMwh: NullableNumberSchema,
  demandaRealRestoMwh: NullableNumberSchema,
});

export const SnapshotHistoricalPointSchema = SnapshotCurrentPeriodSchema.extend({
  yoyPct: NullableNumberSchema.optional(),
});

export const SnapshotExposureSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
  pctSpot: NullableNumberSchema,
  pctMat: NullableNumberSchema,
  spotPesos: NullableNumberSchema,
  costoSpotPromedioPesosMwh: NullableNumberSchema,
  subContratoMwh: NullableNumberSchema,
  sobreContratoMwh: NullableNumberSchema,
  calidadDato: z.string(),
});

export const SnapshotInvoiceSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
  facturaTotalPesos: NullableNumberSchema,
  costoDtePesosMwh: NullableNumberSchema,
  energiaPesos: NullableNumberSchema,
  potenciaPesos: NullableNumberSchema,
  transportePesos: NullableNumberSchema,
  importeRevisablePesos: NullableNumberSchema,
  estadoAuditoria: z.string(),
  conceptosCount: z.number().int().nonnegative(),
});

export const SnapshotInvoiceConceptSchema = z.object({
  bloqueCodigo: z.string(),
  bloqueNombre: z.string(),
  conceptoCodigo: z.string(),
  conceptoNombre: z.string(),
  importePesos: NullableNumberSchema,
  sourceFile: z.string().nullable(),
  sourceRowDesde: z.number().int().nullable(),
  sourceRowHasta: z.number().int().nullable(),
  sourceRowsCount: z.number().int().nonnegative(),
});

export const SnapshotComplianceSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
  pctRenovableReal: NullableNumberSchema,
  pctRenovableYtd: NullableNumberSchema,
  cumpleMes: z.boolean().nullable(),
  cumpleYtd: z.boolean().nullable(),
  brechaMwh: NullableNumberSchema,
  brechaYtdMwh: NullableNumberSchema,
  multaEstimadaPesos: NullableNumberSchema,
  calidadDato: z.string(),
});

export const SnapshotLoadFactorSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
  pctPico: NullableNumberSchema,
  pctValle: NullableNumberSchema,
  pctResto: NullableNumberSchema,
  ratioPicoValle: NullableNumberSchema,
  calidadDato: z.string(),
}).nullable();

export const SnapshotMarketSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
  fuente: z.string(),
  periodoCompleto: z.boolean(),
  generacionTotalGwh: NullableNumberSchema,
  pctRenovableSistema: NullableNumberSchema,
}).nullable();

export const EnergySnapshotSchema = z.object({
  companyId: z.string().uuid(),
  companyName: z.string().optional(),
  nemo: z.string().regex(/^[A-Z0-9]{8}$/),
  requestedPeriod: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  resolvedPeriod: z.string().regex(/^\d{4}-\d{2}$/).nullable(),
  generatedAt: z.string(),
  identity: SnapshotIdentitySchema.nullable(),
  currentPeriod: SnapshotCurrentPeriodSchema.nullable(),
  historicalConsumption: z.array(SnapshotHistoricalPointSchema),
  exposure: SnapshotExposureSchema.nullable(),
  invoice: SnapshotInvoiceSchema.nullable(),
  invoiceConcepts: z.array(SnapshotInvoiceConceptSchema),
  compliance: SnapshotComplianceSchema.nullable(),
  loadFactor: SnapshotLoadFactorSchema,
  market: SnapshotMarketSchema,
  privateContext: ClientPrivateContextSchema.nullable(),
  availability: SnapshotDataAvailabilitySchema,
  dataUsed: z.array(z.string()),
  missingData: z.array(z.string()),
  evidence: z.array(EvidenceRefSchema),
  warnings: z.array(z.string()),
});

export const AdvisorMetricsSchema = z.object({
  companyId: z.string().uuid(),
  nemo: z.string().regex(/^[A-Z0-9]{8}$/),
  period: z.string().regex(/^\d{4}-\d{2}$/).nullable(),
  totalConsumptionMwh: NullableNumberSchema,
  contractedMwh: NullableNumberSchema,
  spotMwh: NullableNumberSchema,
  spotExposurePct: NullableNumberSchema,
  contractCoveragePct: NullableNumberSchema,
  spotCostPesos: NullableNumberSchema,
  invoiceTotalPesos: NullableNumberSchema,
  costDtePesosMwh: NullableNumberSchema,
  renewableYtdPct: NullableNumberSchema,
  renewableGapYtdMwh: NullableNumberSchema,
  estimatedRenewablePenaltyPesos: NullableNumberSchema,
  riskScore: NullableNumberSchema,
});

export const AdvisorFindingSchema = z.object({
  id: z.string(),
  type: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string(),
  detail: z.string(),
  evidence: z.array(EvidenceRefSchema).default([]),
  missingData: z.array(z.string()).default([]),
});

export const AdvisorRecommendationSchema = z.object({
  id: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  action: z.string(),
  reason: z.string(),
  requiredData: z.array(z.string()).default([]),
});

export const AdvisorRunOutputSchema = z.object({
  response: z.string(),
  intent: z.string(),
  companyId: z.string().uuid(),
  companyName: z.string().optional(),
  nemo: z.string().regex(/^[A-Z0-9]{8}$/),
  period: z.string().regex(/^\d{4}-\d{2}$/).nullable(),
  metrics: AdvisorMetricsSchema,
  findings: z.array(AdvisorFindingSchema),
  recommendations: z.array(AdvisorRecommendationSchema),
  missingData: z.array(z.string()),
  limitations: z.array(z.string()),
  dataUsed: z.array(z.string()),
  evidence: z.array(EvidenceRefSchema),
  filesReceived: z.array(AdvisorFileSchema),
  qa: z.object({
    passed: z.boolean(),
    issues: z.array(z.string()),
  }),
});

export type AdvisorFile = z.infer<typeof AdvisorFileSchema>;
export type AdvisorChatInput = z.infer<typeof AdvisorChatInputSchema>;
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export type EnergySnapshot = z.infer<typeof EnergySnapshotSchema>;
export type AdvisorMetrics = z.infer<typeof AdvisorMetricsSchema>;
export type AdvisorFinding = z.infer<typeof AdvisorFindingSchema>;
export type AdvisorRecommendation = z.infer<typeof AdvisorRecommendationSchema>;
export type AdvisorRunOutput = z.infer<typeof AdvisorRunOutputSchema>;
