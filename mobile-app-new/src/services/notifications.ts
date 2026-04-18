import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

// Show alerts even when app is in foreground
// Wrapped in try/catch — native module may be absent in Expo Go or old dev builds
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // Notifications native module not available (Expo Go / missing native build)
}

// ── Notification categories (action buttons) ───────────────────
export async function registerNotificationCategories(): Promise<void> {
  try { await _registerNotificationCategories(); } catch { /* native module absent */ }
}
async function _registerNotificationCategories() {
  const categories: [string, string, string][] = [
    ['renewal_alert',      'Review Account',  'subscriptions'],
    ['usage_drop',         'Investigate',     'anomalies'],
    ['engagement_decline', 'Review Activity', 'subscriptions'],
    ['renewal_window',     'Start Review',    'subscriptions'],
    ['inactive_customer',  'Take Action',     'subscriptions'],
    ['commitment_risk',    'Review Plan',     'subscriptions'],
    ['approval_required',  'Review Now',      'subscriptions'],
    ['customer_responded', 'View Message',    'subscriptions'],
    ['payment_failed',     'Resolve Now',     'subscriptions'],
    ['churn_risk',         'Intervene',       'subscriptions'],
    ['health_score_drop',  'View Health',     'subscriptions'],
    ['price_increase',     'Review Pricing',  'subscriptions'],
    ['upsell_opportunity', 'View Opportunity','subscriptions'],
    ['contract_expiring',  'Renew Contract',  'subscriptions'],
  ];

  for (const [id, buttonTitle] of categories) {
    await Notifications.setNotificationCategoryAsync(id, [
      {
        identifier: 'primary_action',
        buttonTitle,
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'snooze',
        buttonTitle: 'Snooze',
        options: { opensAppToForeground: false },
      },
    ]);
  }
}

// Map category → tab route for tap navigation
export const CATEGORY_ROUTES: Record<string, string> = {
  renewal_alert:      '/(tabs)/subscriptions',
  usage_drop:         '/(tabs)/anomalies',
  engagement_decline: '/(tabs)/subscriptions',
  renewal_window:     '/(tabs)/subscriptions',
  inactive_customer:  '/(tabs)/subscriptions',
  commitment_risk:    '/(tabs)/subscriptions',
  approval_required:  '/(tabs)/subscriptions',
  customer_responded: '/(tabs)/subscriptions',
  payment_failed:     '/(tabs)/subscriptions',
  churn_risk:         '/(tabs)/subscriptions',
  health_score_drop:  '/(tabs)/subscriptions',
  price_increase:     '/(tabs)/subscriptions',
  upsell_opportunity: '/(tabs)/subscriptions',
  contract_expiring:  '/(tabs)/subscriptions',
};

// ── Permission ─────────────────────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ── Snoozed list helpers ───────────────────────────────────────
const SNOOZED_KEY = 'snoozed_subscription_alerts';

async function getSnoozed(): Promise<Set<string>> {
  try {
    const raw = await SecureStore.getItemAsync(SNOOZED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export async function snoozeAlert(subId: string): Promise<void> {
  const snoozed = await getSnoozed();
  snoozed.add(subId);
  await SecureStore.setItemAsync(SNOOZED_KEY, JSON.stringify([...snoozed]));
}

export async function clearSnooze(subId: string): Promise<void> {
  const snoozed = await getSnoozed();
  snoozed.delete(subId);
  await SecureStore.setItemAsync(SNOOZED_KEY, JSON.stringify([...snoozed]));
}

export async function cancelAlert(subId: string) {
  try { await Notifications.cancelScheduledNotificationAsync(`renewal-${subId}`); } catch { /* native absent */ }
}

export async function getScheduledAlerts() {
  try { return Notifications.getAllScheduledNotificationsAsync(); } catch { return []; }
}

// ── Subscription interface ─────────────────────────────────────
export interface Subscription {
  id: string;
  merchant: string;
  nextExpected: string;
  amountPerOccurrence: number;
  annualCost: number;
  frequencyLabel: string;
  status: string;
  confidence: number;
  occurrences: number;
  amountVariance: number;
  dayVariance: number;
  // Extended fields for additional alert types
  previousAmount?: number;       // for price_increase detection
  healthScore?: number;          // 0–100, for health_score_drop
  previousHealthScore?: number;  // for health_score_drop delta
  churnScore?: number;           // 0–100, high = likely to churn
  contractEndDate?: string;      // ISO date, for contract_expiring
  isPaymentFailed?: boolean;     // billing failure flag
  expansionRevenuePotential?: number; // ARR delta, for upsell_opportunity
}

// ── Helper: send an immediate notification ─────────────────────
// Returns silently if native module is absent
async function sendNow(
  id: string,
  category: string,
  title: string,
  body: string,
  subtitle?: string,
  data?: Record<string, any>,
  badge = 1,
) {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title,
        body,
        ...(subtitle ? { subtitle } : {}),
        categoryIdentifier: category,
        data: { ...data, category },
        sound: true,
        badge,
      },
      trigger: null,
    });
  } catch { /* native module absent */ }
}

