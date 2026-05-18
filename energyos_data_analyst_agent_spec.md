# Documento base — EnergyOS Data Analyst Agent

## 1. Objetivo del documento

Este documento define la primera versión del agente inteligente de EnergyOS: un agente experto en análisis de datos energéticos capaz de interpretar los datos generados por el sistema, detectar problemas, explicar causas probables, recomendar acciones concretas y generar entregables ejecutivos.

La intención es usar este documento como guía técnica y funcional para construir el módulo con herramientas como Codex, Antigravity u otros entornos de desarrollo asistido por IA.

---

# 2. Definición general del agente

## Nombre funcional

**EnergyOS Data Analyst Agent**

También puede mostrarse comercialmente como:

- EnergyOS Advisor
- EnergyOS Intelligence
- Analista EnergyOS
- EnergyOS Brain

## Definición corta

EnergyOS Data Analyst Agent es un agente experto de análisis energético que interpreta los datos generados por EnergyOS, detecta desvíos, anomalías, riesgos y oportunidades, explica causas probables, recomienda acciones concretas y genera informes, presentaciones y planes de acción para ayudar a las empresas a tomar mejores decisiones energéticas.

## Definición completa

EnergyOS Data Analyst Agent no es un chatbot generalista. Es una capa de inteligencia energética integrada a EnergyOS.

Su función principal es transformar datos energéticos en decisiones accionables. Para eso, analiza consumo, costos, evolución histórica, puntos de suministro, exposición, cobertura, cumplimiento, variaciones y otros indicadores generados por el sistema.

El agente debe trabajar con trazabilidad, evidencia numérica, niveles de confianza y límites explícitos. No debe inventar datos ni afirmar certezas cuando solo existen hipótesis.

---

# 3. Principio central de diseño

El agente no debe reemplazar cálculos determinísticos con IA.

La arquitectura correcta es:

```text
Datos del sistema
↓
Métricas calculadas por código
↓
Hallazgos detectados por reglas
↓
Interpretación asistida por IA
↓
Recomendaciones accionables
↓
Informe / chat / presentación / plan de acción
```

Regla clave:

> El sistema calcula y estructura. La IA interpreta, prioriza, explica y comunica.

---

# 4. Alcance de esta primera versión

Esta primera versión se enfoca únicamente en el análisis de datos energéticos que EnergyOS ya genera o puede generar.

## Incluye

- análisis de consumo;
- análisis de costos;
- comparación entre períodos;
- análisis histórico;
- análisis por punto de suministro;
- detección de anomalías;
- identificación de problemas;
- explicación de causas probables;
- recomendaciones accionables;
- generación de informes;
- generación de presentaciones;
- generación de planes de acción;
- conversación por texto;
- conversación por voz, si se implementa la capa de speech-to-text y text-to-speech;
- búsqueda web controlada cuando aporte contexto;
- trazabilidad de datos usados;
- nivel de confianza;
- detección de datos faltantes;
- historial de análisis y recomendaciones.

## No incluye todavía

- reemplazo completo de un especialista energético humano;
- decisiones automáticas sin aprobación humana;
- operación automática de maquinaria;
- compra o venta automática de energía;
- negociación contractual automática;
- auditoría energética física;
- recomendaciones de CAPEX complejas sin datos técnicos suficientes;
- diagnóstico definitivo de causas físicas si no hay datos operativos;
- garantía de ahorro económico.

---

# 5. Capacidades funcionales del agente

## 5.1 Leer e interpretar datos energéticos

El agente debe poder analizar datos como:

```text
- consumo mensual;
- costo energético mensual;
- costo promedio por MWh;
- evolución histórica;
- variaciones mes a mes;
- variaciones contra promedios históricos;
- puntos de suministro;
- exposición;
- cobertura;
- cumplimiento;
- desvíos;
- rankings;
- indicadores calculados por EnergyOS.
```

El agente no debe limitarse a describir datos. Debe interpretarlos.

Ejemplo:

```text
El costo aumentó 22%, pero el consumo solo aumentó 3%.
Esto indica que el aumento no parece estar explicado principalmente por mayor volumen consumido. La causa probable puede estar en precio efectivo, exposición, cobertura o composición de compra.
```

---

## 5.2 Generar diagnósticos automáticos

El agente debe poder generar un diagnóstico de un período determinado.

Ejemplo de salida:

```text
Diagnóstico mensual — Abril 2026

Estado general: requiere atención.

Hallazgos principales:
1. El costo aumentó más que el consumo.
2. El costo promedio por MWh empeoró.
3. Planta Norte concentra la mayor parte del desvío.
4. Falta información contractual para confirmar causa exacta.
```

---

## 5.3 Detectar problemas

El agente debe detectar problemas como:

```text
- aumento de costo no explicado por consumo;
- aumento anormal de consumo;
- deterioro del costo promedio por MWh;
- concentración de desvíos en un punto de suministro;
- variación atípica contra promedio histórico;
- aumento de exposición;
- caída de cobertura;
- riesgo de cumplimiento;
- datos insuficientes;
- cambios bruscos de tendencia;
- posibles oportunidades de revisión comercial.
```

---

## 5.4 Explicar causas probables

El agente debe separar hechos, interpretación, hipótesis y datos faltantes.

Formato recomendado:

