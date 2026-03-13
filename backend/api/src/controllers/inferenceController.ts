import { Request, Response } from 'express';
import { mlClient } from '../services/mlclient';
import { ApiResponse } from '../schemas/types';
import { logger } from '../config/logger';

export async function analyze(req: Request, res: Response): Promise<void> {
  try {
    const result = await mlClient.analyze(req.body);
    res.json({ success: true, data: result } as ApiResponse);
  } catch (err: any) {
    logger.error(`analyze error: ${err.message}`);
    res.status(502).json({ success: false, error: err.message } as ApiResponse);
  }
}

export async function getAccountAnomalies(req: Request, res: Response): Promise<void> {
  try {
    const { accountId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const result = await mlClient.getAccountAnomalies(accountId, limit);
    res.json({ success: true, data: result } as ApiResponse);
  } catch (err: any) {
    logger.error(`anomalies error: ${err.message}`);
    res.status(502).json({ success: false, error: err.message } as ApiResponse);
  }
}

export async function trainModel(req: Request, res: Response): Promise<void> {
  try {
    const days = parseInt(req.query.days as string) || 90;
    const result = await mlClient.trainModel(days);
    res.json({ success: true, data: result, message: 'Model training started' } as ApiResponse);
  } catch (err: any) {
    logger.error(`train error: ${err.message}`);
    res.status(502).json({ success: false, error: err.message } as ApiResponse);
  }
}