import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { analyzeSpend, listReports, getReport } from '../services/spendAnalyzer.js';
import type { SpendRecord } from '../services/spendAnalyzer.js';

const router = Router();
router.use(authenticate);

// POST /api/v1/addons/spend-analyzer/analyze
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { records, currency } = req.body as { records: SpendRecord[]; currency?: string };
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, error: 'records array is required' });
    }
    const result = await analyzeSpend(records, currency);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/addons/spend-analyzer/reports
router.get('/reports', (_req: Request, res: Response) => {
  res.json({ success: true, data: listReports() });
});

// GET /api/v1/addons/spend-analyzer/reports/:id
router.get('/reports/:id', (req: Request, res: Response) => {
  const report = getReport(req.params.id);
  if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
  res.json({ success: true, data: report });
});

export default router;