```text
Hechos:
- El costo aumentó 22%.
- El consumo aumentó 3%.
- El costo por MWh aumentó 18%.

Interpretación:
El aumento de costo no parece explicarse principalmente por mayor consumo.

Hipótesis:
Puede estar relacionado con precio efectivo, exposición, cobertura o composición de compra.

Dato faltante:
Falta detalle contractual/composición de compra del período.
```

---

## 5.5 Dar recomendaciones accionables

Cada recomendación debe incluir:

```text
- título;
- prioridad;
- motivo;
- evidencia;
- acción concreta;
- impacto esperado;
- nivel de confianza;
- datos necesarios para confirmar.
```

Ejemplo:

```text
Recomendación:
Revisar precio efectivo y cobertura contractual del período, empezando por Planta Norte.

Motivo:
Planta Norte explica el 43% del desvío total y el costo creció mucho más que el consumo.

Próxima acción:
Comparar el precio efectivo del período contra el promedio de los últimos 6 meses.

Confianza:
Media. Falta detalle contractual para confirmar causa exacta.
```

---

## 5.6 Priorizar problemas

El agente debe ordenar problemas por:

```text
- impacto económico;
- urgencia;
- riesgo;
- confianza del diagnóstico;
- concentración del problema;
- posibilidad de acción.
```

---

## 5.7 Responder preguntas por chat

El usuario debe poder escribir preguntas como:

```text
¿Por qué subió el costo este mes?
¿Qué cambió contra el mes anterior?
¿Qué punto de suministro explica el mayor desvío?
¿Qué debería revisar primero?
¿El aumento viene por consumo o por precio?
¿Hay algo raro en los datos?
¿Qué riesgo tenemos?
¿Cómo venimos contra los últimos 6 meses?
¿Qué le digo a dirección?
¿Qué acción concreta me recomendás?
```

El agente debe responder usando datos reales del sistema, no respuestas genéricas.

---

## 5.8 Conversar por voz

El agente debe estar preparado para una capa de voz.

Capacidades posibles:

```text
- recibir audio del usuario;
- convertir audio a texto;
- responder por texto;
- opcionalmente responder por voz;
- guardar transcripción;
- transformar la conversación en resumen, tareas o informe.
```

La implementación de voz puede ser una fase posterior, pero la arquitectura del agente debe permitirla.

---

## 5.9 Generar informes

El agente debe poder generar distintos tipos de informe:

```text
- informe ejecutivo mensual;
- informe técnico;
- informe para dirección;
- informe de riesgos;
- informe de oportunidades;
- informe comparativo entre períodos;
- informe por punto de suministro;
- informe de diagnóstico inicial;
- informe de seguimiento de recomendaciones.
```

Estructura base:

```text
1. Resumen ejecutivo
2. Estado general del período
3. Hallazgos principales
4. Evidencia numérica
5. Interpretación
6. Riesgos
7. Recomendaciones
8. Plan de acción
9. Datos usados
10. Limitaciones
```

---

## 5.10 Generar presentaciones

El agente debe poder generar una presentación basada en los hallazgos.

Tipos:

```text
- presentación para dirección;
- presentación mensual de situación energética;
- presentación de riesgos;
- presentación de oportunidades;
- presentación para justificar una decisión;
- presentación comercial para mostrar valor del sistema.
```

Estructura sugerida:

```text
Slide 1: Estado energético del período
Slide 2: Qué cambió
Slide 3: Principales hallazgos
Slide 4: Impacto económico
Slide 5: Riesgos detectados
Slide 6: Foco por punto de suministro
Slide 7: Recomendaciones
Slide 8: Plan de acción
```

---

## 5.11 Generar planes de acción

El agente debe convertir recomendaciones en tareas concretas.

Ejemplo:

```text
Plan de acción — próximos 14 días

Día 1-2:
Validar que los datos del período estén completos.

Día 3-5:
Comparar costo por MWh contra los últimos 6 meses.

Día 6-8:
Revisar Planta Norte, que concentra el mayor desvío.

Día 9-11:
Validar cobertura/exposición del período.

Día 12-14:
Preparar decisión comercial o contractual.
```

Cada tarea debe poder incluir:

```text
- acción;
- objetivo;
- responsable sugerido;
- prioridad;
- plazo;
- datos necesarios;
- resultado esperado.
```

---

## 5.12 Buscar información externa

El agente puede usar búsqueda web cuando ayude a completar una tarea.

Casos válidos:

```text
- cambios regulatorios;
- novedades del mercado energético;
- contexto macro del sector;
- información pública de precios o normativa;
- noticias relevantes;
- información pública de una empresa o industria;
- datos externos que puedan ayudar a contextualizar un fenómeno detectado internamente.
```

Regla:

> Internet complementa. No reemplaza los datos internos de EnergyOS.

Toda información externa usada debe quedar citada o registrada como fuente.

---

## 5.13 Generar alertas inteligentes

El agente debe convertir hallazgos en alertas accionables.

Ejemplo:

```text
Alerta: aumento de costo no explicado por consumo.

Evidencia:
- Costo +22%.
- Consumo +3%.
- Costo por MWh +18%.

Prioridad:
Alta.

Acción recomendada:
Revisar precio efectivo, exposición y cobertura.
```

Primer set de alertas:

