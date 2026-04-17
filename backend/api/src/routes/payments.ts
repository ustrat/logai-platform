import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { authenticate } from '../middleware/auth';

const router = Router();

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const stripe     = new Stripe(STRIPE_KEY, { apiVersion: '2024-06-20' });

router.use(authenticate);

// ── GET /api/v1/payments/products ─────────────────────────────────────────────
// Fetches all active products + their prices live from Stripe.
// Frontend renders whatever exists in the account — no hardcoding needed.
router.get('/products', async (_req: Request, res: Response) => {
  try {
    const [products, prices] = await Promise.all([
      stripe.products.list({ active: true, limit: 100 }),
      stripe.prices.list({ active: true, limit: 100 }),
    ]);

    // Group prices by product
    const pricesByProduct: Record<string, Stripe.Price[]> = {};
    for (const price of prices.data) {
      const productId = typeof price.product === 'string' ? price.product : price.product.id;
      if (!pricesByProduct[productId]) pricesByProduct[productId] = [];
      pricesByProduct[productId].push(price);
    }

    const catalog = products.data
      .filter(p => pricesByProduct[p.id]?.length > 0)
      .map(product => ({
        productId:   product.id,
        name:        product.name,
        description: product.description || '',
        images:      product.images,
        metadata:    product.metadata,
        prices:      (pricesByProduct[product.id] || []).map(price => ({
          priceId:   price.id,
          amount:    price.unit_amount,
          currency:  price.currency,
          interval:  price.recurring?.interval ?? null,
          intervalCount: price.recurring?.interval_count ?? 1,
        })),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({ success: true, data: { products: catalog } });
  } catch (err: any) {
    console.error('Stripe products error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/v1/payments/checkout ────────────────────────────────────────────
// Body: { priceId, successUrl, cancelUrl }
router.post('/checkout', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { priceId, successUrl, cancelUrl } = req.body;

    if (!priceId || !successUrl || !cancelUrl) {
      return res.status(400).json({ success: false, error: 'priceId, successUrl, and cancelUrl are required' });
    }

    // Validate price exists in Stripe
    const price = await stripe.prices.retrieve(priceId).catch(() => null);
    if (!price || !price.active) {
      return res.status(400).json({ success: false, error: 'Invalid or inactive price' });
    }

    const session = await stripe.checkout.sessions.create({
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

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (!customers.data.length) {
      return res.json({ success: true, data: { subscriptions: [] } });
    }

    const subs = await stripe.subscriptions.list({
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

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (!customers.data.length) {
      return res.status(404).json({ success: false, error: 'No billing account found' });
    }

    const portal = await stripe.billingPortal.sessions.create({
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
