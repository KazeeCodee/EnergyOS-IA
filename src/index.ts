import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { env } from './config/env.js';
import analyzePeriodApi from './api/analyze-period.js';
import feedbackApi from './api/feedback.js';
import historyApi from './api/history.js';
import askApi from './api/ask.js';
import generateReportApi from './api/generate-report.js';
import generateActionPlanApi from './api/generate-action-plan.js';
import reconcileInvoiceApi from './api/reconcile-invoice.js';
import advisorChatApi from './api/advisor-chat.js';
import advisorSnapshotApi from './api/advisor-snapshot.js';

const app = new Hono();

// ─── Middleware ─────────────────────────────────────────────────────────────

app.use('*', cors({
  origin: '*',
  allowHeaders: ['Authorization', 'Content-Type', 'X-Client-Info'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
}));

app.use('*', logger());

// ─── Health check ──────────────────────────────────────────────────────────

app.get('/', (c) => {
  return c.json({
    name: 'EnergyOS Data Analyst Agent',
    version: '0.1.0',
    status: 'running',
    phase: 1,
    description: 'Núcleo analítico: métricas, detección de anomalías y recomendaciones determinísticas.',
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API Routes ────────────────────────────────────────────────────────────

app.route('/agent/analyze-period', analyzePeriodApi);
app.route('/agent/ask', askApi);
app.route('/agent/generate-report', generateReportApi);
app.route('/agent/generate-action-plan', generateActionPlanApi);
app.route('/agent/reconcile-invoice', reconcileInvoiceApi);
app.route('/agent/feedback', feedbackApi);
app.route('/agent', historyApi);
app.route('/advisor/chat', advisorChatApi);
app.route('/advisor/snapshot', advisorSnapshotApi);

// ─── Start server ──────────────────────────────────────────────────────────

console.log(`
┌─────────────────────────────────────────────────┐
│  EnergyOS Data Analyst Agent                    │
│  Fase 1 — Núcleo analítico                      │
│  Puerto: ${env.PORT}                                  │
│                                                 │
│  Endpoints:                                     │
│  POST /agent/analyze-period                     │
│  POST /agent/feedback                           │
│  GET  /agent/analysis/:companyId/:period        │
│  GET  /agent/recommendations/:companyId         │
│  GET  /health                                   │
└─────────────────────────────────────────────────┘
`);

serve({
  fetch: app.fetch,
  port: env.PORT,
});