```text
1. Costo sube más que consumo.
2. Consumo sube fuera del patrón.
3. Costo por MWh empeora.
4. Un punto de suministro concentra el desvío.
5. Exposición aumenta.
6. Cobertura cae.
7. Variación atípica contra histórico.
8. Riesgo de cumplimiento.
9. Datos incompletos.
10. Mes rompe tendencia.
11. Costo estable pero consumo cae.
12. Consumo estable pero costo por MWh empeora.
```

---

## 5.14 Comparar períodos

El agente debe comparar:

```text
- mes actual contra mes anterior;
- mes actual contra promedio 3 meses;
- mes actual contra promedio 6 meses;
- mes actual contra mismo mes del año anterior;
- trimestre contra trimestre;
- año contra año;
- punto de suministro contra punto de suministro.
```

---

## 5.15 Analizar puntos de suministro

El agente debe poder identificar qué punto de suministro explica más un problema.

Ejemplo:

```text
Ranking de impacto:

1. Planta Norte — explica 43% del desvío.
2. Planta Sur — explica 21%.
3. Depósito Central — explica 9%.

Foco recomendado:
Planta Norte.
```

---

## 5.16 Detectar datos faltantes

El agente debe identificar qué datos faltan para mejorar el diagnóstico.

Ejemplo:

```text
Con los datos actuales puedo detectar que el costo aumentó más que el consumo.

Pero para confirmar la causa exacta faltan:
- detalle contractual;
- composición de compra;
- exposición del período;
- precio efectivo discriminado.
```

---

## 5.17 Medir confianza del análisis

Cada respuesta importante debe tener nivel de confianza.

Niveles:

```text
Alta:
Los datos son completos y la señal es clara.

Media:
Existe evidencia fuerte, pero falta algún dato para confirmar la causa exacta.

Baja:
Los datos son incompletos o la señal puede tener múltiples explicaciones.
```

---

## 5.18 Guardar historial y seguimiento

El agente debe guardar:

```text
- diagnósticos generados;
- hallazgos detectados;
- recomendaciones dadas;
- recomendaciones aceptadas;
- recomendaciones descartadas;
- informes generados;
- preguntas del usuario;
- respuestas del agente;
- evolución de riesgos.
```

Esto permite seguimiento:

```text
El mes pasado se recomendó revisar exposición. Este mes el mismo patrón continúa, por lo que la prioridad aumenta.
```

---

# 6. Arquitectura funcional

## 6.1 Arquitectura general

```text
EnergyOS App
    ↓
EnergyOS API
    ↓
EnergyOS Data Analyst Agent API
    ↓
Módulos internos del agente
    ↓
Respuesta estructurada / informe / presentación / plan
```

El agente debe ser un servicio separado o un módulo claramente aislado.

Recomendación:

```text
energyos-web        → interfaz de usuario
energyos-api        → datos, usuarios, empresas, permisos
energyos-agent      → inteligencia, análisis, recomendaciones, IA
```

Si por velocidad se construye dentro del mismo monorepo, debe quedar aislado como módulo:

```text
/services/agent
/lib/energy-intelligence
```

---

## 6.2 Esquema interno del agente

Para el usuario parece un solo agente.

Internamente funciona como un equipo modular:

```text
1. Orchestrator
2. Data Retriever
3. Metrics Engine
4. Anomaly Detector
5. Knowledge Retriever
6. Energy Interpreter
7. Recommendation Engine
8. Report Generator
9. Presentation Generator
10. Action Plan Generator
11. Quality / Confidence Checker
12. Memory / History Manager
```

---

# 7. Módulos internos

## 7.1 Orchestrator

Responsabilidad:

Coordina el flujo completo. Decide qué herramientas usar según la tarea del usuario.

Ejemplos de tareas:

```text
- analyze_period
- answer_question
- generate_report
- generate_presentation
- generate_action_plan
- detect_alerts
- compare_periods
- analyze_supply_point
```

Entrada típica:

```json
{
  "companyId": "empresa_123",
  "period": "2026-04",
  "task": "analyze_period",
  "userQuestion": null
}
```

Salida:

```json
{
  "summary": "",
  "findings": [],
  "recommendations": [],
  "confidence": "medium",
  "dataUsed": [],
  "missingData": []
}
```

---

## 7.2 Data Retriever

Responsabilidad:

Trae los datos necesarios desde EnergyOS.

Funciones sugeridas:

```text
getCompanyEnergySummary(companyId, period)
getMonthlyMetrics(companyId, period)
getHistoricalMetrics(companyId, period, months)
getSupplyPointBreakdown(companyId, period)
getCostBreakdown(companyId, period)
getConsumptionTrend(companyId, period, months)
getExposureMetrics(companyId, period)
getContractCoverage(companyId, period)
getRenewableCompliance(companyId, period)
getPreviousAgentAnalysis(companyId, period)
```

Regla:

El agente no debe conectarse de forma caótica a toda la base. Debe consumir funciones/endpoints internos bien definidos.

---

## 7.3 Metrics Engine

Responsabilidad:

Calcula indicadores duros mediante código determinístico.

Indicadores sugeridos:

```text
total_consumption_mwh
total_cost
navg_cost_per_mwh
cost_change_pct
consumption_change_pct
avg_cost_per_mwh_change_pct
cost_vs_consumption_delta
supply_point_impact_share
historical_deviation_score
exposure_change_pct
coverage_change_pct
risk_score
renewable_compliance_gap
```