// ── Helper: schedule a future notification ─────────────────────
async function scheduleAt(
  id: string,
  category: string,
  title: string,
  body: string,
  date: Date,
  subtitle?: string,
  data?: Record<string, any>,
) {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title,
        body,
        ...(subtitle ? { subtitle } : {}),
        categoryIdentifier: category,
        data: { ...data, category },
        sound: true,
        badge: 1,
      },
      trigger: { type: 'date', date } as any,
    });
  } catch { /* native module absent */ }
}

// ── 1. Renewal at risk (scheduled before charge date) ──────────
export async function scheduleRenewalAlerts(
  subscriptions: Subscription[],
  daysBeforeRenewal = 3,
): Promise<{ scheduled: number; skipped: number }> {
  const granted = await requestNotificationPermission();
  if (!granted) return { scheduled: 0, skipped: 0 };

  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch { /* native absent */ }

  const snoozed = await getSnoozed();
  const now = new Date();
  let scheduled = 0;
  let skipped = 0;

  for (const sub of subscriptions) {
    if (sub.status === 'cancelled' || snoozed.has(sub.id) || !sub.nextExpected) {
      skipped++; continue;
    }

    const chargeDate = new Date(sub.nextExpected);
    const alertDate  = new Date(chargeDate);
    alertDate.setDate(alertDate.getDate() - daysBeforeRenewal);
    alertDate.setHours(9, 0, 0, 0);

    if (alertDate <= now) { skipped++; continue; }

    const amt = `$${Math.round(sub.amountPerOccurrence).toLocaleString()}`;
    await scheduleAt(
      `renewal-${sub.id}`,
      'renewal_alert',
      `Renewal at risk — ${amt}`,
      `Customer: ${sub.merchant}`,
      alertDate,
      `Due in ${daysBeforeRenewal} day${daysBeforeRenewal !== 1 ? 's' : ''} · ${sub.frequencyLabel}`,
      { subId: sub.id, merchant: sub.merchant, amount: sub.amountPerOccurrence },
    );
    scheduled++;
  }

  // Immediate summary for subs already within the window
  const dueSoon = subscriptions.filter(s => {
    if (s.status === 'cancelled' || !s.nextExpected || snoozed.has(s.id)) return false;
    const diff = Math.ceil((new Date(s.nextExpected).getTime() - now.getTime()) / 86_400_000);
    return diff >= 0 && diff <= daysBeforeRenewal;
  });

  if (dueSoon.length > 0) {
    const total = dueSoon.reduce((sum, s) => sum + s.amountPerOccurrence, 0);
    const amt = `$${Math.round(total).toLocaleString()}`;
    await sendNow(
      'renewal-summary',
      'renewal_alert',
      `Renewal at risk — ${amt}`,
      `Customer: ${dueSoon.length === 1 ? dueSoon[0].merchant : `${dueSoon.length} subscriptions due`}`,
      dueSoon.length > 1 ? dueSoon.map(s => s.merchant).join(', ') : undefined,
      { type: 'summary' },
      dueSoon.length,
    );
  }

  return { scheduled, skipped };
}

// ── 2. Usage drop detected ─────────────────────────────────────
// Triggered when amountVariance drops significantly (proxy for usage drop)
export async function checkAndSendUsageDropAlerts(subscriptions: Subscription[]) {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const dropped = subscriptions.filter(
    s => s.status === 'active' && s.amountVariance > 25,
  );

  for (const sub of dropped) {
    const dropPct = Math.round(sub.amountVariance);
    await sendNow(
      `usage-drop-${sub.id}`,
      'usage_drop',
      `Usage drop detected — ${dropPct}%`,
      `Customer: ${sub.merchant}`,
      undefined,
      { subId: sub.id, merchant: sub.merchant },
    );
  }
}

// ── 3. Engagement declining ────────────────────────────────────
// Triggered for at_risk subs with low confidence
export async function checkAndSendEngagementAlerts(subscriptions: Subscription[]) {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const declining = subscriptions.filter(
    s => s.status === 'at_risk' && s.confidence < 0.6,
  );

  for (const sub of declining) {
    await sendNow(
      `engagement-${sub.id}`,
      'engagement_decline',
      'Engagement declining',
      `Customer: ${sub.merchant}`,
      `Confidence dropped to ${Math.round(sub.confidence * 100)}%`,
      { subId: sub.id, merchant: sub.merchant },
    );
  }
}

