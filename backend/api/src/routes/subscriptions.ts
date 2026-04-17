/**
 * Subscription Detection Engine
 * Analyzes Plaid transactions to identify recurring subscriptions
 * and classify them as monthly, quarterly, or annual.
 */

import router from "./plaid";

interface PlaidTransaction {
  transaction_id: string;
  merchant_name: string;
  name: string;
  amount: number;
  date: string;
  category: string;
  payment_channel: string;
}

export interface DetectedSubscription {
  id: string;
  merchant: string;
  category: string;
  frequency: 'monthly' | 'quarterly' | 'annual' | 'weekly' | 'irregular';
  frequencyLabel: string;
  amountPerOccurrence: number;
  annualCost: number;
  confidence: number; // 0-1
  occurrences: number;
  lastCharged: string;
  nextExpected: string;
  status: 'active' | 'cancelled' | 'at_risk';
  transactions: string[]; // transaction IDs
  amountVariance: number; // how much amount varies across charges
  dayVariance: number; // how many days off from perfect cadence
}

export interface SubscriptionSummary {
  totalMonthlyEstimate: number;
  totalAnnualEstimate: number;
  subscriptionCount: number;
  byFrequency: Record<string, number>;
  byCategory: Record<string, number>;
  atRiskCount: number;
  highConfidenceCount: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.abs((b - a) / (1000 * 60 * 60 * 24));
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function classifyFrequency(avgDays: number): {
  frequency: DetectedSubscription['frequency'];
  label: string;
  expectedDays: number;
} {
  if (avgDays >= 3 && avgDays <= 10)   return { frequency: 'weekly',    label: 'Weekly',    expectedDays: 7   };
  if (avgDays >= 25 && avgDays <= 35)  return { frequency: 'monthly',   label: 'Monthly',   expectedDays: 30  };
  if (avgDays >= 80 && avgDays <= 100) return { frequency: 'quarterly', label: 'Quarterly', expectedDays: 91  };
  if (avgDays >= 340 && avgDays <= 390)return { frequency: 'annual',    label: 'Annual',    expectedDays: 365 };
  return { frequency: 'irregular', label: 'Irregular', expectedDays: avgDays };
}

function annualCost(amount: number, freq: DetectedSubscription['frequency']): number {
  const multipliers: Record<string, number> = {
    weekly: 52, monthly: 12, quarterly: 4, annual: 1, irregular: 6,
  };
  return amount * (multipliers[freq] || 6);
}

function normalizeAmount(amount: number): number {
  return Math.abs(amount);
}

// ── Core Detection Algorithm ───────────────────────────────────────────────

export function detectSubscriptions(transactions: PlaidTransaction[]): {
  subscriptions: DetectedSubscription[];
  summary: SubscriptionSummary;
} {
  // 1. Group by normalized merchant name
  const groups: Record<string, PlaidTransaction[]> = {};

  transactions.forEach(txn => {
    const key = (txn.merchant_name || txn.name || 'Unknown')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!groups[key]) groups[key] = [];
    groups[key].push(txn);
  });

  const subscriptions: DetectedSubscription[] = [];

  for (const [key, txns] of Object.entries(groups)) {
    // Need at least 2 occurrences to detect a pattern
    if (txns.length < 2) continue;

    // Sort by date ascending
    const sorted = [...txns].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // 2. Check amount consistency (subscriptions have similar amounts)
    const amounts = sorted.map(t => normalizeAmount(t.amount));
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const amountVariance = Math.max(...amounts) - Math.min(...amounts);
    const amountVariancePct = avgAmount > 0 ? amountVariance / avgAmount : 1;

    // Skip if amounts vary too wildly (>40% variance = not a subscription)
    if (amountVariancePct > 0.4 && txns.length < 4) continue;

    // 3. Calculate day intervals between consecutive charges
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(daysBetween(sorted[i - 1].date, sorted[i].date));
    }

    const avgInterval = intervals.reduce((s, d) => s + d, 0) / intervals.length;
    const intervalVariance = intervals.length > 1
      ? Math.sqrt(intervals.reduce((s, d) => s + Math.pow(d - avgInterval, 2), 0) / intervals.length)
      : 0;

