import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  getUserEntitlements,
  getEntitlement,
  checkEntitlement,
  grantEntitlement,
  revokeEntitlement,
  getActiveSubscription,
  upsertSubscription,
  getPlanFeatures,
  seedCatalog,
  getEntitlementVersion,
  incrementEntitlementVersion,
} from '../lib/entitlementService';

const router = Router();
router.use(authenticate);

// ── GET /api/v1/entitlements/me ───────────────────────────────────────────
// Returns all entitlements for the current user
router.get('/me', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const [entitlements, version] = await Promise.all([
      getUserEntitlements(userId),
      getEntitlementVersion(userId),
    ]);
    res.json({ success: true, data: { entitlements, version } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/v1/entitlements/check/:featureKey ────────────────────────────
// Fast feature gate — used by the frontend before rendering a feature
router.get('/check/:featureKey', async (req: Request, res: Response) => {
  try {
    const allowed = await checkEntitlement(req.user!.userId, req.params.featureKey);
    res.json({ success: true, data: { allowed, featureKey: req.params.featureKey } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/v1/entitlements/version ─────────────────────────────────────
// Returns the current entitlements_version for the token refresh check
router.get('/version', async (req: Request, res: Response) => {
  try {
    const version = await getEntitlementVersion(req.user!.userId);
    res.json({ success: true, data: { version } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/v1/entitlements/subscription ────────────────────────────────
// Returns active subscription for the current tenant
router.get('/subscription', async (req: Request, res: Response) => {
  try {
    const sub = await getActiveSubscription(req.user!.userId);
    res.json({ success: true, data: { subscription: sub } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/v1/entitlements/grant — admin only ──────────────────────────
// Manually grant an entitlement (comp account, trial, support override)
router.post('/grant', requireRole('admin'), async (req: Request, res: Response) => {
  const { userId, tenantId, featureKey, limit, expiresAt, source } = req.body;
  if (!userId || !featureKey) {
    return res.status(400).json({ success: false, error: 'userId and featureKey are required' });
  }
  try {
    await grantEntitlement({
      userId,
      tenantId:   tenantId || userId,
      featureKey,
      status:     'active',
      limit:      limit ?? undefined,
      used:       0,
      source:     source || 'grant',
      expiresAt:  expiresAt ?? undefined,
    });
    res.json({ success: true, data: { granted: true } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/v1/entitlements/revoke — admin only ──────────────────────
router.delete('/revoke', requireRole('admin'), async (req: Request, res: Response) => {
  const { userId, featureKey } = req.body;
  if (!userId || !featureKey) {
    return res.status(400).json({ success: false, error: 'userId and featureKey are required' });
  }
  try {
    await revokeEntitlement(userId, featureKey, req.user!.userId);
    res.json({ success: true, data: { revoked: true } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/v1/entitlements/subscription — admin only ──────────────────
// Upsert a subscription (normally driven by Stripe webhook)
router.post('/subscription', requireRole('admin'), async (req: Request, res: Response) => {
  const { tenantId, planId, status, stripeSubId, currentPeriodEnd } = req.body;
  if (!tenantId || !planId || !status) {
    return res.status(400).json({ success: false, error: 'tenantId, planId, and status are required' });
  }
  try {
    await upsertSubscription({ tenantId, planId, status, stripeSubId, currentPeriodEnd, createdAt: '', updatedAt: '' });
    // When subscription changes, provision entitlements for all plan features
    const features = await getPlanFeatures(planId);
    await Promise.all(features.map(f =>
      grantEntitlement({
        userId: tenantId, tenantId, featureKey: f,
        status: status === 'active' || status === 'trialing' ? 'active' : 'suspended',
        source: 'subscription', sourceId: stripeSubId,
      })
    ));
    res.json({ success: true, data: { provisioned: features.length } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/v1/entitlements/catalog/:planId ─────────────────────────────
router.get('/catalog/:planId', async (req: Request, res: Response) => {
  try {
    const features = await getPlanFeatures(req.params.planId);
    res.json({ success: true, data: { planId: req.params.planId, features } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/v1/entitlements/catalog/seed — admin only ──────────────────
// Seeds the catalog with the default free/pro/enterprise plan definitions
router.post('/catalog/seed', requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    await seedCatalog();
    res.json({ success: true, data: { seeded: true } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
