import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  getAllProducts,
  getProduct,
  seedPriceBook,
  syncAllToStripe,
  resolveStripePriceId,
  DEFAULT_PRODUCTS,
} from '../lib/catalogService';

const router = Router();

// ── GET /api/v1/catalog/products ──────────────────────────────────────────
// Public-ish — returns price book from DynamoDB (no Stripe IDs exposed)
router.get('/products', authenticate, async (_req: Request, res: Response) => {
  try {
    const products = await getAllProducts();

    // Strip internal Stripe IDs before returning to frontend
    const safe = products.map(p => ({
      productKey:  p.productKey,
      name:        p.name,
      description: p.description,
      tagline:     p.tagline,
      category:    p.category,
      sortOrder:   p.sortOrder,
      featureKeys: p.featureKeys,
      features:    p.features ?? [],
      prices:      {
        monthly: p.prices.monthly ?? null,
        annual:  p.prices.annual  ?? null,
      },
      hasStripeSync: !!(p.stripeProductId),
    }));

    res.json({ success: true, data: { products: safe } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/v1/catalog/products/:productKey ──────────────────────────────
router.get('/products/:productKey', authenticate, async (req: Request, res: Response) => {
  try {
    const product = await getProduct(req.params.productKey);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, data: { product } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/v1/catalog/defaults ─────────────────────────────────────────
// Returns the hardcoded defaults (useful for admin preview before seeding)
router.get('/defaults', authenticate, requireRole('admin'), (_req: Request, res: Response) => {
  res.json({ success: true, data: { products: DEFAULT_PRODUCTS, count: DEFAULT_PRODUCTS.length } });
});

// ── POST /api/v1/catalog/seed — admin only ────────────────────────────────
// Writes the DEFAULT_PRODUCTS into DynamoDB (idempotent)
router.post('/seed', authenticate, requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const count = await seedPriceBook();
    res.json({ success: true, data: { seeded: count, message: `Seeded ${count} products into DynamoDB catalog` } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/v1/catalog/sync-stripe — admin only ────────────────────────
// Creates/updates products + prices in Stripe and stores Stripe IDs back in DynamoDB
router.post('/sync-stripe', authenticate, requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const result = await syncAllToStripe();
    res.json({
      success: result.errors.length === 0,
      data: {
        synced: result.synced,
        errors: result.errors,
        message: result.errors.length === 0
          ? `Synced ${result.synced} products to Stripe`
          : `Synced ${result.synced} with ${result.errors.length} error(s)`,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/v1/catalog/resolve-price — internal helper ─────────────────
// Returns the Stripe price ID for a given productKey + billing period
// Used by the checkout flow; not called directly from the browser
router.post('/resolve-price', authenticate, async (req: Request, res: Response) => {
  const { productKey, period } = req.body as { productKey?: string; period?: 'monthly' | 'annual' };
  if (!productKey || !period) {
    return res.status(400).json({ success: false, error: 'productKey and period are required' });
  }
  try {
    const priceId = await resolveStripePriceId(productKey, period);
    if (!priceId) {
      return res.status(404).json({ success: false, error: 'Price not found — run /catalog/sync-stripe first' });
    }
    res.json({ success: true, data: { priceId } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
