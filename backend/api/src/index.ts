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

const app = express();

// ── Security middleware ───────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());

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

// ── Error handling ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
app.listen(config.port, () => {
  logger.info(`LogAI API running on http://localhost:${config.port}`);
  logger.info(`ML Service → ${config.mlService.url}`);
});

export default app;