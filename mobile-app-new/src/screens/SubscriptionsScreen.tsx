import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Platform, TextInput,
  Modal, Pressable, Switch, Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { subscriptionsApi, plaidApi } from '../services/api';
import { router } from 'expo-router';
import { Colors } from '../theme';
import {
  requestNotificationPermission,
  scheduleRenewalAlerts,
  cancelAlert,
  snoozeAlert,
  getScheduledAlerts,
  runAllAlertChecks,
} from '../services/notifications';

const FREQ_COLORS: Record<string, { bg: string; color: string }> = {
  Monthly:   { bg: Colors.blueDim,                      color: Colors.blue },
  Quarterly: { bg: Colors.greenDim,                     color: Colors.green },
  Annual:    { bg: Colors.amberDim,                     color: Colors.amber },
  Weekly:    { bg: 'rgba(168,85,247,0.15)',              color: '#7c3aed' },
  Irregular: { bg: 'rgba(107,114,128,0.12)',             color: Colors.textMuted },
};

const STATUS_COLORS: Record<string, string> = {
  active:    Colors.green,
  cancelled: Colors.red,
  at_risk:   Colors.amber,
};

export default function SubscriptionsScreen() {
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState<'annualCost' | 'confidence' | 'nextExpected'>('nextExpected');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [showSort, setShowSort] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [alertDays, setAlertDays] = useState(3);
  const [schedulingAlerts, setSchedulingAlerts] = useState(false);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const res = await subscriptionsApi.list(365, 0.4);
      return res.data.data as { subscriptions: any[]; summary: any; metadata: any };
    },
  });

  const { data: plaidStatus } = useQuery({
    queryKey: ['plaid-status'],
    queryFn: async () => {
      const res = await plaidApi.status();
      return res.data.data as { connected: boolean; institution?: string; accountCount?: number };
    },
    staleTime: 30_000,
  });

  const subs = data?.subscriptions || [];
  const summary = data?.summary;

  // Check permission + scheduled count on mount
  useEffect(() => {
    requestNotificationPermission().then(setPermissionGranted);
    getScheduledAlerts().then(n => {
      const renewalAlerts = n.filter(a => a.identifier.startsWith('renewal-'));
      setScheduledCount(renewalAlerts.length);
      setAlertsEnabled(renewalAlerts.length > 0);
    });
  }, []);

  // Run all signal checks whenever subscription data loads
  useEffect(() => {
    if (subs.length > 0 && alertsEnabled) {
      runAllAlertChecks(subs).catch(() => {});
    }
  }, [subs, alertsEnabled]);

  const handleToggleAlerts = useCallback(async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermission();
      setPermissionGranted(granted);
      if (!granted) {
        Alert.alert('Permission Required', 'Please enable notifications in your device Settings to receive renewal alerts.');
        return;
      }
      if (subs.length === 0) {
        Alert.alert('No Subscriptions', 'No subscriptions detected yet. Connect Plaid and refresh first.');
        return;
      }
      setSchedulingAlerts(true);
      try {
        const { scheduled, skipped } = await scheduleRenewalAlerts(subs, alertDays);
        setScheduledCount(scheduled);
        setAlertsEnabled(true);
        Alert.alert(
          'Alerts Scheduled',
          `${scheduled} renewal alert${scheduled !== 1 ? 's' : ''} scheduled (${alertDays} day${alertDays !== 1 ? 's' : ''} before charge).\n${skipped > 0 ? `${skipped} skipped (past or cancelled).` : ''}`,
        );
      } finally {
        setSchedulingAlerts(false);
      }
    } else {
      const { cancelAllScheduledNotificationsAsync } = await import('expo-notifications');
      await cancelAllScheduledNotificationsAsync();
      setScheduledCount(0);
      setAlertsEnabled(false);
    }
  }, [subs, alertDays]);

  const handleReschedule = useCallback(async () => {
    if (subs.length === 0) return;
    setSchedulingAlerts(true);
    try {
      const { scheduled } = await scheduleRenewalAlerts(subs, alertDays);
      setScheduledCount(scheduled);
      Alert.alert('Alerts Updated', `${scheduled} renewal alert${scheduled !== 1 ? 's' : ''} rescheduled.`);
    } finally {
      setSchedulingAlerts(false);
    }
  }, [subs, alertDays]);

  const filtered = subs
    .filter(s => !filterStatus || s.status === filterStatus)
    .filter(s => !search || s.merchant.toLowerCase().includes(search.toLowerCase()))
    .sort((a: any, b: any) => {
      if (sortBy === 'annualCost') return b.annualCost - a.annualCost;
      if (sortBy === 'confidence') return b.confidence - a.confidence;
      return new Date(a.nextExpected).getTime() - new Date(b.nextExpected).getTime();
    });

  const daysUntil = (dateStr: string) => {
    if (!dateStr) return null;
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
    return diff;
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={Colors.amber} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>ML SUBSCRIPTION DETECTION</Text>
          <Text style={styles.headerTitle}>Subscriptions</Text>
        </View>

        {/* Plaid connection banner */}
        {plaidStatus && (
          <TouchableOpacity
            style={[styles.plaidBanner, { borderColor: plaidStatus.connected ? Colors.green : Colors.amber }]}
            onPress={() => router.push('/(tabs)/connect' as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.plaidDot, { backgroundColor: plaidStatus.connected ? Colors.green : Colors.textMuted }]} />
            <Text style={[styles.plaidBannerText, { color: plaidStatus.connected ? Colors.green : Colors.amber }]}>
              {plaidStatus.connected
                ? `PLAID · ${plaidStatus.institution || 'CONNECTED'} · Subscription data active`
                : 'PLAID · NOT CONNECTED — Tap to link bank for live data'}
            </Text>
            <Text style={styles.plaidArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* ── Alert Settings Card ─────────────────────────── */}
        <View style={[styles.alertCard, alertsEnabled && { borderColor: Colors.green }]}>
          <View style={styles.alertCardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertCardTitle}>Renewal Alerts</Text>
              <Text style={styles.alertCardSub}>
                {alertsEnabled
                  ? `${scheduledCount} alert${scheduledCount !== 1 ? 's' : ''} scheduled · ${alertDays}d before charge`
                  : 'Get notified before subscriptions renew'}
              </Text>
            </View>
            {schedulingAlerts
              ? <ActivityIndicator color={Colors.green} />
              : (
                <Switch
                  value={alertsEnabled}
                  onValueChange={handleToggleAlerts}
                  trackColor={{ false: Colors.border, true: Colors.green + '88' }}
                  thumbColor={alertsEnabled ? Colors.green : Colors.textMuted}
                />
              )}
          </View>

          {/* Days-before selector */}
          <View style={styles.daysRow}>
            <Text style={styles.daysLabel}>ALERT ME</Text>
            {[1, 2, 3, 5, 7].map(d => (
              <TouchableOpacity
                key={d}
                style={[styles.dayChip, alertDays === d && styles.dayChipActive]}
                onPress={() => setAlertDays(d)}
              >
                <Text style={[styles.dayChipText, alertDays === d && styles.dayChipTextActive]}>
                  {d}d
                </Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.daysLabel}>BEFORE</Text>
          </View>

          {alertsEnabled && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TouchableOpacity style={[styles.rescheduleBtn, { flex: 1 }]} onPress={handleReschedule} disabled={schedulingAlerts}>
                <Text style={styles.rescheduleBtnText}>↺ Reschedule</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rescheduleBtn, { flex: 1 }]}
                onPress={async () => {
                  if (subs.length === 0) return;
                  await runAllAlertChecks(subs);
                  Alert.alert('Signal Check Complete', 'All risk signals have been evaluated and alerts sent where conditions are met.');
                }}
              >
                <Text style={styles.rescheduleBtnText}>⚡ Run checks now</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Test notification button */}
          <TouchableOpacity
            style={styles.testNotifBtn}
            onPress={async () => {
              try {
                const Notifications = await import('expo-notifications');
                const { status } = await Notifications.getPermissionsAsync();
                if (status !== 'granted') {
                  const { status: newStatus } = await Notifications.requestPermissionsAsync();
                  if (newStatus !== 'granted') {
                    Alert.alert('Permission Denied', 'Enable notifications in device Settings first.');
                    return;
                  }
                }
                await Notifications.scheduleNotificationAsync({
                  identifier: 'test-notification',
                  content: {
                    title: 'Renewal at risk — $12,400',
                    body: 'Customer: Acme Corp',
                    subtitle: 'Due in 3 days · Annual',
                    sound: true,
                    badge: 1,
                  },
                  trigger: null,
                });
                Alert.alert('✓ Test Sent', 'Notification dispatched. If you don\'t see it, a new EAS build is required to enable the native notification module.');
              } catch (e: any) {
                Alert.alert('Native Module Missing', 'Notifications require a new EAS build.\n\nRun: eas build --platform android --profile development\n\n' + e.message);
              }
            }}
          >
            <Text style={styles.testNotifBtnText}>🔔 Test Notification</Text>
          </TouchableOpacity>

          {permissionGranted === false && (
            <View style={styles.permWarning}>
              <Text style={styles.permWarningText}>⚠ Notification permission denied — enable in device Settings</Text>
            </View>
          )}
        </View>

        {isLoading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={Colors.amber} />
            <Text style={styles.loadingText}>DETECTING SUBSCRIPTIONS...</Text>
          </View>
        )}

        {isError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠ No Plaid connection or data unavailable. Connect your bank first.</Text>
          </View>
        )}

        {summary && (
          <>
            {/* KPI cards */}
            <View style={styles.kpiGrid}>
              <KPICard label="EST. MONTHLY" value={`$${Math.round(summary.totalMonthlyEstimate).toLocaleString()}`} color={Colors.blue} />
              <KPICard label="EST. ANNUAL"  value={`$${Math.round(summary.totalAnnualEstimate).toLocaleString()}`} color="#7c3aed" />
              <KPICard label="DETECTED"     value={String(summary.subscriptionCount)} color={Colors.green} sub={`${summary.highConfidenceCount} high conf.`} />
              <KPICard label="AT RISK"      value={String(summary.atRiskCount)} color={summary.atRiskCount > 0 ? Colors.red : Colors.green} />
            </View>

            {/* Frequency breakdown */}
            {summary.byFrequency && Object.keys(summary.byFrequency).length > 0 && (
              <View style={styles.breakdownCard}>
                <Text style={styles.breakdownTitle}>BY FREQUENCY</Text>
                {Object.entries(summary.byFrequency).map(([freq, count]: [string, any]) => {
                  const fc = FREQ_COLORS[freq] || FREQ_COLORS.Irregular;
                  const pct = summary.subscriptionCount > 0 ? (count / summary.subscriptionCount) * 100 : 0;
                  return (
                    <View key={freq} style={styles.freqRow}>
                      <View style={[styles.freqBadge, { backgroundColor: fc.bg }]}>
                        <Text style={[styles.freqBadgeText, { color: fc.color }]}>{freq}</Text>
                      </View>
                      <View style={styles.freqBar}>
                        <View style={[styles.freqBarFill, { width: `${pct}%` as any, backgroundColor: fc.color }]} />
                      </View>
                      <Text style={[styles.freqCount, { color: fc.color }]}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Search + filters */}
            <TextInput
              style={styles.searchInput}
              placeholder="Search merchant..."
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />

            <View style={styles.filterRow}>
              {(['', 'active', 'at_risk', 'cancelled'] as const).map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusChip, filterStatus === s && styles.statusChipActive]}
                  onPress={() => setFilterStatus(s)}
                >
                  <Text style={[styles.statusChipText, filterStatus === s && { color: Colors.navy }]}>
                    {s === '' ? 'ALL' : s.replace('_', ' ').toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.sortBtn} onPress={() => setShowSort(true)}>
                <Text style={styles.sortBtnText}>SORT ▾</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.countRow}>
              <Text style={styles.countText}>{filtered.length} of {subs.length} subscriptions</Text>
            </View>

            {filtered.length === 0 && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No subscriptions match your filters.</Text>
              </View>
            )}

            {filtered.map((sub: any) => {
              const fc = FREQ_COLORS[sub.frequencyLabel] || FREQ_COLORS.Irregular;
              const statusColor = STATUS_COLORS[sub.status] || Colors.textMuted;
              const days = daysUntil(sub.nextExpected);
              const urgent = days !== null && days >= 0 && days <= alertDays;
              return (
                <TouchableOpacity
                  key={sub.id}
                  style={[styles.card, urgent && styles.cardUrgent]}
                  onPress={() => setSelected(sub)}
                  activeOpacity={0.75}
                >
                  {urgent && (
                    <View style={styles.urgentBanner}>
                      <Text style={styles.urgentBannerText}>
                        🔔 Renews in {days === 0 ? 'today' : `${days} day${days !== 1 ? 's' : ''}`}
                      </Text>
                    </View>
                  )}
                  <View style={styles.cardTop}>
                    <Text style={styles.merchant} numberOfLines={1}>{sub.merchant}</Text>
                    <Text style={[styles.amount, { color: Colors.textPrimary }]}>
                      ${sub.amountPerOccurrence.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View style={styles.cardMid}>
                    <View style={[styles.freqBadge, { backgroundColor: fc.bg }]}>
                      <Text style={[styles.freqBadgeText, { color: fc.color }]}>{sub.frequencyLabel}</Text>
                    </View>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.statusLabel, { color: statusColor }]}>
                      {sub.status.replace('_', ' ').toUpperCase()}
                    </Text>
                    <Text style={styles.annualLabel}>${Math.round(sub.annualCost).toLocaleString()}/yr</Text>
                  </View>
                  <View style={styles.confRow}>
                    <View style={styles.confBg}>
                      <View style={[styles.confFill, {
                        width: `${sub.confidence * 100}%` as any,
                        backgroundColor: sub.confidence >= 0.8 ? Colors.green : sub.confidence >= 0.6 ? Colors.amber : Colors.red,
                      }]} />
                    </View>
                    <Text style={styles.confPct}>{Math.round(sub.confidence * 100)}%</Text>
                  </View>
                  {sub.nextExpected && (
                    <Text style={[styles.nextCharge, urgent && { color: Colors.amber, fontWeight: '700' }]}>
                      Next: {sub.nextExpected}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Sort modal */}
      <Modal visible={showSort} transparent animationType="fade" onRequestClose={() => setShowSort(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowSort(false)}>
          <View style={styles.sortModal}>
            <Text style={styles.sortModalTitle}>SORT BY</Text>
            {([['nextExpected', 'Next Charge'], ['annualCost', 'Annual Cost'], ['confidence', 'Confidence']] as const).map(([val, label]) => (
              <TouchableOpacity key={val} style={styles.sortOption} onPress={() => { setSortBy(val); setShowSort(false); }}>
                <Text style={[styles.sortOptionText, sortBy === val && { color: Colors.navy, fontWeight: '700' }]}>{label}</Text>
                {sortBy === val && <Text style={{ color: Colors.navy }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Detail modal */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {selected && (
              <SubDetail
                sub={selected}
                alertDays={alertDays}
                onClose={() => setSelected(null)}
                onSnooze={async () => {
                  await snoozeAlert(selected.id);
                  await cancelAlert(selected.id);
                  setSelected(null);
                  Alert.alert('Alert Snoozed', `You won't be reminded about ${selected.merchant} this cycle.`);
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function SubDetail({ sub, alertDays, onClose, onSnooze }: { sub: any; alertDays: number; onClose: () => void; onSnooze: () => void }) {
  const fc = FREQ_COLORS[sub.frequencyLabel] || FREQ_COLORS.Irregular;
  const statusColor = STATUS_COLORS[sub.status] || Colors.textMuted;
  const days = sub.nextExpected
    ? Math.ceil((new Date(sub.nextExpected).getTime() - Date.now()) / 86_400_000)
    : null;
  const urgent = days !== null && days >= 0 && days <= alertDays;

  return (
    <ScrollView>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>SUBSCRIPTION DETAIL</Text>
        <TouchableOpacity onPress={onClose}><Text style={{ color: Colors.textMuted, fontSize: 18 }}>✕</Text></TouchableOpacity>
      </View>
      <Text style={styles.detailMerchant}>{sub.merchant}</Text>
      <View style={styles.detailBadgeRow}>
        <View style={[styles.freqBadge, { backgroundColor: fc.bg }]}>
          <Text style={[styles.freqBadgeText, { color: fc.color }]}>{sub.frequencyLabel}</Text>
        </View>
        <Text style={[styles.statusLabel, { color: statusColor }]}>
          {sub.status.replace('_', ' ').toUpperCase()}
        </Text>
        {urgent && (
          <View style={styles.urgentPill}>
            <Text style={styles.urgentPillText}>🔔 {days === 0 ? 'Today' : `${days}d`}</Text>
          </View>
        )}
      </View>
      <DetailRow label="AMOUNT / OCCURRENCE" value={`$${sub.amountPerOccurrence.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
      <DetailRow label="ANNUAL COST"          value={`$${sub.annualCost.toLocaleString()}`} />
      <DetailRow label="OCCURRENCES"          value={`${sub.occurrences}x`} />
      <DetailRow label="CATEGORY"             value={sub.category?.replace(/_/g, ' ') || 'N/A'} />
      <DetailRow label="LAST CHARGED"         value={sub.lastCharged || 'N/A'} />
      <DetailRow label="NEXT EXPECTED"        value={sub.nextExpected || 'N/A'} highlight={urgent} />
      <DetailRow label="AMOUNT VARIANCE"      value={`±${sub.amountVariance?.toFixed(1) || 0}%`} />
      <DetailRow label="DAY VARIANCE"         value={`±${sub.dayVariance?.toFixed(1) || 0} days`} />
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>CONFIDENCE</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[styles.confBg, { width: 80 }]}>
            <View style={[styles.confFill, {
              width: `${sub.confidence * 100}%` as any,
              backgroundColor: sub.confidence >= 0.8 ? Colors.green : sub.confidence >= 0.6 ? Colors.amber : Colors.red,
            }]} />
          </View>
          <Text style={{ color: Colors.textPrimary, fontSize: 12, fontWeight: '700' }}>{Math.round(sub.confidence * 100)}%</Text>
        </View>
      </View>

      {sub.status !== 'cancelled' && (
        <TouchableOpacity style={styles.snoozeBtn} onPress={onSnooze}>
          <Text style={styles.snoozeBtnText}>🔕 Snooze alert for this subscription</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function KPICard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {sub && <Text style={styles.kpiSub}>{sub}</Text>}
    </View>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && { color: Colors.amber, fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

const mono = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

const styles = StyleSheet.create({
  testNotifBtn: { marginTop: 10, borderWidth: 1, borderColor: Colors.navy, borderRadius: 4, padding: 10, alignItems: 'center', backgroundColor: Colors.bgElevated },
  testNotifBtnText: { color: Colors.navy, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  plaidBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgSurface, borderWidth: 1, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, gap: 8 },
  plaidDot: { width: 7, height: 7, borderRadius: 4 },
  plaidBannerText: { fontSize: 10, letterSpacing: 1, flex: 1 },
  plaidArrow: { color: Colors.textMuted, fontSize: 12 },
  wrapper:      { flex: 1, backgroundColor: Colors.bgBase },
  container:    { flex: 1 },
  content:      { padding: 16, paddingBottom: 40 },
  header:       { marginBottom: 14 },
  headerLabel:  { fontSize: 10, letterSpacing: 3, color: Colors.amber, marginBottom: 4 },
  headerTitle:  { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, fontFamily: mono },

  // Alert card
  alertCard: {
    backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, padding: 14, marginBottom: 16,
  },
  alertCardTop:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  alertCardTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  alertCardSub:  { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  daysRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  daysLabel:     { fontSize: 9, letterSpacing: 1.5, color: Colors.textMuted },
  dayChip:       { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: Colors.bgElevated },
  dayChipActive: { borderColor: Colors.navy, backgroundColor: Colors.navy },
  dayChipText:   { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  dayChipTextActive: { color: '#fff' },
  rescheduleBtn: { marginTop: 10, padding: 8, borderRadius: 4, backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  rescheduleBtnText: { fontSize: 11, color: Colors.navy, fontWeight: '600', letterSpacing: 0.5 },
  permWarning:   { marginTop: 10, padding: 8, borderRadius: 4, backgroundColor: Colors.amberDim, borderWidth: 1, borderColor: Colors.amber },
  permWarningText: { fontSize: 11, color: '#92400e' },

  loadingBox:   { alignItems: 'center', padding: 40, gap: 12 },
  loadingText:  { color: Colors.amber, letterSpacing: 2, fontSize: 11 },
  errorBox:     { backgroundColor: Colors.redDim, borderWidth: 1, borderColor: Colors.red, padding: 14, borderRadius: 4, marginBottom: 16 },
  errorText:    { color: Colors.red, fontSize: 12, lineHeight: 18 },

  kpiGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  kpiCard:  { flex: 1, minWidth: '45%', backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, padding: 14, borderRadius: 4 },
  kpiValue: { fontSize: 22, fontWeight: '700', fontFamily: mono },
  kpiLabel: { fontSize: 9, letterSpacing: 2, color: Colors.textMuted, marginTop: 3 },
  kpiSub:   { fontSize: 9, color: Colors.textMuted, marginTop: 2 },

  breakdownCard:  { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, padding: 14, borderRadius: 4, marginBottom: 16 },
  breakdownTitle: { fontSize: 9, letterSpacing: 2, color: Colors.textMuted, marginBottom: 12 },
  freqRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  freqBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  freqBadgeText:  { fontSize: 10, fontWeight: '700' },
  freqBar:        { flex: 1, height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  freqBarFill:    { height: 6, borderRadius: 3 },
  freqCount:      { fontSize: 12, fontWeight: '700', width: 20, textAlign: 'right' },

  searchInput: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary, padding: 10, borderRadius: 4, fontSize: 13, marginBottom: 10 },
  filterRow:   { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  statusChip:      { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: Colors.bgSurface },
  statusChipActive: { borderColor: Colors.navy, backgroundColor: Colors.bgElevated },
  statusChipText:  { fontSize: 9, color: Colors.textMuted, letterSpacing: 1.5 },
  sortBtn:     { marginLeft: 'auto', borderWidth: 1, borderColor: Colors.border, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: Colors.bgElevated },
  sortBtnText: { fontSize: 9, color: Colors.navy, letterSpacing: 1, fontWeight: '700' },
  countRow:    { marginBottom: 10 },
  countText:   { fontSize: 11, color: Colors.textMuted },
  emptyBox:    { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, padding: 20, borderRadius: 4, alignItems: 'center' },
  emptyText:   { color: Colors.textMuted, fontSize: 12 },

  card:       { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderRadius: 6, padding: 14, marginBottom: 8, overflow: 'hidden' },
  cardUrgent: { borderColor: Colors.amber, borderWidth: 1.5 },
  urgentBanner:     { backgroundColor: Colors.amberDim, marginHorizontal: -14, marginTop: -14, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 10 },
  urgentBannerText: { fontSize: 11, color: '#92400e', fontWeight: '700' },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  merchant:   { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, flex: 1, marginRight: 8 },
  amount:     { fontSize: 14, fontWeight: '700', fontFamily: mono },
  cardMid:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  annualLabel: { fontSize: 10, color: Colors.textMuted, marginLeft: 'auto' },
  confRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  confBg:     { flex: 1, height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  confFill:   { height: 4, borderRadius: 2 },
  confPct:    { fontSize: 10, color: Colors.textMuted, width: 32, textAlign: 'right' },
  nextCharge: { fontSize: 10, color: Colors.textMuted },

  // Sort modal
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  sortModal:     { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 20, width: 240 },
  sortModalTitle: { fontSize: 10, letterSpacing: 2, color: Colors.navy, marginBottom: 14, fontWeight: '700' },
  sortOption:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sortOptionText: { fontSize: 13, color: Colors.textPrimary },

  // Detail modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:    { backgroundColor: Colors.bgSurface, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderTopWidth: 1, borderColor: Colors.border, padding: 20, maxHeight: '85%' },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle:   { fontSize: 11, letterSpacing: 3, color: Colors.navy, fontWeight: '700' },
  detailMerchant:  { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 10 },
  detailBadgeRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  urgentPill:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: Colors.amberDim },
  urgentPillText:  { fontSize: 11, color: '#92400e', fontWeight: '700' },
  detailRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailLabel:  { fontSize: 10, letterSpacing: 1.5, color: Colors.textMuted },
  detailValue:  { fontSize: 12, color: Colors.textPrimary, fontWeight: '600' },
  snoozeBtn:    { marginTop: 16, padding: 12, borderRadius: 4, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgElevated, alignItems: 'center' },
  snoozeBtnText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
});
