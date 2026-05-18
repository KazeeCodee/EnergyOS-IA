import { z } from 'zod';
import type { SnapshotSql } from '../context/energyosSnapshot.js';

export const AdvisorTaskApprovalSchema = z.object({
  nemo: z.string().regex(/^[A-Za-z0-9]{8}$/).transform((value) => value.toUpperCase()),
  recommendationId: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(240),
  reason: z.string().trim().max(2000).optional(),
  ownerEmail: z.string().email().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  relatedEntityType: z.string().trim().max(80).optional(),
  relatedEntityId: z.string().uuid().optional(),
});

export type AdvisorTaskApproval = z.infer<typeof AdvisorTaskApprovalSchema>;

export type AdvisorTaskCreated = {
  id: string;
  nemo: string;
  title: string;
  status: 'pendiente';
};

export async function createAdvisorTask(input: {
  approval: AdvisorTaskApproval;
  createdByUserId?: string;
  sqlFactory?: () => SnapshotSql;
}): Promise<AdvisorTaskCreated> {
  const sql = input.sqlFactory ? input.sqlFactory() : await createDefaultSql();
  try {
    const rows = await sql<Array<{ id: string }>>`
      insert into client_private.tasks (
        nemo,
        title,
        related_entity_type,
        related_entity_id,
        owner_email,
        due_date,
        status,
        created_by_user_id
      )
      values (
        ${input.approval.nemo},
        ${input.approval.title},
        ${input.approval.relatedEntityType ?? 'recommendation'},
        ${input.approval.relatedEntityId ?? null},
        ${input.approval.ownerEmail ?? null},
        ${input.approval.dueDate ?? null},
        ${'pendiente'},
        ${input.createdByUserId ?? null}
      )
      returning id
    `;

    return {
      id: rows[0]?.id ?? '',
      nemo: input.approval.nemo,
      title: input.approval.title,
      status: 'pendiente',
    };
  } finally {
    await sql.end?.({ timeout: 5 });
  }
}

async function createDefaultSql(): Promise<SnapshotSql> {
  const { createRailwaySql } = await import('../db/client.js');
  return createRailwaySql() as SnapshotSql;
}
