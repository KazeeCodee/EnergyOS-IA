import assert from 'node:assert/strict';
import {
  analyzeAdvisorFiles,
  classifyAdvisorFile,
  createGeminiInlineFileExtractor,
} from './src/advisor/documentIntake.js';

assert.equal(classifyAdvisorFile({ name: 'factura.pdf', type: 'application/pdf', content: 'x' }), 'pdf');
assert.equal(classifyAdvisorFile({ name: 'medidor.jpg', type: 'image/jpeg', content: 'x' }), 'image');
assert.equal(classifyAdvisorFile({ name: 'datos.csv', type: 'text/csv', content: 'x' }), 'csv');
assert.equal(classifyAdvisorFile({ name: 'contrato.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', content: 'x' }), 'word');
assert.equal(classifyAdvisorFile({ name: 'planilla.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', content: 'x' }), 'spreadsheet');

const textAnalyses = await analyzeAdvisorFiles([
  {
    name: 'nota.txt',
    type: 'text/plain',
    content: Buffer.from('Contrato MATER vigente desde enero').toString('base64'),
  },
  {
    name: 'datos.csv',
    type: 'text/csv',
    content: Buffer.from('concepto,importe\nEnergia,1200\nPotencia,800').toString('base64'),
  },
  {
    name: 'factura.json',
    type: 'application/json',
    content: Buffer.from(JSON.stringify({ total: 2000, currency: 'ARS' })).toString('base64'),
  },
]);

assert.equal(textAnalyses[0].status, 'extracted');
assert.match(textAnalyses[0].textPreview ?? '', /Contrato MATER/);
assert.equal(textAnalyses[1].structured?.kind, 'table');
assert.equal(textAnalyses[1].structured?.rows, 2);
assert.equal(textAnalyses[2].structured?.kind, 'json');

const pdfAnalyses = await analyzeAdvisorFiles([
  {
    name: 'factura.pdf',
    type: 'application/pdf',
    content: Buffer.from('%PDF fake').toString('base64'),
  },
], {
  aiExtractor: async (file) => ({
    summary: `Extraido con IA: ${file.name}`,
    fields: { documentType: 'factura' },
    confidence: 'medium',
  }),
});

assert.equal(pdfAnalyses[0].status, 'extracted');
assert.equal(pdfAnalyses[0].aiExtraction?.fields.documentType, 'factura');

const unsupported = await analyzeAdvisorFiles([
  {
    name: 'planilla.xlsx',
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    content: 'ZmFrZQ==',
  },
]);

assert.equal(unsupported[0].status, 'requires_ai_extraction');
assert.match(unsupported[0].limitations[0], /requiere extractor/i);

const geminiExtractor = createGeminiInlineFileExtractor({
  apiKey: 'test-key',
  model: 'gemini-test',
  fetchImpl: async (url, init) => {
    assert.match(String(url), /gemini-test:generateContent/);
    const body = JSON.parse(String(init?.body)) as {
      contents: Array<{ parts: Array<Record<string, unknown>> }>;
    };
    assert.equal(body.contents[0].parts.some((part) => 'inlineData' in part), true);
    return {
      ok: true,
      async json() {
        return {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  summary: 'Factura detectada',
                  fields: { documentType: 'factura', totalAmount: 1234 },
                  confidence: 'high',
                }),
              }],
            },
          }],
        };
      },
      async text() {
        return '';
      },
    } as Response;
  },
});

const geminiResult = await geminiExtractor({
  name: 'factura.pdf',
  type: 'application/pdf',
  content: Buffer.from('%PDF fake').toString('base64'),
}, 'pdf');

assert.equal(geminiResult.summary, 'Factura detectada');
assert.equal(geminiResult.fields.totalAmount, 1234);
assert.equal(geminiResult.confidence, 'high');

console.log('document intake tests passed');
