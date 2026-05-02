import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { normalizeTaxLines, listReports, getReport } from '../services/taxNormalizer.js';
import type { TaxLineItem } from '../services/taxNormalizer.js';

const router = Router();
router.use(authenticate);

// POST /api/v1/addons/tax-normalizer/normalize
router.post('/normalize', async (req: Request, res: Response) => {
  try {
    const { lines } = req.body as { lines: TaxLineItem[] };
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ success: false, error: 'lines array is required' });
    }
    const result = await normalizeTaxLines(lines);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/addons/tax-normalizer/reports
router.get('/reports', (_req: Request, res: Response) => {
  res.json({ success: true, data: listReports() });
});

// GET /api/v1/addons/tax-normalizer/reports/:id
router.get('/reports/:id', (req: Request, res: Response) => {
  const report = getReport(req.params.id);
  if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
  res.json({ success: true, data: report });
});

export default router;
