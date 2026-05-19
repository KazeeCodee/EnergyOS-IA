import type {
  CreateMemoryItemInput,
  MemoryConfidence,
  MemoryScope,
  MemoryType,
} from './memoryStore.js';

export type MemoryExtractionInput = {
  userId: string;
  companyId: string;
  nemo: string;
  conversationId: string;
  sourceMessageId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type MemoryCandidate = Omit<CreateMemoryItemInput, 'sqlFactory'>;

function normalizeText(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeForMatch(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function isLightweightNoise(text: string): boolean {
  return /^(hola|buen dia|buenos dias|buenas|gracias|muchas gracias|ok|dale|perfecto|genial|listo|entendido)[!?. ]*$/.test(text);
}

function buildCandidate(
  input: MemoryExtractionInput,
  type: MemoryType,
  scope: MemoryScope,
  confidence: MemoryConfidence,
): MemoryCandidate {
  return {
    scope,
    userId: input.userId,
    companyId: input.companyId,
    nemo: input.nemo,
    conversationId: input.conversationId,
    type,
    content: normalizeText(input.content).slice(0, 600),
    confidence,
    sourceMessageId: input.sourceMessageId,
    evidence: {
      extractor: 'deterministic_v1',
    },
  };
}

export function extractMemoryCandidates(input: MemoryExtractionInput): MemoryCandidate[] {
  if (input.role !== 'user') return [];

  const clean = normalizeText(input.content);
  if (!clean) return [];

  const matchText = normalizeForMatch(clean);
  if (isLightweightNoise(matchText)) return [];

  const candidates: MemoryCandidate[] = [];

  if (/\b(prefiero|me gusta|quiero que|para mi es mejor)\b/.test(matchText)) {
    candidates.push(buildCandidate(input, 'preference', 'nemo', 'high'));
  }

  if (/\b(decidimos|se decidio|queda decidido|vamos a priorizar)\b/.test(matchText)) {
    candidates.push(buildCandidate(input, 'decision', 'conversation', 'high'));
  }

  if (/\b(queda pendiente|falta|hay que|tenemos que|pendiente)\b/.test(matchText)) {
    candidates.push(buildCandidate(input, 'open_issue', 'conversation', 'medium'));
  }

  if (/\b(confirmo que|confirmamos que|es correcto que|ya esta confirmado)\b/.test(matchText)) {
    candidates.push(buildCandidate(input, 'confirmed_fact', 'nemo', 'high'));
  }

  return candidates.slice(0, 3);
}
