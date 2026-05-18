export type AskTaskInput = {
  companyId: string;
  nemo?: string;
  period?: string;
  question: string;
  includePrivateContext: boolean;
};

const SIMPLE_GREETING_PATTERN = /^(hola\s*)?(buen dia|buenos dias|buenas|buenas tardes|buenas noches|hello|hi|hola)([,\s!?.]*(como estas|que tal|todo bien)?)?[,\s!?.]*$/i;

export function isSimpleGreeting(question: string): boolean {
  return SIMPLE_GREETING_PATTERN.test(normalizeForIntent(question));
}

export function buildGreetingResponse(): string {
  return 'Hola, buen dia. Soy EnergyOS Advisor. Estoy trabajando con el cliente seleccionado en EnergyOS. Decime que periodo, factura, contrato o tema queres revisar y te ayudo con el diagnostico energetico.';
}

export function buildAskTaskMessage(input: AskTaskInput): string {
  return `Responde la pregunta del usuario como EnergyOS Analyst.

Contexto solicitado:
- Empresa: ${input.companyId}
- NEMO: ${input.nemo ?? 'no informado'}
- Periodo: ${input.period ?? 'no informado'}
- Usar contexto privado: ${input.includePrivateContext ? 'si' : 'no'}

Pregunta:
${input.question}

Instrucciones:
1. Si la pregunta es solo un saludo o conversacion general, responde breve y no uses herramientas.
2. Nunca le pidas al usuario que elija cliente si Empresa o NEMO ya vienen en el contexto. Ese contexto ya representa el cliente autorizado actual.
3. Si la pregunta requiere datos energeticos del periodo, usa calculate_metrics y detect_anomalies.
4. Si la pregunta requiere contratos, vencimientos, responsables, evidencia o datos faltantes, usa get_client_private_context con el NEMO.
5. No inventes datos. Si falta informacion, declarala.
6. Separa hechos, interpretacion, recomendacion y limitaciones cuando sea un analisis tecnico.`;
}

function normalizeForIntent(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}
