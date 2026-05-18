# EnergyOS Advisor V2 Design

Fecha: 2026-05-18

## Objetivo

Construir EnergyOS Advisor V2 como un sistema experto para grandes usuarios de energia en Argentina. El usuario ve un unico asistente, pero internamente el sistema usa un orquestador, especialistas de dominio, motores deterministicos y validacion de evidencia.

El objetivo principal es eliminar el fallo actual: el modelo no puede concluir que "no hay datos" cuando Railway si tiene datos operativos para el NEMO y periodo consultado.

## Decision de arquitectura

La arquitectura aprobada es un orquestador central con especialistas internos:

- Auth + NEMO Guard.
- EnergyOS Snapshot Builder.
- Metrics Engine V2.
- Intent Router.
- Energy Analyst.
- Contract Agent.
- Invoice/DTE Agent.
- Compliance Agent.
- Document Intake Agent.
- Report Writer.
- Evidence + QA Validator.
- Task State Manager.

El LLM no es fuente de verdad. El codigo trae datos, calcula metricas, valida permisos y verifica la respuesta. El LLM interpreta, redacta, extrae informacion de documentos y prioriza acciones cuando ya existe evidencia.

## Flujo principal

1. El frontend envia `companyId`, `companyName`, `nemo`, `period`, `question`, `conversationId` y adjuntos opcionales.
2. La API valida JWT de Supabase si `REQUIRE_AGENT_AUTH=true`.
3. El guard valida que el usuario este autorizado para el NEMO.
4. El Snapshot Builder lee Railway y Data Room privado para ese NEMO/periodo.
5. Metrics Engine V2 calcula indicadores deterministicos.
6. Intent Router clasifica la tarea.
7. Orchestrator decide que especialistas ejecutar.
8. Report Writer arma la respuesta final.
9. QA Validator bloquea contradicciones antes de responder.
10. Agent Run guarda trazabilidad, datos usados, faltantes, evidencia y limitaciones.

## Fuente de verdad

Railway Postgres es la fuente operativa para datos energeticos:

- `public.cammesa_agentes_mem`
- `public.vw_consumo_gu_mensual`
- `public.vw_exposicion_spot_mensual`
- `public.vw_factura_dte_resumen_mensual`
- `public.factura_dte_conceptos_mensual`
- `public.vw_compliance_27191_mensual`
- `public.vw_factor_carga_mensual`
- `public.vw_historia_resumen_agente`
- `public.vw_mercado_resumen_mensual`
- `client_private.*`

Supabase queda para autenticacion, autorizacion y memoria del agente. No debe usarse como fuente primaria de consumo mensual, costos, exposicion, DTE o compliance.

## Energy Snapshot

Cada respuesta analitica debe partir de un snapshot compacto:

- Identidad del cliente.
- Periodo solicitado y ultimo periodo disponible.
- Consumo mensual.
- Serie historica.
- Exposicion spot.
- DTE/facturacion.
- Conceptos DTE del ultimo periodo.
- Compliance Ley 27.191.
- Factor de carga/perfil PVR.
- Mercado.
- Data Room privado.
- Disponibilidad de datos.
- Datos usados.
- Datos faltantes.
- Evidencia.
- Advertencias.

El snapshot es el contrato entre datos, calculos, agentes y respuesta.

## Especialistas

### Advisor Orchestrator

Coordina el flujo completo. No calcula a mano y no inventa datos. Decide si la respuesta puede ser deterministica o necesita LLM.

### Data Snapshot Builder

Lee Railway por NEMO y periodo. Si no existe exactamente el periodo, devuelve disponibilidad clara y ultimo periodo disponible.

### Metrics Engine V2

Calcula consumo, costo, costo por MWh, variaciones MoM/YoY, exposicion spot, cobertura MATER, DTE, compliance, brechas y riesgo.

### Energy Analyst

Interpreta consumo, costos, exposicion y tendencias.

### Contract Agent

Analiza contratos, vencimientos, cobertura, descalce, precio, estado borrador/activo y evidencia.

### Invoice/DTE Agent

Analiza factura DTE, conceptos, variaciones, importe revisable y reconciliacion.

### Compliance Agent

Analiza Ley 27.191, obligacion, brecha renovable, multa estimada y calidad de dato.

### Document Intake Agent

Procesa PDF, imagenes, DOCX, XLSX y CSV. Los documentos sirven como evidencia y como fuente para generar campos estructurados borrador. No activan datos finales sin validacion.

### Report Writer

Redacta respuesta ejecutiva, tecnica, plan de accion o reporte.

### Evidence + QA Validator

Bloquea respuestas que:

- Dicen que no hay datos cuando el snapshot tiene datos.
- Mencionan valores que no aparecen en evidencia.
- Mezclan NEMOs o clientes.
- Inventan contratos, facturas o precios.
- No declaran limitaciones relevantes.

## Concurrencia

Cada request queda aislado por:

- `userId`
- `companyId`
- `nemo`
- `period`
- `conversationId`
- `runId`

No hay memoria global compartida entre clientes. Varios usuarios pueden usar el agente al mismo tiempo porque cada run trabaja con su propio snapshot y contexto.

## Archivos

El frontend puede adjuntar archivos, pero V2 debe aceptarlos y procesarlos realmente en backend:

- PDF: Gemini document/vision y extraccion estructurada.
- Imagenes: Gemini vision.
- DOCX: parser de texto y estructura.
- XLSX/CSV: parser deterministico antes de IA.
- DTE/facturas: normalizar a `invoice_imports` e `invoice_lines`.
- Contratos: generar borrador estructurado, no contrato activo automatico.

Cada archivo debe tener checksum, tipo, nombre, tamano, resultado de extraccion, confianza y evidencia vinculable.

## API objetivo

- `POST /advisor/chat`
- `POST /advisor/analyze-period`
- `POST /advisor/generate-report`
- `POST /advisor/reconcile`
- `POST /advisor/files/analyze`
- `GET /advisor/snapshot?nemo=...&period=...`
- `GET /advisor/conversations`
- `GET /advisor/conversations/:id`
- `GET /advisor/runs/:id`

Los endpoints legacy `/agent/*` quedan como compatibilidad mientras el frontend migra.

## Criterios de exito

- Para un NEMO/periodo con datos en Railway, el agente nunca responde que no hay datos del periodo.
- La respuesta menciona la empresa autorizada, no pide elegir cliente.
- Cada respuesta incluye datos usados y limitaciones.
- Los calculos salen de codigo deterministico.
- Los adjuntos llegan al backend y se clasifican.
- El build TypeScript pasa.
- Hay tests para snapshot, router, metricas, QA y archivos.