// ── 4. Renewal window opened ───────────────────────────────────
// Triggered for subscriptions whose charge date is today or tomorrow
export async function checkAndSendRenewalWindowAlerts(subscriptions: Subscription[]) {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const now = new Date();
  const windowOpen = subscriptions.filter(s => {
    if (s.status === 'cancelled' || !s.nextExpected) return false;
    const diff = Math.ceil((new Date(s.nextExpected).getTime() - now.getTime()) / 86_400_000);
    return diff >= 0 && diff <= 1;
  });

  for (const sub of windowOpen) {
    const amt = `$${Math.round(sub.amountPerOccurrence).toLocaleString()}`;
    await sendNow(
      `window-${sub.id}`,
      'renewal_window',
      'Renewal window opened',
      `${amt} at stake`,
      `Customer: ${sub.merchant}`,
      { subId: sub.id, merchant: sub.merchant, amount: sub.amountPerOccurrence },
    );
  }
}

// ── 5. Customer inactive ────────────────────────────────────────
// Triggered when dayVariance is high (irregular/late payments = inactivity proxy)
export async function checkAndSendInactiveCustomerAlerts(subscriptions: Subscription[]) {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const inactive = subscriptions.filter(
    s => s.status === 'at_risk' && s.dayVariance > 14,
  );

  for (const sub of inactive) {
    const days = Math.round(sub.dayVariance);
    await sendNow(
      `inactive-${sub.id}`,
      'inactive_customer',
      `Customer inactive — ${days} days`,
      'Risk increasing',
      `Customer: ${sub.merchant}`,
      { subId: sub.id, merchant: sub.merchant },
    );
  }
}

// ── 6. Commitment risk detected ────────────────────────────────
// Triggered for active subs with declining occurrences or low confidence
export async function checkAndSendCommitmentRiskAlerts(subscriptions: Subscription[]) {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const atRisk = subscriptions.filter(
    s => s.status === 'active' && s.confidence >= 0.4 && s.confidence < 0.65 && s.occurrences < 3,
  );

  for (const sub of atRisk) {
    await sendNow(
      `commitment-${sub.id}`,
      'commitment_risk',
      'Commitment risk detected',
      'Below usage threshold',
      `Customer: ${sub.merchant}`,
      { subId: sub.id, merchant: sub.merchant },
    );
  }
}

// ── 7. Approval required ───────────────────────────────────────
// Triggered for high-value annual subscriptions at risk
export async function checkAndSendApprovalAlerts(subscriptions: Subscription[]) {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const highValue = subscriptions.filter(
    s => s.status === 'at_risk' && s.annualCost > 10_000,
  );

  for (const sub of highValue) {
    const amt = `$${Math.round(sub.annualCost).toLocaleString()}`;
    await sendNow(
      `approval-${sub.id}`,
      'approval_required',
      `Approval required — ${amt}`,
      'Discount exceeds threshold',
      `Customer: ${sub.merchant}`,
      { subId: sub.id, merchant: sub.merchant, amount: sub.annualCost },
    );
  }
}

// ── 8. Customer responded ──────────────────────────────────────
// Call this manually when a CRM event comes in, or simulate on data refresh
export async function sendCustomerRespondedAlert(merchant: string, subId: string) {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  await sendNow(
    `responded-${subId}`,
    'customer_responded',
    'Customer responded',
    merchant,
    undefined,
    { subId, merchant },
  );
}

// ── 9. Payment failed ──────────────────────────────────────────
// Triggered when a billing failure is flagged on the subscription
export async function checkAndSendPaymentFailedAlerts(subscriptions: Subscription[]) {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const failed = subscriptions.filter(s => s.isPaymentFailed === true);

  for (const sub of failed) {
    const amt = `$${Math.round(sub.amountPerOccurrence).toLocaleString()}`;
    await sendNow(
      `payment-failed-${sub.id}`,
      'payment_failed',
      'Payment failed',
      `${amt} charge declined`,
      `Customer: ${sub.merchant}`,
      { subId: sub.id, merchant: sub.merchant, amount: sub.amountPerOccurrence },
    );
  }
}

// ── 10. Churn risk elevated ────────────────────────────────────
// Triggered when churnScore exceeds threshold (high probability of cancellation)
export async function checkAndSendChurnRiskAlerts(subscriptions: Subscription[]) {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const atRisk = subscriptions.filter(
    s => s.status !== 'cancelled' && (s.churnScore ?? 0) >= 75,
  );

  for (const sub of atRisk) {
    const score = Math.round(sub.churnScore!);
    await sendNow(
      `churn-risk-${sub.id}`,
      'churn_risk',
      `Churn risk elevated — ${score}%`,
      `Customer: ${sub.merchant}`,
      `Intervention recommended`,
      { subId: sub.id, merchant: sub.merchant, churnScore: sub.churnScore },
    );
  }
}

