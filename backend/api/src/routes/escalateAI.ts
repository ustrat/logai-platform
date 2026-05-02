import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  initiateEscalation, advanceTier, draftEscalationCommunication,
  resolveEscalation, listEscalations, getEscalation,
} from '../services/escalateAI.js';
import type { EscalationInput, EscalationOutcome } from '../services/escalateAI.js';

const router = Router();
router.use(authenticate);

// POST /api/v1/addons/escalate-ai/initiate
router.post('/initiate', async (req: Request, res: Response) => {
  try {
    const input = req.body as EscalationInput;
    if (!input.vendor || !input.description || typeof input.amountAtStake !== 'number') {
      return res.status(400).json({ success: false, error: 'vendor, description, and amountAtStake are required' });
    }
    if (!input.type) input.type = 'refund_dispute';
    if (!input.triggeredBy) input.triggeredBy = 'manual';
    if (!input.actor) input.actor = (req as any).user?.email ?? 'system';
    const result = await initiateEscalation(input);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/addons/escalate-ai/escalations
router.get('/escalations', (_req: Request, res: Response) => {
  res.json({ success: true, data: listEscalations() });
});

// GET /api/v1/addons/escalate-ai/escalations/:id
router.get('/escalations/:id', (req: Request, res: Response) => {
  const e = getEscalation(req.params.id);
  if (!e) return res.status(404).json({ success: false, error: 'Escalation not found' });
  res.json({ success: true, data: e });
});

// PUT /api/v1/addons/escalate-ai/escalations/:id/advance
router.put('/escalations/:id/advance', (req: Request, res: Response) => {
  const { note } = req.body as { note?: string };
  const actor = (req as any).user?.email ?? 'system';
  const e = advanceTier(req.params.id, actor, note ?? 'Advancing to next escalation tier.');
  if (!e) return res.status(404).json({ success: false, error: 'Escalation not found or already at max tier' });
  res.json({ success: true, data: e });
});

// POST /api/v1/addons/escalate-ai/escalations/:id/draft
router.post('/escalations/:id/draft', async (req: Request, res: Response) => {
  try {
    const result = await draftEscalationCommunication(req.params.id);
    if (!result) return res.status(404).json({ success: false, error: 'Escalation not found' });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/addons/escalate-ai/escalations/:id/resolve
router.put('/escalations/:id/resolve', (req: Request, res: Response) => {
  const { outcome, note } = req.body as { outcome: EscalationOutcome; note: string };
  if (!outcome) return res.status(400).json({ success: false, error: 'outcome is required' });
  const actor = (req as any).user?.email ?? 'system';
  const e = resolveEscalation(req.params.id, outcome, note ?? '', actor);
  if (!e) return res.status(404).json({ success: false, error: 'Escalation not found' });
  res.json({ success: true, data: e });
});

export default router;
