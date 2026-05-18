export type AdvisorRunStoreCreateInput = {
  companyId: string;
  period: string | null;
  nemo: string;
  input: Record<string, unknown>;
};

export type AdvisorRunStore = {
  create: (input: AdvisorRunStoreCreateInput) => Promise<string | null>;
  complete: (input: { runId: string | null; output: Record<string, unknown> }) => Promise<void>;
  fail: (input: { runId: string | null; error: string }) => Promise<void>;
};

type SupabaseRunStoreClient = {
  from: (table: 'agent_runs') => {
    insert: (payload: Record<string, unknown>) => {
      select: (columns: 'id') => {
        single: () => Promise<{ data: { id: string } | null; error: { message?: string } | null }>;
      };
    };
    update: (payload: Record<string, unknown>) => {
      eq: (column: 'id', value: string) => Promise<{ error: { message?: string } | null }>;
    };
  };
};

export function createNoopAdvisorRunStore(): AdvisorRunStore {
  return {
    async create() {
      return null;
    },
    async complete() {
      return undefined;
    },
    async fail() {
      return undefined;
    },
  };
}

export function createSupabaseAdvisorRunStore(supabase: SupabaseRunStoreClient): AdvisorRunStore {
  return {
    async create(input) {
      try {
        const { data, error } = await supabase
          .from('agent_runs')
          .insert({
            company_id: input.companyId,
            period: input.period ?? '',
            task_type: 'advisor_chat',
            input_payload: {
              ...input.input,
              nemo: input.nemo,
            },
            status: 'running',
          })
          .select('id')
          .single();

        if (error) {
          console.error('Error creating advisor run:', error.message);
          return null;
        }
        return data?.id ?? null;
      } catch (error) {
        console.error('Error creating advisor run:', error);
        return null;
      }
    },

    async complete(input) {
      if (!input.runId) return;
      try {
        const { error } = await supabase
          .from('agent_runs')
          .update({
            output_payload: input.output,
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.runId);
        if (error) console.error('Error completing advisor run:', error.message);
      } catch (error) {
        console.error('Error completing advisor run:', error);
      }
    },

    async fail(input) {
      if (!input.runId) return;
      try {
        const { error } = await supabase
          .from('agent_runs')
          .update({
            output_payload: { error: input.error },
            status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.runId);
        if (error) console.error('Error failing advisor run:', error.message);
      } catch (error) {
        console.error('Error failing advisor run:', error);
      }
    },
  };
}

export async function createDefaultAdvisorRunStore(): Promise<AdvisorRunStore> {
  const { supabase } = await import('../db/client.js');
  return createSupabaseAdvisorRunStore(supabase as unknown as SupabaseRunStoreClient);
}
