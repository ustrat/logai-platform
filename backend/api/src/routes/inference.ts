import { Router } from 'express';
import { analyze, getAccountAnomalies, trainModel } from '../controllers/inferenceController';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/errorHandler';
import { analyzeSchema } from '../schemas/validation';
import { mlClient } from '../services/mlClient';

const router = Router();
router.use(authenticate);

router.post('/analyze', validate(analyzeSchema), analyze);
router.get('/anomalies/:accountId', getAccountAnomalies);
router.post('/train', requireRole('admin', 'analyst'), trainModel);

// New endpoints — proxy to ML service
router.get('/accounts', async (_req, res) => {
  try {
    const data = await mlClient.getAccounts();
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/summary', async (_req, res) => {
  try {
    const data = await mlClient.getSummary();
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/reload', async (_req, res) => {
  try {
    const data = await mlClient.reload();
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;