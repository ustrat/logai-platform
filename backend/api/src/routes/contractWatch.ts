import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { monitorContract, listContracts, getContract, refreshAllContracts } from '../services/contractWatch.js';
import type { ContractInput } from '../services/contractWatch.js';

const router = Router();
router.use(authenticate);

// POST /api/v1/addons/contract-watch/monitor
router.post('/monitor', async (req: Request, res: Response) => {
  try {
    const input = req.body as ContractInput;
    if (!input.vendor || !input.endDate) {
      return res.status(400).json({ success: false, error: 'vendor and endDate are required' });
    }
    if (typeof input.noticePeriodDays !== 'number') input.noticePeriodDays = 30;
    if (typeof input.autoRenew !== 'boolean') input.autoRenew = false;
    if (!input.startDate) input.startDate = new Date().toISOString();
    const result = await monitorContract(input);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/addons/contract-watch/contracts
router.get('/contracts', (_req: Request, res: Response) => {
  res.json({ success: true, data: listContracts() });
});

// GET /api/v1/addons/contract-watch/contracts/:id
router.get('/contracts/:id', (req: Request, res: Response) => {
  const contract = getContract(req.params.id);
  if (!contract) return res.status(404).json({ success: false, error: 'Contract not found' });
  res.json({ success: true, data: contract });
});

// POST /api/v1/addons/contract-watch/refresh
router.post('/refresh', async (_req: Request, res: Response) => {
  try {
    const contracts = await refreshAllContracts();
    res.json({ success: true, data: contracts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
