import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { analyzeFxTransactions, listReports, getReport } from '../services/currencyGuard.js';
import type { FxTransaction } from '../services/currencyGuard.js';

const router = Router();
router.use(authenticate);

// POST /api/v1/addons/currency-guard/analyze
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { transactions } = req.body as { transactions: FxTransaction[] };
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ success: false, error: 'transactions array is required' });
    }
    const result = await analyzeFxTransactions(transactions);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/addons/currency-guard/reports
router.get('/reports', (_req: Request, res: Response) => {
  res.json({ success: true, data: listReports() });
});

// GET /api/v1/addons/currency-guard/reports/:id
router.get('/reports/:id', (req: Request, res: Response) => {
  const report = getReport(req.params.id);
  if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
  res.json({ success: true, data: report });
});

export default router;
