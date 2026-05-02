import { Router, Request, Response } from 'express';
import { register, login, refresh, logout, me } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/errorHandler';
import { registerSchema, loginSchema } from '../schemas/validation';
import { logEvent } from '../lib/dynamoLogger';

const router = Router();

// POST /api/v1/auth/register
router.post('/register', validate(registerSchema), register);

// POST /api/v1/auth/login
router.post('/login', validate(loginSchema), login);

// POST /api/v1/auth/refresh  — exchange a valid refresh token for a new token pair
router.post('/refresh', refresh);

// POST /api/v1/auth/logout   — revoke refresh token(s); optionally requires auth for allDevices
router.post('/logout', logout);

// GET  /api/v1/auth/me  (protected)
router.get('/me', authenticate, me);

// POST /api/v1/auth/session — called by frontend after Cognito login to record the event
router.post('/session', authenticate, async (req: Request, res: Response) => {
  const user = req.user!;
  const ip   = req.headers['x-forwarded-for']?.toString().split(',')[0].trim()
             || req.socket.remoteAddress
             || 'unknown';
  try {
    await logEvent(
      'users',
      `USER#${user.userId}`,
      `EVENT#${new Date().toISOString()}`,
      {
        eventType: 'login',
        email:     user.email,
        role:      user.role,
        ip,
        userAgent: req.headers['user-agent'] || 'unknown',
      },
    );
    res.json({ success: true });
  } catch (err: any) {
    // Non-fatal — log the error but don't fail the session
    console.error('[session] DynamoDB write failed:', err.message);
    res.json({ success: true });
  }
});

export default router;
