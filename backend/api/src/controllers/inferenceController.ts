import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { mlClient } from '../services/mlClient';
import { plaidService } from '../services/plaidService';
import { getPlaidToken } from '../lib/plaidStore';
import { ApiResponse } from '../schemas/types';
import { logger } from '../config/logger';
import { logEvent } from '../lib/dynamoLogger';

async function fetchPlaidTransactions(userId: string): Promise<any[] | null> {
  const entry = await getPlaidToken(userId);
  if (!entry) return null;
  try {
    const end = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    const start = startDate.toISOString().split('T')[0];
    const data = await plaidService.getTransactions(entry.accessToken, start, end, 500);
    return data.transactions ?? [];
  } catch (err: any) {
    logger.warn(`[inference] Plaid fetch failed: ${err.message}`);
    return null;
  }
}

export async function analyze(req: Request, res: Response): Promise<void> {
  const inferenceId = randomUUID();
  const userId      = req.user?.userId ?? 'anonymous';
  const accountId   = req.body?.account_id ?? 'ALL';

  try {
    const plaidTxns = await fetchPlaidTransactions(userId);
    const payload   = plaidTxns
      ? { ...req.body, transactions: plaidTxns }
      : req.body;

    if (!plaidTxns) {
      logger.info(`[inference] No Plaid data for ${userId} — using CSV fallback`);
    } else {
      logger.info(`[inference] Running on ${plaidTxns.length} Plaid transactions for ${userId}`);
    }

    const result = await mlClient.analyze(payload);

    const anomalyCount = (result.anomalies ?? []).filter((a: any) => a.is_anomaly).length;
    const scores: number[] = (result.anomalies ?? []).map((a: any) => a.anomaly_score ?? 0);
    const topScore    = scores.length ? Math.max(...scores) : 0;
    const topSeverity = topScore > 0.8 ? 'critical' : topScore > 0.5 ? 'high' : topScore > 0.2 ? 'medium' : 'low';

    logEvent(
      'ml-inference',
      `USER#${userId}`,
      `ANALYZE#${new Date().toISOString()}`,
      {
        inferenceId,
        userId,
        accountId,
        eventType:            'analyze',
        dataSource:           plaidTxns ? 'plaid' : 'csv',
        transactionsAnalyzed: result.transactions_analyzed ?? 0,
        anomalyCount,
        patternCount:         (result.patterns ?? []).length,
        topSeverity,
        modelVersion:         result.model_version ?? 'unknown',
      },
    ).catch(err => logger.error(`[dynamo] ml-inference log failed: ${err.message}`));

    res.json({ success: true, data: result } as ApiResponse);
  } catch (err: any) {
    logger.error(`analyze error: ${err.message}`);
    res.status(502).json({ success: false, error: err.message } as ApiResponse);
  }
}

export async function getAccountAnomalies(req: Request, res: Response): Promise<void> {
  const userId    = req.user?.userId ?? 'anonymous';
  const accountId = req.params.accountId;

  try {
    const result = await mlClient.getAccountAnomalies(accountId, parseInt(req.query.limit as string) || 100);

    logEvent(
      'ml-inference',
      `USER#${userId}`,
      `ANOMALIES#${new Date().toISOString()}`,
      {
        inferenceId:  randomUUID(),
        userId,
        accountId,
        eventType:    'anomaly_query',
        flaggedCount: result.flagged_count ?? 0,
        topSeverity:  'unknown',
        modelVersion: 'unknown',
      },
    ).catch(err => logger.error(`[dynamo] ml-inference log failed: ${err.message}`));

    res.json({ success: true, data: result } as ApiResponse);
  } catch (err: any) {
    logger.error(`anomalies error: ${err.message}`);
    res.status(502).json({ success: false, error: err.message } as ApiResponse);
  }
}

export async function trainModel(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId ?? 'anonymous';

  try {
    const result = await mlClient.trainModel(parseInt(req.query.days as string) || 90);

    logEvent(
      'ml-inference',
      `TRAIN#${result.model_version ?? 'unknown'}`,
      `EVENT#${new Date().toISOString()}`,
      {
        inferenceId:  randomUUID(),
        userId,
        eventType:    'train',
        samples:      result.samples ?? 0,
        modelVersion: result.model_version ?? 'unknown',
        topSeverity:  'none',
      },
    ).catch(err => logger.error(`[dynamo] ml-inference log failed: ${err.message}`));

    res.json({ success: true, data: result, message: 'Model training started' } as ApiResponse);
  } catch (err: any) {
    logger.error(`train error: ${err.message}`);
    res.status(502).json({ success: false, error: err.message } as ApiResponse);
  }
}
