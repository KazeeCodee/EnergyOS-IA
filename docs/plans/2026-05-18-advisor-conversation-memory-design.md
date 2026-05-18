# EnergyOS Advisor Conversation And Memory Design

Fecha: 2026-05-18

## Objetivo

Aplicar un modelo tipo ChatGPT/Claude para EnergyOS Advisor: multiples chats por usuario, aislamiento estricto por `user_id + company_id + nemo + conversation_id`, historial persistente en backend y memoria estructurada reutilizable sin mezclar informacion entre clientes, usuarios o conversaciones.

El resultado esperado es que el usuario pueda abrir varios chats del mismo cliente, continuar conversaciones largas y recibir respuestas con contexto del chat correcto, mientras el agente conserva memoria util confirmada sin depender de `localStorage` ni de prompts como frontera de seguridad.

## Decision De Arquitectura

La arquitectura aprobada separa cuatro capas:

- Conversacion: mensajes de un chat especifico.
- Contexto EnergyOS: datos operativos y Data Room autorizados para el NEMO actual.
- Memoria: hechos, preferencias, decisiones y pendientes persistentes.
- Permisos: JWT Supabase, usuario autorizado y NEMO validado en cada request.

Railway Postgres sera la fuente de persistencia para conversaciones, mensajes, resumenes y memoria del Advisor. Supabase queda para autenticacion/JWT y validacion de usuario autorizado, no para guardar historial conversacional del agente.

## Principios No Negociables

1. Un chat nunca puede leer mensajes de otro `conversation_id`.
2. Un usuario nunca puede leer conversaciones de otro usuario.
3. Un NEMO nunca puede heredar contexto de otro NEMO.
4. El historial conversacional no reemplaza los datos EnergyOS.
5. La memoria no guarda suposiciones del modelo.
6. La memoria debe tener fuente y alcance.
7. El usuario debe poder borrar o archivar memoria persistente.
8. El agente debe usar historial solo cuando mejora la respuesta.
9. Las interacciones livianas no deben disparar analisis energetico.
10. La seguridad debe estar en codigo y base, no en instrucciones al LLM.

## Modelo Mental

Cada request del Advisor queda resuelto asi:

```txt
JWT del usuario
  -> validar usuario
  -> validar NEMO
  -> resolver/crear conversation_id
  -> validar ownership de conversation_id
  -> cargar resumen del chat actual
  -> cargar ultimos mensajes del chat actual
  -> cargar memoria relevante permitida
  -> si la intencion es analitica, cargar EnergyOS snapshot/Data Room
  -> responder
  -> persistir user message + assistant message
  -> actualizar titulo/resumen/memoria cuando corresponda
```

El agente no recibe todas las conversaciones del usuario. Recibe solo:

- resumen de la conversacion actual;
- ultimos mensajes de la conversacion actual;
- memoria activa con scope permitido;
- datos EnergyOS autorizados para el NEMO actual.

## Tablas Railway

### `advisor_conversations`

Representa un chat visible en la UI.

Campos principales:

- `id uuid`
- `user_id uuid`
- `company_id uuid`
- `nemo text`
- `title text`
- `status text`: `active`, `archived`, `deleted`
- `summary text`
- `summary_updated_at timestamptz`
- `last_message_at timestamptz`
- `created_at timestamptz`
- `updated_at timestamptz`

Indice clave:

- `(user_id, nemo, last_message_at desc)`
- `(user_id, id)`
- `(nemo, company_id)`

### `advisor_messages`

Representa cada mensaje del chat.

Campos principales:

- `id uuid`
- `conversation_id uuid`
- `user_id uuid`
- `company_id uuid`
- `nemo text`
- `role text`: `user`, `assistant`, `system`
- `content text`
- `intent text`
- `metadata jsonb`
- `run_id uuid`
- `created_at timestamptz`

Indice clave:

- `(conversation_id, created_at)`
- `(user_id, nemo, created_at desc)`

### `advisor_memory_items`

Representa memoria persistente y estructurada.

Campos principales:

- `id uuid`
- `scope text`: `user`, `nemo`, `conversation`
- `user_id uuid`
- `company_id uuid`
- `nemo text`
- `conversation_id uuid`
- `type text`: `preference`, `confirmed_fact`, `decision`, `open_issue`, `task_context`
- `content text`
- `confidence text`: `low`, `medium`, `high`
- `source_message_id uuid`
- `evidence jsonb`
- `status text`: `active`, `archived`, `deleted`
- `created_at timestamptz`
- `updated_at timestamptz`

Indice clave:

- `(user_id, nemo, status, updated_at desc)`
- `(conversation_id, status)`
- `(scope, type, status)`

## Endpoints

### Conversaciones

```txt
GET    /advisor/conversations?nemo=ACINVCSZ
POST   /advisor/conversations
GET    /advisor/conversations/:id/messages
PATCH  /advisor/conversations/:id
DELETE /advisor/conversations/:id
```

