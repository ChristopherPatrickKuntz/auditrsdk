/**
 * Zod schemas for runtime validation. Re-exported under the
 * `@auditrxyz/sdk/schema` subpath so callers that want only the
 * schema (e.g. for downstream typegen, OpenAPI emission, or
 * verification of stored reports) can pull it without the client.
 */

import { z } from 'zod';

export const severitySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);

export const auditStatusSchema = z.enum([
  'created',
  'payment_pending',
  'payment_confirmed',
  'analyzing',
  'ai_processing',
  'completed',
  'failed',
]);

export const findingSchema = z.object({
  severity: severitySchema,
  title: z.string(),
  category: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  recommendation: z.string().nullable().optional(),
  file: z.string().nullable().optional(),
  line_start: z.number().nullable().optional(),
  line_end: z.number().nullable().optional(),
  references: z.array(z.string()).nullable().optional(),
});

export const auditSummarySchema = z.object({
  management_summary: z.string().optional(),
  protocol_overview: z.string().optional(),
  methodology: z.string().optional(),
  threat_model: z.string().optional(),
  architecture_review: z.string().optional(),
  functionality_analysis: z.string().optional(),
  security_assessment: z.string().optional(),
  recommendations: z.array(z.string()).optional(),
  grade_rationale: z.string().optional(),
});

export const auditRecordSchema = z.object({
  id: z.string(),
  status: auditStatusSchema,
  score: z.string().nullable().optional(),
  project_name: z.string().nullable().optional(),
  created_at: z.string(),
  completed_at: z.string().nullable().optional(),
  summary: auditSummarySchema.nullable().optional(),
  severity_counts: z
    .record(severitySchema, z.number())
    .nullable()
    .optional(),
});

export const auditReportSchema = z.object({
  audit: auditRecordSchema,
  findings: z.array(findingSchema),
});

export const createAuditResponseSchema = z.object({
  audit_id: z.string(),
  tier: z.enum(['quick', 'standard', 'web3']).optional(),
  status: auditStatusSchema,
  price_usd: z.number(),
  status_url: z.string(),
});

export type AuditReportInput = z.infer<typeof auditReportSchema>;
export type CreateAuditResponseInput = z.infer<typeof createAuditResponseSchema>;
