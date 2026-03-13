import { Router } from 'express';
import { register, login, me } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/errorHandler';
import { registerSchema, loginSchema } from '../schemas/validation';

const router = Router();

// POST /api/v1/auth/register
router.post('/register', validate(registerSchema), register);

// POST /api/v1/auth/login
router.post('/login', validate(loginSchema), login);

// GET /api/v1/auth/me  (protected)
router.get('/me', authenticate, me);

export default router;