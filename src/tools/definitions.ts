/**
 * Definiciones de herramientas (tools) para el LLM.
 *
 * Cada herramienta describe QUÉ puede hacer el agente.
 * El LLM decide CUÁNDO y en qué ORDEN llamarlas.
 *
 * Formato compatible con Anthropic y OpenAI.
 */

export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
};

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'get_company_profile',
    description: `Obtiene el perfil de una empresa/agente monitoreado del MEM argentino.
Devuelve: id, razón social, NEMO, tipo de agente.
Usá esto PRIMERO para conocer la empresa antes de analizar sus datos.`,
    input_schema: {
      type: 'object',
      properties: {
        company_id: {
          type: 'string',
          description: 'UUID de la empresa (agente monitoreado)',
        },
      },
      required: ['company_id'],
    },
  },
  {
    name: 'get_period_data',
    description: `Obtiene los datos mensuales de una empresa para un período específico.
Devuelve: demanda total MWh, MATER MWh, spot MWh, porcentaje renovable, costos, y flag de dato sospechoso.
Estos son los datos crudos del período — necesitás calculate_metrics para obtener variaciones e indicadores.`,
    input_schema: {
      type: 'object',
      properties: {
        company_id: {
          type: 'string',
          description: 'UUID de la empresa',
        },
        year: {
          type: 'number',
          description: 'Año del período (ej: 2026)',
        },
        month: {
          type: 'number',
          description: 'Mes del período (1-12)',
        },
      },
      required: ['company_id', 'year', 'month'],
    },
  },
  {
    name: 'get_historical_data',
    description: `Obtiene el historial de N meses hacia atrás desde un período dado.
Útil para: ver tendencias, detectar estacionalidad, comparar contra el patrón histórico.
Devuelve un array de datos mensuales ordenados cronológicamente.`,
    input_schema: {
      type: 'object',
      properties: {
        company_id: {
          type: 'string',
          description: 'UUID de la empresa',
        },
        year: {
          type: 'number',
          description: 'Año de referencia',
        },
        month: {
          type: 'number',
          description: 'Mes de referencia (1-12)',
        },
        months_back: {
          type: 'number',
          description: 'Cuántos meses hacia atrás obtener (default: 6, máximo recomendado: 12)',
        },
      },
      required: ['company_id', 'year', 'month'],
    },
  },
  {
    name: 'get_exposure_data',
    description: `Obtiene la serie de exposición spot mensual de un agente desde la vista de Railway.
Devuelve: demanda real, demanda contratada, compra spot, porcentaje spot/MATER, sub/sobre-contrato, costo spot promedio.
Usá esto para analizar cobertura contractual y riesgo de volatilidad.`,
    input_schema: {
      type: 'object',
      properties: {
        nemo: {
          type: 'string',
          description: 'NEMO del agente (8 caracteres, ej: "PAMPAENE")',
        },
        months: {
          type: 'number',
          description: 'Cuántos meses obtener (default: 24)',
        },
      },
      required: ['nemo'],
    },
  },
  {
    name: 'calculate_metrics',
    description: `Calcula TODAS las métricas energéticas del período: variaciones de costo y consumo vs período anterior, delta costo vs consumo, exposición spot, cobertura contractual, cumplimiento renovable, score de desviación histórica, y risk score compuesto (0-100).
IMPORTANTE: Los números que devuelve esta herramienta son EXACTOS (calculados por código determinístico). Nunca los recalculés ni los modifiqués.
Llamá esta herramienta SIEMPRE antes de interpretar un período.`,
    input_schema: {
      type: 'object',
      properties: {
        company_id: {
          type: 'string',
          description: 'UUID de la empresa',
        },
        period: {
          type: 'string',
          description: 'Período en formato YYYY-MM (ej: "2026-04")',
        },
      },
      required: ['company_id', 'period'],
    },
  },
  {
    name: 'detect_anomalies',
    description: `Ejecuta las 12 reglas de detección de anomalías sobre las métricas de un período.
Las reglas cubren: costo vs consumo, exposición spot, cobertura, cumplimiento renovable, desviación histórica, ruptura de tendencia, y más.
Devuelve: findings (hallazgos con severidad y evidencia) y recommendations (acciones sugeridas).
IMPORTANTE: Esta herramienta detecta señales. Tu trabajo es INTERPRETAR los hallazgos, correlacionarlos, y explicar qué significan en contexto.`,
    input_schema: {
      type: 'object',
      properties: {
        company_id: {
          type: 'string',
          description: 'UUID de la empresa',
        },
        period: {
          type: 'string',
          description: 'Período en formato YYYY-MM',
        },
      },
      required: ['company_id', 'period'],
    },
  },
  {
    name: 'get_market_data',
    description: `Obtiene datos de mercado para un período (precios, parámetros CAMMESA).
Útil para: contextualizar los costos de una empresa contra el mercado general.`,
    input_schema: {
      type: 'object',
      properties: {
        year: {
          type: 'number',
          description: 'Año',
        },
        month: {
          type: 'number',
          description: 'Mes (1-12)',
        },
      },
      required: ['year', 'month'],
    },
  },
  {
    name: 'get_previous_analysis',
    description: `Obtiene el análisis previo del agente para esta empresa/período (si existe).
Útil para: ver si ya se analizó este período, comparar con el diagnóstico anterior, y dar seguimiento a recomendaciones previas.`,
    input_schema: {
      type: 'object',
      properties: {
        company_id: {
          type: 'string',
          description: 'UUID de la empresa',
        },
        period: {
          type: 'string',
          description: 'Período en formato YYYY-MM',
        },
      },
      required: ['company_id', 'period'],
    },
  },
  {
    name: 'get_client_private_context',
    description: `Obtiene contexto privado autorizado del Data Room de EnergyOS para un NEMO: contratos vigentes, completitud, vencimientos, datos faltantes, evidencia resumida y advertencias.
Usalo cuando la pregunta requiera contexto contractual, evidencia privada, vencimientos, responsables o faltantes del cliente.
IMPORTANTE: Esta herramienta solo devuelve datos si el usuario esta autenticado y autorizado para ese NEMO. No inventes datos si no esta disponible.`,
    input_schema: {
      type: 'object',
      properties: {
        nemo: {
          type: 'string',
          description: 'NEMO del agente/cliente (8 caracteres)',
        },
      },
      required: ['nemo'],
    },
  },
];