Ejemplo de output:

```json
{
  "period": "2026-04",
  "totalConsumptionMwh": 1200,
  "totalCost": 185000,
  "avgCostPerMwh": 154.16,
  "costChangePct": 22,
  "consumptionChangePct": 3,
  "avgCostPerMwhChangePct": 18,
  "mainSupplyPointImpact": "Planta Norte",
  "mainSupplyPointImpactShare": 43
}
```

---

## 7.4 Anomaly Detector

Responsabilidad:

Detecta hallazgos iniciales mediante reglas.

Ejemplos de reglas:

```text
Si costo sube > 10% y consumo sube < 5%, detectar aumento de costo no explicado por consumo.

Si costo por MWh sube > 8%, detectar deterioro del costo unitario.

Si un punto de suministro explica > 40% del desvío total, marcarlo como foco prioritario.

Si consumo se desvía > 2 desviaciones estándar del promedio de 6 meses, marcar variación atípica.

Si exposición aumenta > 10% contra el promedio reciente, marcar riesgo de exposición.

Si faltan datos críticos, crear hallazgo de datos insuficientes.
```

Ejemplo de finding:

```json
{
  "type": "cost_increase_not_explained_by_consumption",
  "severity": "high",
  "title": "El costo aumentó más que el consumo",
  "evidence": {
    "costChangePct": 22,
    "consumptionChangePct": 3,
    "avgCostPerMwhChangePct": 18
  },
  "status": "detected"
}
```

---

## 7.5 Knowledge Retriever

Responsabilidad:

Busca conocimiento técnico relevante para interpretar hallazgos.

Fuentes:

```text
- base de conocimiento interna;
- documentos metodológicos de EnergyOS;
- glosario energético;
- playbooks de interpretación;
- documentación sobre costos, exposición, cobertura y cumplimiento;
- fuentes externas si se habilita búsqueda web.
```

La base de conocimiento debe estar fragmentada por temas y no cargarse completa en cada respuesta.

Temas mínimos:

```text
01-glosario-energetico.md
02-interpretacion-de-costos.md
03-interpretacion-de-consumo.md
04-costo-promedio-por-mwh.md
05-exposicion-y-cobertura.md
06-cumplimiento-renovable.md
07-puntos-de-suministro.md
08-playbooks-de-diagnostico.md
09-metodologia-energyos.md
10-limitaciones-del-analisis.md
```

---

## 7.6 Energy Interpreter

Responsabilidad:

Usa IA para interpretar métricas y hallazgos.

Debe convertir:

```text
Costo +22%
Consumo +3%
Costo por MWh +18%
```

En:

```text
El aumento de costo no parece explicado principalmente por mayor consumo. La señal apunta a deterioro del precio efectivo, mayor exposición, menor cobertura o cambio en composición de compra.
```

Reglas:

```text
- No inventar datos.
- Separar hechos de hipótesis.
- Indicar datos faltantes.
- No afirmar causa definitiva si solo hay evidencia indirecta.
- Priorizar lenguaje ejecutivo y accionable.
```

---

## 7.7 Recommendation Engine

Responsabilidad:

Genera recomendaciones accionables a partir de hallazgos interpretados.

Formato de recomendación:

```json
{
  "title": "Revisar precio efectivo y cobertura contractual",
  "priority": "high",
  "reason": "El costo subió 22% mientras el consumo solo subió 3%.",
  "evidence": [
    "Costo total +22%",
    "Consumo +3%",
    "Costo por MWh +18%"
  ],
  "action": "Comparar precio efectivo del período contra los últimos 6 meses.",
  "expectedImpact": "Identificar la causa económica del aumento y posibles oportunidades de corrección.",
  "confidence": "medium",
  "requiredData": [
    "detalle contractual",
    "composición de compra"
  ]
}
```

---

## 7.8 Report Generator

Responsabilidad:

Genera informes a partir del análisis.

Tipos iniciales:

```text
executive_monthly_report
technical_report
risk_report
supply_point_report
recommendation_followup_report
```

Debe poder devolver:

```text
- markdown;
- HTML;
- JSON estructurado;
- PDF en una etapa posterior.
```

---

## 7.9 Presentation Generator

Responsabilidad:

Genera una estructura de presentación basada en el análisis.

Output recomendado:

```json
{
  "title": "Informe energético — Abril 2026",
  "slides": [
    {
      "title": "Estado energético del período",
      "type": "cover_or_summary",
      "bullets": [],
      "speakerNotes": ""
    }
  ]
}
```

La generación visual o exportación PPTX puede ser una fase posterior.

---

## 7.10 Action Plan Generator

Responsabilidad:

Convierte recomendaciones en tareas concretas.

Formato:

```json
{
  "title": "Plan de acción para revisar aumento de costo",
  "timeframe": "14 days",
  "tasks": [
    {
      "order": 1,
      "title": "Validar datos del período",
      "objective": "Confirmar que el análisis parte de datos completos.",
      "priority": "high",
      "suggestedOwner": "Responsable energético / administración",
      "deadline": "Día 2",
      "expectedOutput": "Datos validados o inconsistencias identificadas."
    }
  ]
}
```

---

## 7.11 Quality / Confidence Checker

Responsabilidad:

Valida que la respuesta final sea segura, útil y trazable.

Debe revisar:

