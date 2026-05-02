import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { generateDraft, refineDraft, listDrafts } from '../services/autoDraft.js';
import type { DraftRequest } from '../services/autoDraft.js';

const router = Router();
router.use(authenticate);

// POST /api/v1/addons/auto-draft/generate
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const draftReq = req.body as DraftRequest;
    if (!draftReq.context || !draftReq.recipient || !draftReq.senderName) {
      return res.status(400).json({ success: false, error: 'context, recipient, and senderName are required' });
    }
    if (!draftReq.type) draftReq.type = 'follow_up';
    if (!draftReq.tone) draftReq.tone = 'professional';
    const result = await generateDraft(draftReq);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/addons/auto-draft/refine/:id
router.post('/refine/:id', async (req: Request, res: Response) => {
  try {
    const { feedback } = req.body as { feedback: string };
    if (!feedback) return res.status(400).json({ success: false, error: 'feedback is required' });
    const result = await refineDraft(req.params.id, feedback);
    res.json({ success: true, data: result });
  } catch (err: any) {
    if (err.message?.includes('not found')) return res.status(404).json({ success: false, error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/addons/auto-draft/history
router.get('/history', (_req: Request, res: Response) => {
  res.json({ success: true, data: listDrafts() });
});

export default router;
