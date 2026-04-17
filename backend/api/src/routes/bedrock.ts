import { Router, type Request, type Response } from 'express';
import { analyzeEmailSignals }    from '../services/emailSignalBedrock.js';
import { explainAnomalies }        from '../services/anomalyExplainer.js';
import { analyzeSubscriptions }    from '../services/subscriptionAnalyzer.js';
import { assist, assistStream }    from '../services/enterpriseAssistant.js';

const router = Router();

// ── GET /api/v1/bedrock/status ────────────────────────────────────────────────
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    status:  'ok',
    region:  process.env.AWS_REGION ?? 'us-east-1',
    models: {
      sonnet: process.env.BEDROCK_SONNET_MODEL_ID ?? 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      haiku:  process.env.BEDROCK_HAIKU_MODEL_ID  ?? 'anthropic.claude-3-5-haiku-20241022-v1:0',
    },
  });
});

// ── POST /api/v1/bedrock/email-signals ────────────────────────────────────────
// Analyze a single email for product signals across all 7 ValuePilot products.
// Body: { subject: string, from: string, body: string }
router.post('/email-signals', async (req: Request, res: Response) => {
  const { subject, from, body } = req.body as {
    subject?: string;
    from?:    string;
    body?:    string;
  };

  if (!subject || !from || !body) {
    return res.status(400).json({ error: 'subject, from, and body are required' });
  }

  try {
    const result = await analyzeEmailSignals(subject, from, body);
    res.json(result);
  } catch (err: any) {
    console.error('[bedrock/email-signals]', err);
    res.status(500).json({ error: 'Bedrock inference failed', detail: err.message });
  }
});

// ── POST /api/v1/bedrock/anomaly-explain ──────────────────────────────────────
// Generate plain-English explanation of ML anomaly detection results.
// Body: { accountId, anomalies, recommendations, transactions }
router.post('/anomaly-explain', async (req: Request, res: Response) => {
  const { accountId, anomalies, recommendations, transactions } = req.body;

  if (!accountId || !anomalies || !recommendations) {
    return res.status(400).json({ error: 'accountId, anomalies, and recommendations are required' });
  }

  try {
    const result = await explainAnomalies(anomalies, recommendations, transactions ?? [], accountId);
    res.json(result);
  } catch (err: any) {
    console.error('[bedrock/anomaly-explain]', err);
    res.status(500).json({ error: 'Bedrock inference failed', detail: err.message });
  }
});

// ── POST /api/v1/bedrock/subscription-analyze ─────────────────────────────────
// Deep analysis of a user's detected subscription portfolio.
// Body: { userId, subscriptions: DetectedSubscription[] }
router.post('/subscription-analyze', async (req: Request, res: Response) => {
  const { userId, subscriptions } = req.body;

  if (!userId || !Array.isArray(subscriptions) || subscriptions.length === 0) {
    return res.status(400).json({ error: 'userId and a non-empty subscriptions array are required' });
  }

  try {
    const result = await analyzeSubscriptions(subscriptions, userId);
    res.json(result);
  } catch (err: any) {
    console.error('[bedrock/subscription-analyze]', err);
    res.status(500).json({ error: 'Bedrock inference failed', detail: err.message });
  }
});

// ── POST /api/v1/bedrock/enterprise/assist ────────────────────────────────────
// Enterprise sales assistant — non-streaming JSON response.
// Body: { task, context, instruction? }
router.post('/enterprise/assist', async (req: Request, res: Response) => {
  const { task, context, instruction } = req.body;

  if (!task || !context) {
    return res.status(400).json({ error: 'task and context are required' });
  }

  try {
    const result = await assist({ task, context, instruction });
    res.json(result);
  } catch (err: any) {
    console.error('[bedrock/enterprise/assist]', err);
    res.status(500).json({ error: 'Bedrock inference failed', detail: err.message });
  }
});

// ── POST /api/v1/bedrock/enterprise/assist/stream ─────────────────────────────
// Enterprise sales assistant — Server-Sent Events streaming response.
// Body: { task, context, instruction? }
router.post('/enterprise/assist/stream', async (req: Request, res: Response) => {
  const { task, context, instruction } = req.body;

  if (!task || !context) {
    return res.status(400).json({ error: 'task and context are required' });
  }

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  try {
    for await (const chunk of assistStream({ task, context, instruction })) {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
  } catch (err: any) {
    console.error('[bedrock/enterprise/assist/stream]', err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