```text
- que no haya datos inventados;
- que cada afirmación importante tenga evidencia;
- que las hipótesis estén marcadas como hipótesis;
- que existan datos usados;
- que se indiquen limitaciones;
- que haya nivel de confianza;
- que las recomendaciones sean concretas;
- que no se prometa ahorro garantizado;
- que no se tomen decisiones automáticas sin aprobación.
```

---

## 7.12 Memory / History Manager

Responsabilidad:

Guarda historial operativo del agente.

Debe guardar:

```text
- agent_runs;
- findings;
- recommendations;
- reports;
- user_questions;
- user_feedback;
- action_plan_status;
- confidence evolution.
```

No confundir con el CRM energético avanzado. En esta primera etapa, la memoria se enfoca en historial de análisis y recomendaciones.

---

# 8. Flujos principales

## 8.1 Flujo: análisis mensual automático

Endpoint sugerido:

```text
POST /agent/analyze-period
```

Input:

```json
{
  "companyId": "empresa_123",
  "period": "2026-04",
  "analysisType": "monthly_diagnosis"
}
```

Proceso:

```text
1. Orchestrator recibe la tarea.
2. Data Retriever busca datos del período.
3. Data Retriever busca histórico comparable.
4. Metrics Engine calcula indicadores.
5. Anomaly Detector genera hallazgos.
6. Knowledge Retriever trae playbooks relevantes.
7. Energy Interpreter interpreta hallazgos.
8. Recommendation Engine genera recomendaciones.
9. Quality Checker valida respuesta.
10. Memory Manager guarda el análisis.
11. API devuelve resultado estructurado.
```

Output:

```json
{
  "executiveSummary": "El costo aumentó de forma desproporcionada respecto del consumo.",
  "overallStatus": "attention_required",
  "riskLevel": "high",
  "findings": [],
  "recommendations": [],
  "missingData": [],
  "dataUsed": [],
  "confidence": "medium"
}
```

---

## 8.2 Flujo: pregunta del usuario por chat

Endpoint sugerido:

```text
POST /agent/ask
```

Input:

```json
{
  "companyId": "empresa_123",
  "period": "2026-04",
  "question": "¿Por qué subió el costo este mes?"
}
```

Proceso:

```text
1. Clasificar intención de la pregunta.
2. Buscar análisis previo del período si existe.
3. Si no existe, ejecutar análisis básico.
4. Recuperar métricas relevantes.
5. Recuperar hallazgos relacionados.
6. Generar respuesta conversacional.
7. Validar respuesta.
8. Guardar pregunta y respuesta.
```

Output:

```json
{
  "answer": "El costo subió principalmente por un deterioro del costo promedio por MWh, no por mayor consumo.",
  "evidence": [
    "Costo +22%",
    "Consumo +3%",
    "Costo por MWh +18%"
  ],
  "interpretation": "El aumento no parece explicado principalmente por volumen.",
  "recommendedAction": "Revisar precio efectivo y cobertura contractual.",
  "confidence": "medium",
  "dataUsed": []
}
```

---

## 8.3 Flujo: generar informe

Endpoint sugerido:

```text
POST /agent/generate-report
```

Input:

```json
{
  "companyId": "empresa_123",
  "period": "2026-04",
  "reportType": "executive_monthly_report",
  "audience": "directors"
}
```

Proceso:

```text
1. Obtener análisis del período.
2. Si no existe, generarlo.
3. Seleccionar hallazgos principales.
4. Adaptar lenguaje a audiencia.
5. Generar informe en estructura definida.
6. Validar consistencia.
7. Guardar informe.
```

Output:

```json
{
  "reportTitle": "Informe ejecutivo energético — Abril 2026",
  "format": "markdown",
  "content": "...",
  "dataUsed": [],
  "confidence": "medium"
}
```

---

## 8.4 Flujo: generar presentación

Endpoint sugerido:

```text
POST /agent/generate-presentation
```

Input:

```json
{
  "companyId": "empresa_123",
  "period": "2026-04",
  "audience": "directors",
  "slideCount": 8
}
```

Output:

```json
{
  "title": "Situación energética — Abril 2026",
  "slides": [
    {
      "slideNumber": 1,
      "title": "Estado energético del período",
      "bullets": [],
      "visualSuggestion": "Indicador de estado general y variación costo/consumo",
      "speakerNotes": ""
    }
  ]
}
```

---

## 8.5 Flujo: generar plan de acción

Endpoint sugerido:

```text
POST /agent/generate-action-plan
```

Input:

```json
{
  "companyId": "empresa_123",
  "period": "2026-04",
  "findingIds": ["finding_001"],
  "timeframe": "14_days"
}
```

Output:

```json
{
  "title": "Plan de acción para revisar aumento de costo",
  "timeframe": "14_days",
  "tasks": []
}
```

---

# 9. Modelo de datos sugerido

## 9.1 Tabla: agent_runs

```text
id
company_id
period
task_type
input_payload
output_payload
status
model_used
tokens_used
cost_estimate
confidence
created_at
updated_at
```

## 9.2 Tabla: agent_findings

```text
id
agent_run_id
company_id
period
type
title
severity
evidence_json
interpretation
likely_causes_json
missing_data_json
confidence
status
created_at
updated_at
```

## 9.3 Tabla: agent_recommendations

```text
id
company_id
period
finding_id
title
priority
reason
action
expected_impact
required_data_json
confidence
status
created_at
updated_at
```

