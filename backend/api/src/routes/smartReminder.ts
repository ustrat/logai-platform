import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { analyzeCommitments, listReminders, dismissReminder, snoozeReminder } from '../services/smartReminder.js';
import type { Commitment } from '../services/smartReminder.js';

const router = Router();
router.use(authenticate);

// POST /api/v1/addons/smart-reminder/analyze
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { commitments } = req.body as { commitments: Commitment[] };
    if (!Array.isArray(commitments) || commitments.length === 0) {
      return res.status(400).json({ success: false, error: 'commitments array is required' });
    }
    const userId = (req as any).user?.id ?? 'unknown';
    const result = await analyzeCommitments(commitments, userId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/addons/smart-reminder/reminders
router.get('/reminders', (_req: Request, res: Response) => {
  res.json({ success: true, data: listReminders() });
});

// PUT /api/v1/addons/smart-reminder/reminders/:id/dismiss
router.put('/reminders/:id/dismiss', (req: Request, res: Response) => {
  const ok = dismissReminder(req.params.id);
  if (!ok) return res.status(404).json({ success: false, error: 'Reminder not found' });
  res.json({ success: true });
});

// POST /api/v1/addons/smart-reminder/reminders/:id/snooze
router.post('/reminders/:id/snooze', (req: Request, res: Response) => {
  const { until } = req.body as { until: string };
  if (!until) return res.status(400).json({ success: false, error: 'until (ISO datetime) is required' });
  const ok = snoozeReminder(req.params.id, until);
  if (!ok) return res.status(404).json({ success: false, error: 'Reminder not found' });
  res.json({ success: true });
});

export default router;
