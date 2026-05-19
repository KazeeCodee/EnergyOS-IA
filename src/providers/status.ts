export type ProviderRuntimeStatus = {
  configured: boolean;
  provider: 'anthropic' | 'openai' | 'gemini' | null;
  model: string | null;
  advisorLlmWriterEnabled: boolean;
};

export function getProviderStatusFromEnv(): ProviderRuntimeStatus {
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      configured: true,
      provider: 'anthropic',
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514',
      advisorLlmWriterEnabled: process.env.ENABLE_ADVISOR_LLM_WRITER === 'true',
    };
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      configured: true,
      provider: 'openai',
      model: process.env.OPENAI_MODEL ?? 'gpt-4o',
      advisorLlmWriterEnabled: process.env.ENABLE_ADVISOR_LLM_WRITER === 'true',
    };
  }

  if (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY) {
    return {
      configured: true,
      provider: 'gemini',
      model: process.env.GEMINI_MODEL ?? process.env.GOOGLE_AI_MODEL ?? 'gemini-2.5-flash',
      advisorLlmWriterEnabled: process.env.ENABLE_ADVISOR_LLM_WRITER === 'true',
    };
  }

  return {
    configured: false,
    provider: null,
    model: null,
    advisorLlmWriterEnabled: process.env.ENABLE_ADVISOR_LLM_WRITER === 'true',
  };
}
