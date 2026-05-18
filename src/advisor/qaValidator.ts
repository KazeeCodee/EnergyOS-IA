import type { EnergySnapshot } from '../schemas/advisor.schema.js';

export type AdvisorQaInput = {
  response: string;
  snapshot: EnergySnapshot;
};

export type AdvisorQaResult = {
  passed: boolean;
  issues: string[];
  correctedResponse?: string;
};

const IGNORED_CODES = new Set(['ENERGYOS', 'ADVISOR']);

function hasMissingDataContradiction(response: string, snapshot: EnergySnapshot): boolean {
  if (!snapshot.availability.currentPeriod.available || !snapshot.currentPeriod) return false;
  return /(no hay datos|sin datos|no existen datos|no es posible realizar|falta(n)? datos criticos|carece de los datos)/i.test(response);
}

function findWrongNemos(response: string, snapshot: EnergySnapshot): string[] {
  const upper = response.toUpperCase();
  const candidates = upper.match(/\b[A-Z0-9]{8}\b/g) ?? [];
  return [...new Set(candidates.filter((value) => value !== snapshot.nemo && !IGNORED_CODES.has(value)))];
}

function buildCorrectedSummary(snapshot: EnergySnapshot): string {
  const company = snapshot.companyName ?? snapshot.identity?.description ?? 'la empresa';
  const period = snapshot.resolvedPeriod ?? snapshot.requestedPeriod ?? 'el periodo solicitado';
  const parts = [`Segun EnergyOS, para ${company} (${snapshot.nemo}) en ${period} si hay datos operativos.`];

  if (snapshot.currentPeriod?.demandaRealMwh !== null && snapshot.currentPeriod?.demandaRealMwh !== undefined) {
    parts.push(`La demanda real informada es ${snapshot.currentPeriod.demandaRealMwh.toFixed(2)} MWh.`);
  }

  if (snapshot.currentPeriod?.compraSpotMwh !== null && snapshot.currentPeriod?.compraSpotMwh !== undefined) {
    parts.push(`La compra spot informada es ${snapshot.currentPeriod.compraSpotMwh.toFixed(2)} MWh.`);
  }

  if (snapshot.invoice?.facturaTotalPesos !== null && snapshot.invoice?.facturaTotalPesos !== undefined) {
    parts.push(`La DTE/facturacion total informada es ARS ${snapshot.invoice.facturaTotalPesos.toFixed(0)}.`);
  }

  parts.push('Si faltan otros bloques, deben declararse como limitaciones parciales, no como ausencia total de datos.');
  return parts.join(' ');
}

export function validateAdvisorResponse(input: AdvisorQaInput): AdvisorQaResult {
  const issues: string[] = [];
  let correctedResponse: string | undefined;

  if (hasMissingDataContradiction(input.response, input.snapshot)) {
    issues.push('missing_data_contradiction');
    correctedResponse = buildCorrectedSummary(input.snapshot);
  }

  const wrongNemos = findWrongNemos(input.response, input.snapshot);
  if (wrongNemos.length > 0) {
    issues.push('unauthorized_or_wrong_nemo');
  }

  return {
    passed: issues.length === 0,
    issues,
    correctedResponse,
  };
}