// ── 11. Health score drop ──────────────────────────────────────
// Triggered when health score drops by 20+ points since last check
export async function checkAndSendHealthScoreDropAlerts(subscriptions: Subscription[]) {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const dropped = subscriptions.filter(s => {
    if (s.healthScore == null || s.previousHealthScore == null) return false;
    return s.previousHealthScore - s.healthScore >= 20;
  });

  for (const sub of dropped) {
    const delta = Math.round(sub.previousHealthScore! - sub.healthScore!);
    const score = Math.round(sub.healthScore!);
    await sendNow(
      `health-drop-${sub.id}`,
      'health_score_drop',
      `Health score dropped — ${score}/100`,
      `Down ${delta} points`,
      `Customer: ${sub.merchant}`,
      { subId: sub.id, merchant: sub.merchant, healthScore: sub.healthScore },
    );
  }
}

// ── 12. Price increase detected ────────────────────────────────
// Triggered when amountPerOccurrence increases >10% vs previousAmount
export async function checkAndSendPriceIncreaseAlerts(subscriptions: Subscription[]) {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const increased = subscriptions.filter(s => {
    if (!s.previousAmount || s.previousAmount <= 0) return false;
    const changePct = ((s.amountPerOccurrence - s.previousAmount) / s.previousAmount) * 100;
    return changePct > 10;
  });

  for (const sub of increased) {
    const prev = `$${Math.round(sub.previousAmount!).toLocaleString()}`;
    const curr = `$${Math.round(sub.amountPerOccurrence).toLocaleString()}`;
    const pct = Math.round(((sub.amountPerOccurrence - sub.previousAmount!) / sub.previousAmount!) * 100);
    await sendNow(
      `price-increase-${sub.id}`,
      'price_increase',
      `Price increase detected — +${pct}%`,
      `${prev} → ${curr}`,
      `Customer: ${sub.merchant}`,
      { subId: sub.id, merchant: sub.merchant, previousAmount: sub.previousAmount, newAmount: sub.amountPerOccurrence },
    );
  }
}

// ── 13. Upsell opportunity ─────────────────────────────────────
// Triggered for active high-confidence subs with expansion revenue potential
export async function checkAndSendUpsellOpportunityAlerts(subscriptions: Subscription[]) {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const opportunities = subscriptions.filter(
    s => s.status === 'active'
      && s.confidence >= 0.8
      && (s.expansionRevenuePotential ?? 0) > 5_000,
  );

  for (const sub of opportunities) {
    const potential = `$${Math.round(sub.expansionRevenuePotential!).toLocaleString()}`;
    await sendNow(
      `upsell-${sub.id}`,
      'upsell_opportunity',
      'Upsell opportunity identified',
      `+${potential} ARR potential`,
      `Customer: ${sub.merchant}`,
      { subId: sub.id, merchant: sub.merchant, potential: sub.expansionRevenuePotential },
    );
  }
}

// ── 14. Contract expiring soon ─────────────────────────────────
// Triggered when contractEndDate is within 30 days
export async function checkAndSendContractExpiringAlerts(subscriptions: Subscription[]) {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const now = new Date();
  const expiringSoon = subscriptions.filter(s => {
    if (!s.contractEndDate || s.status === 'cancelled') return false;
    const endDate = new Date(s.contractEndDate);
    const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / 86_400_000);
    return daysLeft >= 0 && daysLeft <= 30;
  });

  for (const sub of expiringSoon) {
    const endDate = new Date(sub.contractEndDate!);
    const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / 86_400_000);
    const amt = `$${Math.round(sub.annualCost).toLocaleString()}`;
    await sendNow(
      `contract-expiring-${sub.id}`,
      'contract_expiring',
      `Contract expiring in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
      `${amt} at stake`,
      `Customer: ${sub.merchant}`,
      { subId: sub.id, merchant: sub.merchant, annualCost: sub.annualCost, daysLeft },
    );
  }
}

// ── Run all signal checks at once ─────────────────────────────
export async function runAllAlertChecks(subscriptions: Subscription[]) {
  await Promise.all([
    checkAndSendUsageDropAlerts(subscriptions),
    checkAndSendEngagementAlerts(subscriptions),
    checkAndSendRenewalWindowAlerts(subscriptions),
    checkAndSendInactiveCustomerAlerts(subscriptions),
    checkAndSendCommitmentRiskAlerts(subscriptions),
    checkAndSendApprovalAlerts(subscriptions),
    checkAndSendPaymentFailedAlerts(subscriptions),
    checkAndSendChurnRiskAlerts(subscriptions),
    checkAndSendHealthScoreDropAlerts(subscriptions),
    checkAndSendPriceIncreaseAlerts(subscriptions),
    checkAndSendUpsellOpportunityAlerts(subscriptions),
    checkAndSendContractExpiringAlerts(subscriptions),
  ]);
}
