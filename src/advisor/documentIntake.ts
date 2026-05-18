import type { AdvisorFile } from '../schemas/advisor.schema.js';

export type AdvisorFileKind =
  | 'pdf'
  | 'image'
  | 'csv'
  | 'json'
  | 'text'
  | 'word'
  | 'spreadsheet'
  | 'unknown';

export type AiFileExtraction = {
  summary: string;
  fields: Record<string, unknown>;
  confidence: 'low' | 'medium' | 'high';
};

export type AdvisorFileAnalysis = {
  name: string;
  type: string;
  kind: AdvisorFileKind;
  status: 'extracted' | 'requires_ai_extraction' | 'failed';
  textPreview?: string;
  structured?: {
    kind: 'table' | 'json' | 'text';
    rows?: number;
    columns?: string[];
    data?: unknown;
  };
  aiExtraction?: AiFileExtraction;
  limitations: string[];
};

export type DocumentIntakeOptions = {
  aiExtractor?: (file: AdvisorFile, kind: AdvisorFileKind) => Promise<AiFileExtraction>;
};

const WORD_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function classifyAdvisorFile(file: AdvisorFile): AdvisorFileKind {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(name)) return 'image';
  if (type.includes('csv') || name.endsWith('.csv')) return 'csv';
  if (type.includes('json') || name.endsWith('.json')) return 'json';
  if (type.startsWith('text/') || /\.(txt|md|log)$/i.test(name)) return 'text';
  if (type === WORD_MIME || /\.(docx|doc)$/i.test(name)) return 'word';
  if (type === XLSX_MIME || /\.(xlsx|xls)$/i.test(name)) return 'spreadsheet';
  return 'unknown';
}

function decodeBase64(content: string): string {
  return Buffer.from(content, 'base64').toString('utf8');
}

function preview(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 1000);
}

function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { columns: [], rows: 0, data: [] };

  const columns = lines[0].split(',').map((value) => value.trim());
  const data = lines.slice(1).map((line) => {
    const values = line.split(',').map((value) => value.trim());
    return Object.fromEntries(columns.map((column, index) => [column, values[index] ?? '']));
  });

  return { columns, rows: data.length, data };
}

async function analyzeOne(file: AdvisorFile, options: DocumentIntakeOptions): Promise<AdvisorFileAnalysis> {
  const kind = classifyAdvisorFile(file);
  const base = {
    name: file.name,
    type: file.type,
    kind,
    limitations: [] as string[],
  };

  try {
    if (kind === 'text') {
      const text = decodeBase64(file.content);
      return {
        ...base,
        status: 'extracted',
        textPreview: preview(text),
        structured: { kind: 'text', data: text },
      };
    }

    if (kind === 'csv') {
      const text = decodeBase64(file.content);
      const parsed = parseCsv(text);
      return {
        ...base,
        status: 'extracted',
        textPreview: preview(text),
        structured: {
          kind: 'table',
          rows: parsed.rows,
          columns: parsed.columns,
          data: parsed.data,
        },
      };
    }

    if (kind === 'json') {
      const text = decodeBase64(file.content);
      return {
        ...base,
        status: 'extracted',
        textPreview: preview(text),
        structured: {
          kind: 'json',
          data: JSON.parse(text) as unknown,
        },
      };
    }

    if (options.aiExtractor) {
      return {
        ...base,
        status: 'extracted',
        aiExtraction: await options.aiExtractor(file, kind),
        limitations: ['Extraccion IA: requiere validacion antes de modificar datos estructurados.'],
      };
    }

    return {
      ...base,
      status: 'requires_ai_extraction',
      limitations: [
        `El tipo ${kind} requiere extractor IA o parser especializado antes de usar valores como fuente estructurada.`,
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return {
      ...base,
      status: 'failed',
      limitations: [`No se pudo procesar el archivo: ${message}`],
    };
  }
}

export async function analyzeAdvisorFiles(
  files: AdvisorFile[],
  options: DocumentIntakeOptions = {},
): Promise<AdvisorFileAnalysis[]> {
  return Promise.all(files.map((file) => analyzeOne(file, options)));
}
