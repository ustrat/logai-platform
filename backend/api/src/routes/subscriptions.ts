import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { getPlaidToken } from '../lib/plaidStore';
import { plaidService } from '../services/plaidService';

const router = Router();
router.use(authenticate);

// ── Types ──────────────────────────────────────────────────────────────────

interface PlaidTransaction {
  transaction_id: string;
  merchant_name:  string;
  name:           string;
  amount:         number;
  date:           string;
  category:       string;
  payment_channel: string;
}

interface DetectedSubscription {
  id:                  string;
  merchant:            string;
  category:            string;
  frequency:           'monthly' | 'quarterly' | 'annual' | 'weekly' | 'irregular';
  frequencyLabel:      string;
  amountPerOccurrence: number;
  annualCost:          number;
  confidence:          number;
  occurrences:         number;
  lastCharged:         string;
  nextExpected:        string;
  status:              'active' | 'cancelled' | 'at_risk';
  amountVariance:      number;
  dayVariance:         number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  return Math.abs((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function classifyFrequency(avgDays: number) {
  if (avgDays >= 3   && avgDays <= 10)  return { frequency: 'weekly'    as const, label: 'Weekly',    expectedDays: 7   };
  if (avgDays >= 25  && avgDays <= 35)  return { frequency: 'monthly'   as const, label: 'Monthly',   expectedDays: 30  };
  if (avgDays >= 80  && avgDays <= 100) return { frequency: 'quarterly' as const, label: 'Quarterly', expectedDays: 91  };
  if (avgDays >= 340 && avgDays <= 390) return { frequency: 'annual'    as const, label: 'Annual',    expectedDays: 365 };
  return { frequency: 'irregular' as const, label: 'Irregular', expectedDays: avgDays };
}

function annualCostEstimate(amount: number, freq: DetectedSubscription['frequency']): number {
  const m: Record<string, number> = { weekly: 52, monthly: 12, quarterly: 4, annual: 1, irregular: 6 };
  return amount * (m[freq] ?? 6);
}

// ── Core detection ─────────────────────────────────────────────────────────

function detectSubscriptions(transactions: PlaidTransaction[]): {
  subscriptions: DetectedSubscription[];
  summary: Record<string, unknown>;
} {
  const groups: Record<string, PlaidTransaction[]> = {};
  for (const t of transactions) {
    const key = (t.merchant_name || t.name || 'Unknown')
      .toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    (groups[key] ??= []).push(t);
  }

  const subscriptions: DetectedSubscription[] = [];

  for (const [key, txns] of Object.entries(groups)) {
    if (txns.length < 2) continue;
    const sorted = [...txns].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const amounts = sorted.map(t => Math.abs(t.amount));
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const amountVariancePct = avgAmount > 0
      ? (Math.max(...amounts) - Math.min(...amounts)) / avgAmount : 1;
    if (amountVariancePct > 0.4 && txns.length < 4) continue;

    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) intervals.push(daysBetween(sorted[i-1].date, sorted[i].date));
    const avgInterval = intervals.reduce((s, d) => s + d, 0) / intervals.length;
    const intervalStdDev = intervals.length > 1
      ? Math.sqrt(intervals.reduce((s, d) => s + (d - avgInterval) ** 2, 0) / intervals.length) : 0;

    const { frequency, label, expectedDays } = classifyFrequency(avgInterval);
    if (frequency === 'irregular' && txns.length < 3) continue;

    let confidence = 0.5
      + Math.min(0.3, txns.length * 0.06)
      + Math.max(0, 0.2 - (expectedDays > 0 ? intervalStdDev / expectedDays : 1) * 0.4)
      + Math.max(0, 0.15 - amountVariancePct * 0.3);
    if (['SUBSCRIPTION','SOFTWARE','STREAMING','DIGITAL_PURCHASE','ENTERTAINMENT']
      .some(c => txns[0].category?.toUpperCase().includes(c))) confidence += 0.1;
    confidence = Math.min(0.99, Math.max(0.1, confidence));

    const lastDate = sorted[sorted.length - 1].date;
    const overdue = daysBetween(lastDate, new Date().toISOString().split('T')[0]) - expectedDays;
    const status: DetectedSubscription['status'] =
      overdue > expectedDays * 0.5 ? 'cancelled' :
      overdue > expectedDays * 0.2 ? 'at_risk' : 'active';

    subscriptions.push({
      id:                  `sub_${key.replace(/\s/g,'_').substring(0,20)}_${txns.length}`,
      merchant:            txns[0].merchant_name || txns[0].name || 'Unknown',
      category:            txns[0].category || 'OTHER',
      frequency,
      frequencyLabel:      label,
      amountPerOccurrence: Math.round(avgAmount * 100) / 100,
      annualCost:          Math.round(annualCostEstimate(avgAmount, frequency)),
      confidence:          Math.round(confidence * 100) / 100,
      occurrences:         txns.length,
      lastCharged:         lastDate,
      nextExpected:        addDays(lastDate, Math.round(expectedDays)),
      status,
      amountVariance:      Math.round(amountVariancePct * 100),
      dayVariance:         Math.round(intervalStdDev),
    });
  }

  subscriptions.sort((a, b) => b.annualCost - a.annualCost);

  const active = subscriptions.filter(s => s.status === 'active');
  const totalMonthly = active.reduce((sum, s) => sum + (
    s.frequency === 'monthly'   ? s.amountPerOccurrence :
    s.frequency === 'quarterly' ? s.amountPerOccurrence / 3 :
    s.frequency === 'annual'    ? s.amountPerOccurrence / 12 :
    s.frequency === 'weekly'    ? s.amountPerOccurrence * 4.33 :
    s.amountPerOccurrence / 2
  ), 0);

  return {
    subscriptions,
    summary: {
      totalMonthlyEstimate:  Math.round(totalMonthly * 100) / 100,
      totalAnnualEstimate:   Math.round(active.reduce((s, sub) => s + sub.annualCost, 0)),
      subscriptionCount:     subscriptions.length,
      byFrequency:           subscriptions.reduce((acc, s) => ({ ...acc, [s.frequencyLabel]: (acc[s.frequencyLabel] || 0) + 1 }), {} as Record<string,number>),
      byCategory:            subscriptions.reduce((acc, s) => { const c = s.category.replace(/_/g,' '); return { ...acc, [c]: (acc[c]||0)+1 }; }, {} as Record<string,number>),
      atRiskCount:           subscriptions.filter(s => s.status === 'at_risk').length,
      highConfidenceCount:   subscriptions.filter(s => s.confidence >= 0.75).length,
    },
  };
}

// ── Route ──────────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  const userId        = req.user!.userId;
  const days          = parseInt(req.query.days as string) || 365;
  const minConfidence = parseFloat(req.query.min_confidence as string) || 0.4;

  const stored = await getPlaidToken(userId);
  if (!stored) {
    return res.status(404).json({ success: false, error: 'No Plaid account linked. Connect via the Plaid page first.' });
  }

  const end = new Date().toISOString().split('T')[0];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const start = startDate.toISOString().split('T')[0];

  const data = await plaidService.getTransactions(stored.accessToken, start, end, 500);
  const rawTxns: PlaidTransaction[] = (data.transactions ?? []).map((t: any) => ({
    transaction_id:  t.transaction_id,
    merchant_name:   t.merchant_name || t.name,
    name:            t.name,
    amount:          t.amount,
    date:            t.date,
    category:        t.personal_finance_category?.primary || t.category?.[0] || 'OTHER',
    payment_channel: t.payment_channel || 'other',
  }));

  const { subscriptions, summary } = detectSubscriptions(rawTxns);
  const filtered = subscriptions.filter(s => s.confidence >= minConfidence);

  res.json({
    success: true,
    data: {
      subscriptions: filtered,
      summary,
      metadata: {
        days_analyzed:          days,
        transactions_scanned:   rawTxns.length,
        min_confidence_filter:  minConfidence,
        generated_at:           new Date().toISOString(),
      },
    },
  });
});

export default router;