Estados sugeridos:

```text
pending
accepted
rejected
in_progress
completed
obsolete
```

## 9.4 Tabla: agent_reports

```text
id
company_id
period
report_type
audience
title
content_markdown
content_json
created_by_run_id
created_at
updated_at
```

## 9.5 Tabla: agent_conversations

```text
id
company_id
period
user_id
title
created_at
updated_at
```

## 9.6 Tabla: agent_messages

```text
id
conversation_id
role
content
data_used_json
confidence
created_at
```

## 9.7 Tabla: knowledge_documents

```text
id
title
category
source_type
version
content
status
created_at
updated_at
```

## 9.8 Tabla: knowledge_chunks

```text
id
document_id
chunk_text
embedding
metadata_json
created_at
updated_at
```

---

# 10. Tipos y esquemas principales

## 10.1 EnergyMetrics

```ts
export type EnergyMetrics = {
  companyId: string
  period: string
  totalConsumptionMwh?: number
  totalCost?: number
  avgCostPerMwh?: number
  costChangePct?: number
  consumptionChangePct?: number
  avgCostPerMwhChangePct?: number
  costVsConsumptionDelta?: number
  spotExposurePct?: number
  exposureChangePct?: number
  contractCoveragePct?: number
  coverageChangePct?: number
  renewableCompliancePct?: number
  renewableComplianceGap?: number
  mainSupplyPointImpact?: string
  mainSupplyPointImpactShare?: number
  historicalDeviationScore?: number
  riskScore?: number
}
```

## 10.2 Finding

```ts
export type Finding = {
  id: string
  type: string
  title: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  evidence: Record<string, unknown>
  interpretation?: string
  likelyCauses?: string[]
  recommendedChecks?: string[]
  missingData?: string[]
  confidence: 'low' | 'medium' | 'high'
}
```

## 10.3 Recommendation

```ts
export type Recommendation = {
  id: string
  findingId?: string
  title: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  reason: string
  evidence: string[]
  action: string
  expectedImpact?: string
  requiredData?: string[]
  confidence: 'low' | 'medium' | 'high'
  status?: 'pending' | 'accepted' | 'rejected' | 'in_progress' | 'completed' | 'obsolete'
}
```

## 10.4 AgentAnalysisOutput

```ts
export type AgentAnalysisOutput = {
  companyId: string
  period: string
  executiveSummary: string
  overallStatus: 'normal' | 'attention_required' | 'critical'
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  findings: Finding[]
  recommendations: Recommendation[]
  missingData: string[]
  dataUsed: string[]
  confidence: 'low' | 'medium' | 'high'
  limitations: string[]
}
```

---

# 11. Prompts base

## 11.1 System prompt general

```text
Sos EnergyOS Data Analyst Agent, un analista energético digital especializado en interpretar datos energéticos de grandes consumidores.

Tu función es analizar métricas generadas por EnergyOS, detectar hallazgos relevantes, explicar causas probables y recomendar acciones concretas.

No sos un chatbot generalista. Sos una capa de inteligencia energética orientada a decisiones.

Reglas obligatorias:
1. No inventes datos.
2. Usá únicamente los datos provistos por EnergyOS y la base de conocimiento disponible.
3. Separá hechos, interpretación, hipótesis y recomendaciones.
4. Cuando falten datos, indicá qué falta y cómo afecta la confianza del diagnóstico.
5. Priorizá hallazgos por impacto económico, riesgo y urgencia.
6. No presentes hipótesis como certezas.
7. Explicá en lenguaje ejecutivo, claro y accionable.
8. Toda recomendación debe incluir motivo, evidencia, acción concreta, prioridad, confianza y datos necesarios.
9. No prometas ahorros garantizados.
10. Tu objetivo no es describir gráficos, sino convertir datos energéticos en decisiones accionables.
```

## 11.2 Prompt de interpretación

```text
Recibirás métricas calculadas por EnergyOS, hallazgos detectados por reglas y contexto técnico relevante.

Para cada hallazgo:
1. Explicá qué significa.
2. Indicá por qué importa.
3. Planteá causas probables.
4. Indicá qué dato falta para confirmar.
5. Sugerí próxima acción.
6. Asigná nivel de confianza.

No inventes causas. Si los datos no alcanzan, indicá la limitación.
```

## 11.3 Prompt de recomendaciones

```text
Generá recomendaciones priorizadas según impacto, urgencia, riesgo y confianza.

Cada recomendación debe incluir:
- título;
- prioridad;
- motivo;
- evidencia;
- acción concreta;
- impacto esperado;
- confianza;
- datos necesarios.

No uses recomendaciones genéricas. Cada acción debe estar conectada a un hallazgo o métrica específica.
```

## 11.4 Prompt de informe ejecutivo

```text
Generá un informe ejecutivo claro y accionable para dirección.

Estructura:
1. Resumen ejecutivo.
2. Estado general del período.
3. Hallazgos principales.
4. Evidencia numérica.
5. Interpretación.
6. Riesgos.
7. Recomendaciones.
8. Plan de acción.
9. Datos usados.
10. Limitaciones.

Usá lenguaje profesional, directo y orientado a decisiones. No uses relleno corporativo.
```

---

# 12. Stack técnico recomendado

## Lenguaje

```text
TypeScript
```

