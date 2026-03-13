import { Router } from 'express';
import { analyze, getAccountAnomalies, trainModel } from '../controllers/inferenceController';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/errorHandler';
import { analyzeSchema } from '../schemas/validation';

const router = Router();

// All inference routes require authentication
router.use(authenticate);

// POST /api/v1/inference/analyze
router.post('/analyze', validate(analyzeSchema), analyze);

// GET /api/v1/inference/anomalies/:accountId
router.get('/anomalies/:accountId', getAccountAnomalies);

// POST /api/v1/inference/train  (admin/analyst only)
router.post('/train', requireRole('admin', 'analyst'), trainModel);

export default router;