Reglas:

- Todos requieren JWT.
- Todos validan NEMO.
- `GET /messages` valida ownership de la conversacion.
- `DELETE` es soft delete (`status='deleted'`).

### Chat

`POST /advisor/chat` debe aceptar `conversationId` opcional.

Si no viene:

- crea conversacion.
- usa el primer mensaje como titulo provisional.

Si viene:

- valida que pertenezca al mismo usuario, empresa y NEMO.
- guarda el mensaje dentro de esa conversacion.

La respuesta debe incluir:

```ts
{
  response: string;
  conversationId: string;
  messageId: string;
  assistantMessageId: string;
  intent: string;
  ...
}
```

### Memoria

```txt
GET    /advisor/memory?nemo=ACINVCSZ
PATCH  /advisor/memory/:id
DELETE /advisor/memory/:id
```

La creacion automatica de memoria ocurre despues de una respuesta del agente, pero solo con reglas controladas. El usuario puede archivar/borrar desde la UI en una fase posterior.

## Inyeccion De Contexto Al Agente

El orchestrator recibe un `ConversationContext`:

```ts
type ConversationContext = {
  conversationId: string;
  summary: string | null;
  recentMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
    intent?: string | null;
    createdAt: string;
  }>;
  memory: Array<{
    type: string;
    content: string;
    confidence: 'low' | 'medium' | 'high';
    scope: 'user' | 'nemo' | 'conversation';
  }>;
};
```

El LLM writer puede recibir este contexto para redactar mejor, pero no puede usarlo para inventar datos operativos. Los numeros siguen viniendo del snapshot EnergyOS.

## Resumen Automatico

Cuando una conversacion supera el presupuesto de historial, se genera o actualiza `advisor_conversations.summary`.

Regla inicial:

- Mantener ultimos 12 mensajes.
- Si hay mas de 20 mensajes o mas de 8000 caracteres, resumir.
- El resumen debe preservar decisiones, pendientes, preferencias y preguntas abiertas.
- El resumen no debe incluir datos operativos como si fueran fuente de verdad; debe indicar que son parte de la conversacion.

## Memoria Persistente

La memoria se extrae con reglas conservadoras.

Guardar:

- preferencias explicitas del usuario;
- decisiones confirmadas;
- pendientes del cliente;
- hechos confirmados por el usuario;
- contexto de tarea aprobado.

No guardar:

- saludos;
- suposiciones;
- conclusiones no confirmadas;
- metricas temporales;
- datos de otro NEMO;
- informacion sensible sin fuente.

## Frontend

La pantalla `Analizador` debe dejar de depender de `localStorage` como fuente principal.

Cambios:

- cargar conversaciones desde backend;
- crear chats reales con `POST /advisor/conversations`;
- abrir chats con `GET /advisor/conversations/:id/messages`;
- enviar `conversationId` en cada `POST /advisor/chat`;
- guardar en estado local solo lo que viene del backend;
- mantener fallback local solo si la API no esta disponible;
- mostrar estado de carga por conversacion;
- impedir que un chat de un NEMO se use con otro NEMO.

## Error Handling

Casos esperados:

- `401`: sesion expirada.
- `403`: usuario no autorizado para ese NEMO.
- `404`: conversacion no existe o fue borrada.
- `409`: `conversation_id` pertenece a otro NEMO/company.
- `422`: request valido pero inconsistente.
- `500`: error inesperado.

El frontend debe mostrar errores claros y no crear mensajes locales falsos como si hubieran persistido.

## Testing

Tests obligatorios:

- usuario A no puede leer conversacion de usuario B;
- usuario A no puede usar una conversacion de otro NEMO;
- chat sin `conversationId` crea conversacion;
- chat con `conversationId` agrega mensajes al chat correcto;
- solo se cargan mensajes del chat actual;
- el resumen se actualiza cuando el chat crece;
- interaccion liviana no carga snapshot;
- analisis energetico sigue usando snapshot real;
- memoria no se crea para saludos;
- memoria se crea solo para hechos permitidos.

## Fases

1. Persistencia de conversaciones y mensajes.
2. Endpoints de conversaciones.
3. Integracion de `POST /advisor/chat` con historial persistente.
4. Frontend conectado al backend.
5. Resumen automatico.
6. Memoria persistente.
7. UI de memoria y controles de borrado.
8. Hardening, tests de aislamiento y deploy.

## Criterio De Exito

La implementacion esta completa cuando:

- un usuario puede tener varios chats por NEMO;
- cada chat recuerda su propio historial;
- ningun chat mezcla datos con otro chat;
- ningun NEMO mezcla memoria con otro NEMO;
- el agente responde mejor usando resumen e historial;
- el usuario puede borrar o archivar memoria persistente;
- las respuestas analiticas siguen fundadas en datos EnergyOS actuales;
- la seguridad no depende del prompt.