## Backend

Opciones:

```text
- Node.js + Fastify
- Node.js + Hono
- Next.js API Routes si se integra al monorepo
```

Recomendación inicial:

```text
Node.js + TypeScript + Hono/Fastify
```

## Base de datos

```text
Postgres
```

## ORM

```text
Drizzle ORM
```

## Validación

```text
Zod
```

## Vector search / RAG

Opciones:

```text
- Postgres + pgvector
- Supabase Vector
- Qdrant
- Pinecone
```

Recomendación inicial:

```text
Postgres + pgvector
```

## Modelos IA

Opciones:

```text
- OpenAI
- Anthropic
```

Recomendación:

Implementar una capa provider para no quedar atado a un único modelo.

```text
/providers/openai.ts
/providers/anthropic.ts
```

## Voz

Capa opcional:

```text
speech-to-text
text-to-speech
voice session transcript
```

Puede implementarse después. La primera versión debe dejar preparado el modelo de conversaciones para guardar transcripciones.

## Generación de documentos

Primera etapa:

```text
Markdown / HTML / JSON
```

Segunda etapa:

```text
PDF / PPTX
```

---

# 13. Estructura sugerida del proyecto

```text
energyos-agent/
  src/
    api/
      analyze-period.ts
      ask.ts
      generate-report.ts
      generate-presentation.ts
      generate-action-plan.ts
      feedback.ts

    orchestrator/
      analyzePeriod.ts
      answerQuestion.ts
      generateReport.ts
      generatePresentation.ts
      generateActionPlan.ts

    tools/
      dataRetriever.ts
      metricsEngine.ts
      anomalyDetector.ts
      knowledgeRetriever.ts
      webSearch.ts

    reasoning/
      interpretFindings.ts
      generateRecommendations.ts
      validateOutput.ts
      rankFindings.ts

    knowledge/
      documents.ts
      chunking.ts
      embeddings.ts
      rag.ts

    memory/
      agentRuns.ts
      findings.ts
      recommendations.ts
      conversations.ts
      reports.ts

    prompts/
      system.ts
      interpretation.ts
      recommendations.ts
      report.ts
      presentation.ts
      actionPlan.ts

    providers/
      openai.ts
      anthropic.ts
      modelRouter.ts

    schemas/
      metrics.schema.ts
      finding.schema.ts
      recommendation.schema.ts
      agentOutput.schema.ts
      report.schema.ts
      presentation.schema.ts
      actionPlan.schema.ts

    db/
      schema.ts
      client.ts
      migrations/

    config/
      env.ts
      constants.ts
```

---

# 14. API endpoints sugeridos

```text
POST /agent/analyze-period
Genera diagnóstico automático del período.

POST /agent/ask
Responde preguntas del usuario sobre datos energéticos.

POST /agent/generate-report
Genera informe ejecutivo o técnico.

POST /agent/generate-presentation
Genera estructura de presentación.

POST /agent/generate-action-plan
Genera plan de acción a partir de hallazgos.

POST /agent/feedback
Guarda feedback del usuario sobre una recomendación o respuesta.

GET /agent/analysis/:companyId/:period
Obtiene análisis previamente generado.

GET /agent/recommendations/:companyId
Lista recomendaciones activas.
```

---

# 15. Contrato entre EnergyOS y el agente

EnergyOS debe enviar al agente un contexto limpio, no toda la base de datos.

Ejemplo de input ideal:

```json
{
  "companyId": "empresa_123",
  "period": "2026-04",
  "companyProfile": {
    "name": "Empresa X",
    "industry": "manufactura"
  },
  "metrics": {
    "totalConsumptionMwh": 1200,
    "totalCost": 185000,
    "avgCostPerMwh": 154.16,
    "costChangePct": 22,
    "consumptionChangePct": 3,
    "avgCostPerMwhChangePct": 18,
    "spotExposurePct": 34
  },
  "historicalComparison": {
    "last3MonthsAvgCostPerMwh": 132,
    "last6MonthsAvgCostPerMwh": 128
  },
  "supplyPoints": [
    {
      "name": "Planta Norte",
      "costChangePct": 31,
      "consumptionChangePct": 4,
      "impactSharePct": 43
    }
  ]
}
```

---

# 16. Limitaciones obligatorias del agente

El agente debe reconocer sus límites.

No debe:

```text
- inventar datos;
- garantizar ahorro;
- afirmar causas definitivas sin evidencia;
- tomar decisiones automáticas sin aprobación humana;
- reemplazar auditorías físicas cuando hagan falta;
- recomendar inversiones complejas sin datos técnicos;
- ocultar datos faltantes;
- usar internet como fuente principal por encima de los datos internos;
- generar confianza alta si faltan datos críticos.
```

Debe decir cosas como:

```text
Con los datos actuales puedo detectar una señal clara, pero no puedo confirmar la causa exacta sin detalle contractual.
```

---

# 17. Reglas de seguridad y calidad

## Reglas obligatorias

```text
1. Toda respuesta analítica debe incluir evidencia.
2. Toda recomendación debe tener una acción concreta.
3. Toda hipótesis debe estar marcada como hipótesis.
4. Toda respuesta importante debe incluir nivel de confianza.
5. Toda limitación relevante debe declararse.
6. No se deben prometer ahorros garantizados.
7. No se deben tomar decisiones automáticas por el cliente.
8. No se deben exponer datos de otra empresa.
9. No se deben usar datos externos sin registrar fuente.
10. No se deben mezclar hechos con interpretaciones.
```

