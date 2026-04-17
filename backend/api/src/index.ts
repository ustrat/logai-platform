import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './config/logger';
import { errorHandler, notFound } from './middleware/errorHandler';
import { mlClient } from './services/mlClient';
import authRoutes from './routes/auth';
import inferenceRoutes from './routes/inference';
import plaidRoutes from './routes/plaid';
import subscriptionRoutes from './routes/subscriptions';
import paymentsRoutes from './routes/payments';
import partnerPortalRoutes from './routes/partnerPortal';
import enterpriseRoutes from './routes/enterprise';
import emailIntelRoutes from './routes/emailIntel';
import bedrockRoutes from './routes/bedrock';
import { startEmailBackgroundService } from './services/emailBackground';


const app = express();

// ── Security middleware ───────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());  // ← must come first
app.use(rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { success: false, error: 'Too many requests, please slow down.' },
}));

// ── Routes ────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const mlHealthy = await mlClient.healthCheck();
  res.json({
    status: 'ok',
    service: 'logai-api',
    mlService: mlHealthy ? 'connected' : 'unreachable',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/inference', inferenceRoutes);
app.use('/api/v1/plaid', plaidRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);
app.use('/api/v1/payments', paymentsRoutes);
app.use('/api/v1/partner', partnerPortalRoutes);
app.use('/api/v1/enterprise', enterpriseRoutes);
app.use('/api/v1/email-intel', emailIntelRoutes);
app.use('/api/v1/bedrock', bedrockRoutes);

// ── Error handling ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
app.listen(config.port, () => {
  logger.info(`LogAI API running on http://localhost:${config.port}`);
  logger.info(`ML Service → ${config.mlService.url}`);

  // Start background email intelligence service (non-blocking)
  startEmailBackgroundService();
});

export default app;