    // 4. Classify frequency
    const { frequency, label, expectedDays } = classifyFrequency(avgInterval);

    // Skip truly irregular single-occurrence items
    if (frequency === 'irregular' && txns.length < 3) continue;

    // 5. Calculate confidence score
    let confidence = 0.5;

    // More occurrences = higher confidence
    confidence += Math.min(0.3, txns.length * 0.06);

    // Lower interval variance = higher confidence
    const normalizedVariance = expectedDays > 0 ? intervalVariance / expectedDays : 1;
    confidence += Math.max(0, 0.2 - normalizedVariance * 0.4);

    // Lower amount variance = higher confidence
    confidence += Math.max(0, 0.15 - amountVariancePct * 0.3);

    // Known subscription categories boost confidence
    const subCategories = ['SUBSCRIPTION', 'SOFTWARE', 'STREAMING', 'DIGITAL_PURCHASE', 'ENTERTAINMENT'];
    if (subCategories.some(c => txns[0].category?.toUpperCase().includes(c))) {
      confidence += 0.1;
    }

    confidence = Math.min(0.99, Math.max(0.1, confidence));

    // 6. Determine status
    const lastDate = sorted[sorted.length - 1].date;
    const daysSinceLast = daysBetween(lastDate, new Date().toISOString().split('T')[0]);
    const overdueBy = daysSinceLast - expectedDays;

    let status: DetectedSubscription['status'] = 'active';
    if (overdueBy > expectedDays * 0.5) status = 'cancelled';
    else if (overdueBy > expectedDays * 0.2) status = 'at_risk';

    // 7. Predict next charge
    const nextExpected = addDays(lastDate, Math.round(expectedDays));

    subscriptions.push({
      id: `sub_${key.replace(/\s/g, '_').substring(0, 20)}_${txns.length}`,
      merchant: txns[0].merchant_name || txns[0].name || 'Unknown',
      category: txns[0].category || 'OTHER',
      frequency,
      frequencyLabel: label,
      amountPerOccurrence: Math.round(avgAmount * 100) / 100,
      annualCost: Math.round(annualCost(avgAmount, frequency)),
      confidence: Math.round(confidence * 100) / 100,
      occurrences: txns.length,
      lastCharged: lastDate,
      nextExpected,
      status,
      transactions: sorted.map(t => t.transaction_id),
      amountVariance: Math.round(amountVariancePct * 100),
      dayVariance: Math.round(intervalVariance),
    });
  }

  // Sort by annual cost descending
  subscriptions.sort((a, b) => b.annualCost - a.annualCost);

  // 8. Build summary
  const active = subscriptions.filter(s => s.status === 'active');
  const totalMonthlyEstimate = active.reduce((sum, s) => {
    const monthly = s.frequency === 'monthly' ? s.amountPerOccurrence
      : s.frequency === 'quarterly' ? s.amountPerOccurrence / 3
      : s.frequency === 'annual' ? s.amountPerOccurrence / 12
      : s.frequency === 'weekly' ? s.amountPerOccurrence * 4.33
      : s.amountPerOccurrence / 2;
    return sum + monthly;
  }, 0);

  const byFrequency = subscriptions.reduce((acc, s) => {
    acc[s.frequencyLabel] = (acc[s.frequencyLabel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const byCategory = subscriptions.reduce((acc, s) => {
    const cat = s.category.replace(/_/g, ' ');
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const summary: SubscriptionSummary = {
    totalMonthlyEstimate: Math.round(totalMonthlyEstimate * 100) / 100,
    totalAnnualEstimate: Math.round(active.reduce((s, sub) => s + sub.annualCost, 0)),
    subscriptionCount: subscriptions.length,
    byFrequency,
    byCategory,
    atRiskCount: subscriptions.filter(s => s.status === 'at_risk').length,
    highConfidenceCount: subscriptions.filter(s => s.confidence >= 0.75).length,
  };

  return { subscriptions, summary };
}

export default router;