---

# 18. UI sugerida dentro de EnergyOS

Crear sección:

```text
Inteligencia Energética
```

Pestañas:

```text
1. Diagnóstico
2. Recomendaciones
3. Preguntarle al agente
4. Informes
5. Presentaciones
6. Plan de acción
7. Historial
```

## Diagnóstico

Debe mostrar:

```text
- estado general;
- riesgo;
- resumen ejecutivo;
- hallazgos principales;
- datos usados;
- confianza;
- limitaciones.
```

## Recomendaciones

Debe mostrar:

```text
- prioridad;
- acción;
- motivo;
- evidencia;
- impacto esperado;
- estado;
- botón aceptar/rechazar/completar.
```

## Chat

Debe permitir:

```text
- escribir preguntas;
- usar preguntas sugeridas;
- opcionalmente hablar por voz;
- ver datos usados;
- ver confianza;
- generar informe desde una conversación.
```

---

# 19. Preguntas sugeridas para el chat

```text
¿Por qué subió el costo este mes?
¿Qué cambió contra el mes anterior?
¿Qué punto de suministro explica el mayor desvío?
¿Qué debería revisar primero?
¿El aumento viene por consumo o por precio?
¿Hay algo raro en los datos?
¿Qué riesgo tenemos?
¿Cómo venimos contra los últimos 6 meses?
¿Qué le digo a dirección?
¿Qué acción concreta me recomendás?
Generame un informe ejecutivo.
Generame un plan de acción.
Preparame una presentación para dirección.
```

---

# 20. Roadmap de implementación

## Fase 1 — Núcleo analítico

```text
- crear proyecto/módulo energyos-agent;
- definir schemas con Zod;
- crear Metrics Engine;
- crear Anomaly Detector;
- crear primer endpoint /agent/analyze-period;
- generar output estructurado;
- guardar agent_runs, findings y recommendations.
```

## Fase 2 — IA interpretadora

```text
- crear prompts base;
- integrar proveedor IA;
- interpretar findings;
- generar recomendaciones;
- agregar Quality Checker;
- guardar historial.
```

## Fase 3 — Chat

```text
- endpoint /agent/ask;
- usar análisis previo como contexto;
- responder preguntas sobre datos;
- guardar conversaciones y mensajes;
- agregar preguntas sugeridas.
```

## Fase 4 — Informes

```text
- endpoint /agent/generate-report;
- generar markdown/HTML;
- adaptar por audiencia;
- guardar informes.
```

## Fase 5 — Presentaciones y planes

```text
- generar estructura de slides;
- generar planes de acción;
- permitir exportación futura a PDF/PPTX.
```

## Fase 6 — RAG y conocimiento experto

```text
- crear knowledge_documents;
- crear chunks;
- embeddings;
- búsqueda por relevancia;
- playbooks de diagnóstico;
- contexto técnico en interpretación.
```

## Fase 7 — Voz

```text
- speech-to-text;
- text-to-speech;
- transcripción;
- respuestas habladas;
- resumen de conversación.
```

---

# 21. Primer MVP funcional recomendado

Para una primera versión potente, construir:

```text
1. POST /agent/analyze-period
2. Metrics Engine
3. Anomaly Detector con 12 reglas iniciales
4. Energy Interpreter con IA
5. Recommendation Engine
6. Quality Checker
7. Guardado de análisis, hallazgos y recomendaciones
8. UI de Diagnóstico
9. Chat básico usando el último análisis
10. Generador de informe ejecutivo en Markdown
```

---

# 22. Resultado esperado del MVP

El sistema debe poder analizar un período y devolver algo como:

```text
Diagnóstico:
El aumento de costo del período no parece estar explicado principalmente por mayor consumo.

Evidencia:
- Costo total: +22%.
- Consumo: +3%.
- Costo promedio por MWh: +18%.

Interpretación:
La señal apunta a deterioro del precio efectivo, mayor exposición, menor cobertura o cambio en composición de compra.

Foco:
Planta Norte debe revisarse primero porque explica el 43% del desvío total.

Recomendación:
Comparar precio efectivo contra los últimos 6 meses y revisar cobertura/exposición del período.

Confianza:
Media. Falta detalle contractual para confirmar la causa exacta.
```

---

# 23. Frase guía del producto

> EnergyOS Agent no muestra datos. Convierte datos energéticos en decisiones accionables.

---

# 24. Criterio de éxito

La primera versión se considera exitosa si puede responder bien estas 10 preguntas:

```text
1. ¿Qué pasó este mes?
2. ¿Por qué subió el costo?
3. ¿El aumento viene por consumo o por precio?
4. ¿Qué punto de suministro explica el mayor desvío?
5. ¿Qué debería revisar primero?
6. ¿Cómo venimos contra los últimos 6 meses?
7. ¿Hay algún riesgo importante?
8. ¿Qué datos faltan para confirmar el diagnóstico?
9. ¿Qué le digo a dirección?
10. ¿Qué plan de acción recomiendas?
```

Si el agente responde bien esas 10 preguntas con datos, evidencia, confianza y acciones, EnergyOS ya deja de ser un dashboard y empieza a ser una plataforma de inteligencia energética.

