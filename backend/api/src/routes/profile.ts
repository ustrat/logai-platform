import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { profileStore, NOTIFICATION_DEFAULTS } from '../lib/profileStore';

const router = Router();
router.use(authenticate);

// GET /api/v1/profile
router.get('/', async (req: Request, res: Response) => {
  const { userId, email } = req.user!;
  const stored = await profileStore.getProfile(userId);

  if (stored) {
    res.json({ success: true, data: stored });
    return;
  }

  // Derive defaults from email
  const local = email.split('@')[0];
  const parts = local.split('.');
  res.json({
    success: true,
    data: {
      userId,
      firstName: parts[0] || local,
      lastName:  parts[1] || '',
      email,
      updatedAt: null,
    },
  });
});

// PUT /api/v1/profile
router.put('/', async (req: Request, res: Response) => {
  const { userId, email } = req.user!;
  const { firstName = '', lastName = '' } = req.body as { firstName?: string; lastName?: string };

  await profileStore.saveProfile({
    userId,
    firstName: String(firstName).trim(),
    lastName:  String(lastName).trim(),
    email,
    updatedAt: new Date().toISOString(),
  });
  res.json({ success: true });
});

// GET /api/v1/profile/notifications
router.get('/notifications', async (req: Request, res: Response) => {
  const stored = await profileStore.getNotifications(req.user!.userId);
  // Merge stored over defaults so newly added products default to true
  const data = stored ? { ...NOTIFICATION_DEFAULTS, ...stored } : { ...NOTIFICATION_DEFAULTS };
  res.json({ success: true, data });
});

// PUT /api/v1/profile/notifications
router.put('/notifications', async (req: Request, res: Response) => {
  const { userId } = req.user!;
  const { preferences } = req.body as { preferences?: Record<string, boolean> };

  if (!preferences || typeof preferences !== 'object') {
    res.status(400).json({ success: false, error: 'preferences object is required' });
    return;
  }
  await profileStore.saveNotifications(userId, preferences);
  res.json({ success: true });
});

export default router;
