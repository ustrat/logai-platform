import { Router, Request, Response } from 'express';
import { plaidService } from '../services/plaidService';
import { authenticate } from '../middleware/auth';

const router = Router();

// All Plaid routes require authentication
router.use(authenticate);

// In-memory token store — replace with DB in production
const accessTokenStore: Record<string, { accessToken: string; itemId: string; connectedAt: string }> = {};

/**
 * POST /api/v1/plaid/link-token
 * Creates a Plaid Link token to initialize the Plaid Link UI
 */
router.post('/link-token', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const data = await plaidService.createLinkToken(userId);
    res.json({ success: true, data: { link_token: data.link_token } });
  } catch (err: any) {
    console.error('Plaid link-token error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.response?.data?.error_message || err.message });
  }
});

/**
 * POST /api/v1/plaid/exchange-token
 * Exchanges Plaid public token for permanent access token
 * Body: { public_token: string }
 */
router.post('/exchange-token', async (req: Request, res: Response) => {
  try {
    const { public_token } = req.body;
    if (!public_token) return res.status(400).json({ success: false, error: 'public_token required' });

    const userId = (req as any).user.userId;
    const data = await plaidService.exchangePublicToken(public_token);

    // Store access token keyed by user
    accessTokenStore[userId] = {
      accessToken: data.access_token,
      itemId: data.item_id,
      connectedAt: new Date().toISOString(),
    };

    res.json({ success: true, data: { item_id: data.item_id, connected: true } });
  } catch (err: any) {
    console.error('Plaid exchange-token error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.response?.data?.error_message || err.message });
  }
});

/**
 * GET /api/v1/plaid/transactions?start=YYYY-MM-DD&end=YYYY-MM-DD&count=500
 * Fetches transactions for the authenticated user's linked bank
 */
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const stored = accessTokenStore[userId];

    if (!stored) {
      return res.status(404).json({ success: false, error: 'No bank account linked. Connect via Plaid Link first.' });
    }

    const end = (req.query.end as string) || new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90); // default 90 days
    const start = (req.query.start as string) || startDate.toISOString().split('T')[0];
    const count = parseInt(req.query.count as string) || 500;

    const data = await plaidService.getTransactions(stored.accessToken, start, end, count);

    // Normalize to match our internal transaction schema
    const normalized = data.transactions.map((t: any) => ({
      transaction_id:   t.transaction_id,
      account_id:       t.account_id,
      amount:           t.amount,
      date:             t.date,
      name:             t.name,
      merchant_name:    t.merchant_name || t.name,
      category:         t.personal_finance_category?.primary || t.category?.[0] || 'OTHER',
      sub_category:     t.personal_finance_category?.detailed || t.category?.[1] || '',
      payment_channel:  t.payment_channel,
      pending:          t.pending,
      currency:         t.iso_currency_code || 'USD',
      logo_url:         t.logo_url || null,
    }));

    res.json({
      success: true,
      data: {
        transactions:       normalized,
        total_transactions: data.total_transactions,
        accounts:           data.accounts,
        date_range:         { start, end },
        source:             'plaid',
      },
    });
  } catch (err: any) {
    console.error('Plaid transactions error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.response?.data?.error_message || err.message });
  }
});

/**
 * GET /api/v1/plaid/accounts
 * Returns linked bank accounts and balances
 */
router.get('/accounts', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const stored = accessTokenStore[userId];

    if (!stored) {
      return res.status(404).json({ success: false, error: 'No bank account linked.' });
    }

    const data = await plaidService.getAccounts(stored.accessToken);
    res.json({ success: true, data: { accounts: data.accounts, item: data.item } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.response?.data?.error_message || err.message });
  }
});

/**
 * POST /api/v1/plaid/sandbox/connect
 * Sandbox only — auto-connects a fake Chase bank account for testing
 */
router.post('/sandbox/connect', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const sandboxItem = await plaidService.createSandboxItem();
    const exchanged = await plaidService.exchangePublicToken(sandboxItem.public_token);

    accessTokenStore[userId] = {
      accessToken: exchanged.access_token,
      itemId: exchanged.item_id,
      connectedAt: new Date().toISOString(),
    };

    res.json({ success: true, data: { item_id: exchanged.item_id, connected: true, note: 'Sandbox Chase account connected' } });
  } catch (err: any) {
    console.error('Plaid sandbox connect error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.response?.data?.error_message || err.message });
  }
});

/**
 * GET /api/v1/plaid/status
 * Check if the current user has a linked bank account
 */
router.get('/status', (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const stored = accessTokenStore[userId];
  res.json({
    success: true,
    data: {
      connected: !!stored,
      item_id: stored?.itemId || null,
      connected_at: stored?.connectedAt || null,
    },
  });
});

/**
 * DELETE /api/v1/plaid/disconnect
 * Remove linked bank account
 */
router.delete('/disconnect', (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  delete accessTokenStore[userId];
  res.json({ success: true, data: { disconnected: true } });
});

export default router;