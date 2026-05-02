import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { authenticate } from '../middleware/auth';
import { getSecrets } from '../lib/secretsManager';
import { resolveStripePriceId, getAllProducts } from '../lib/catalogService';

const router = Router();

// Lazy Stripe client — secrets are loaded at startup before any requests arrive
let _stripe: Stripe | null = null;
function stripe(): Stripe {
  if (!_stripe) _stripe = new Stripe(getSecrets().stripe.secretKey, { apiVersion: '2024-06-20' });
  return _stripe;
}

router.use(authenticate);

// ── GET /api/v1/payments/products ─────────────────────────────────────────────
// Returns products from DynamoDB price book (not live from Stripe).
// Stripe price IDs are resolved server-side only during checkout.
router.get('/products', async (_req: Request, res: Response) => {
  try {
    const products = await getAllProducts();
    const safe = products.map(p => ({
      productId:   p.productKey,
      name:        p.name,
      description: p.description,
      metadata:    Object.fromEntries((p.features ?? []).map((f, i) => [`feature_${String(i + 1).padStart(2, '0')}`, f])),
      prices: [
        ...(p.prices.monthly ? [{ priceId: `${p.productKey}::monthly`, amount: p.prices.monthly, currency: 'usd', interval: 'month', intervalCount: 1 }] : []),
        ...(p.prices.annual  ? [{ priceId: `${p.productKey}::annual`,  amount: p.prices.annual,  currency: 'usd', interval: 'year',  intervalCount: 1 }] : []),
      ],
    }));
    res.json({ success: true, data: { products: safe } });
  } catch (err: any) {
    console.error('Catalog products error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/v1/payments/checkout ────────────────────────────────────────────
// Body: { priceId, successUrl, cancelUrl }
// priceId may be a raw Stripe price ID (price_xxx) OR the DynamoDB-keyed
// format "productKey::monthly" / "productKey::annual"
router.post('/checkout', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let { priceId, successUrl, cancelUrl } = req.body;

    if (!priceId || !successUrl || !cancelUrl) {
      return res.status(400).json({ success: false, error: 'priceId, successUrl, and cancelUrl are required' });
    }

    // Resolve virtual price IDs from DynamoDB when using "productKey::period" format
    if (priceId.includes('::')) {
      const [productKey, period] = priceId.split('::') as [string, 'monthly' | 'annual'];
      const resolved = await resolveStripePriceId(productKey, period);
      if (!resolved) {
        return res.status(400).json({
          success: false,
          error: `No Stripe price synced for ${productKey} (${period}). Run POST /api/v1/catalog/sync-stripe first.`,
        });
      }
      priceId = resolved;
    }

    // Validate the resolved Stripe price exists
    const price = await stripe().prices.retrieve(priceId).catch(() => null);
    if (!price || !price.active) {
      return res.status(400).json({ success: false, error: 'Invalid or inactive price' });
    }

    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.userId,
      metadata: { userId: user.userId, priceId },
      subscription_data: {
        trial_period_days: 14,
        metadata: { userId: user.userId },
      },
      payment_method_collection: 'always',
      allow_promotion_codes: true,
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });

    res.json({ success: true, data: { checkoutUrl: session.url, sessionId: session.id } });
  } catch (err: any) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/v1/payments/subscription ────────────────────────────────────────
router.get('/subscription', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const customers = await stripe().customers.list({ email: user.email, limit: 1 });
    if (!customers.data.length) {
      return res.json({ success: true, data: { subscriptions: [] } });
    }

    const subs = await stripe().subscriptions.list({
      customer: customers.data[0].id,
      status: 'all',
      limit: 20,
      expand: ['data.items.data.price.product'],
    });

    const subscriptions = subs.data.map(sub => {
      const item = sub.items.data[0];
      const prod = item?.price?.product as Stripe.Product | undefined;
      return {
        id:               sub.id,
        status:           sub.status,
        productId:        prod?.id ?? null,
        productName:      prod?.name ?? null,
        priceId:          item?.price?.id ?? null,
        currentPeriodEnd: sub.current_period_end,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        trialEnd:         sub.trial_end,
      };
    });

    res.json({ success: true, data: { subscriptions } });
  } catch (err: any) {
    console.error('Stripe subscription error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/v1/payments/portal ──────────────────────────────────────────────
router.post('/portal', async (req: Request, res: Response) => {
  try {
    const user      = (req as any).user;
    const returnUrl = req.body.returnUrl || `${process.env.APP_URL || 'http://localhost:3000'}/pricing`;

    const customers = await stripe().customers.list({ email: user.email, limit: 1 });
    if (!customers.data.length) {
      return res.status(404).json({ success: false, error: 'No billing account found' });
    }

    const portal = await stripe().billingPortal.sessions.create({
      customer:   customers.data[0].id,
      return_url: returnUrl,
    });

    res.json({ success: true, data: { portalUrl: portal.url } });
  } catch (err: any) {
    console.error('Stripe portal error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
