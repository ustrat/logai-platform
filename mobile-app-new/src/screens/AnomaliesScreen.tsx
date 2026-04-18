import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Platform, Modal, Pressable,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { inferenceApi } from '../services/api';
import { Colors } from '../theme';

const FILTERS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 0.85) return { label: 'CRITICAL', color: Colors.red };
  if (score >= 0.70) return { label: 'HIGH', color: '#f97316' };
  if (score >= 0.55) return { label: 'MEDIUM', color: Colors.amber };
  return { label: 'LOW', color: Colors.green };
}

export default function AnomaliesScreen() {
  const [accountId, setAccountId] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [selected, setSelected] = useState<any>(null);

  // Load real account IDs from the ML service
  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await inferenceApi.accounts();
      return (res.data as any).accounts as string[];
    },
    staleTime: 60_000,
  });

  const accounts = accountsData?.slice(0, 10) || [];

  // Set first account once loaded
  const currentAccountId = accountId || accounts[0] || '';

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['analyze', currentAccountId],
    queryFn: async () => {
      const res = await inferenceApi.analyze({ account_id: currentAccountId, limit: 500 });
      return res.data.data;
    },
    enabled: !!currentAccountId,
  });

  const allAnomalies: any[] = data?.anomalies?.filter((a: any) => a.is_anomaly) || [];

  const filtered = allAnomalies.filter((a: any) => {
    if (filter === 'ALL') return true;
    return getScoreLabel(a.anomaly_score).label === filter;
  });

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={Colors.amber} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>ML ANOMALY DETECTION</Text>
          <Text style={styles.headerTitle}>Anomalies</Text>
        </View>

        {/* Account selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountScroll}>
          {accounts.map(acc => (
            <TouchableOpacity
              key={acc}
              style={[styles.chip, currentAccountId === acc && styles.chipActive]}
              onPress={() => setAccountId(acc)}
            >
              <Text style={[styles.chipText, currentAccountId === acc && styles.chipTextActive]}>{acc}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Severity filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {isLoading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={Colors.amber} />
            <Text style={styles.loadingText}>RUNNING ANOMALY DETECTION...</Text>
          </View>
        )}

        {isError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠ Cannot reach API. Check Settings → API URL</Text>
          </View>
        )}

        {data && (
          <>
            {/* Summary row */}
            <View style={styles.summaryRow}>
              <SummaryPill label="TOTAL" count={allAnomalies.length} color={Colors.textMuted} />
              <SummaryPill label="CRITICAL" count={allAnomalies.filter(a => getScoreLabel(a.anomaly_score).label === 'CRITICAL').length} color={Colors.red} />
              <SummaryPill label="HIGH" count={allAnomalies.filter(a => getScoreLabel(a.anomaly_score).label === 'HIGH').length} color="#f97316" />
              <SummaryPill label="MEDIUM" count={allAnomalies.filter(a => getScoreLabel(a.anomaly_score).label === 'MEDIUM').length} color={Colors.amber} />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>FLAGGED TRANSACTIONS</Text>
              <Text style={styles.sectionCount}>{filtered.length} shown</Text>
            </View>

            {filtered.length === 0 && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No anomalies detected for this filter ✓</Text>
              </View>
            )}

            {filtered.map((a: any) => {
              const { label, color } = getScoreLabel(a.anomaly_score);
              return (
                <TouchableOpacity key={a.transaction_id} style={styles.card} onPress={() => setSelected(a)} activeOpacity={0.75}>
                  <View style={[styles.cardAccent, { backgroundColor: color }]} />
                  <View style={styles.cardBody}>
                    <View style={styles.cardTop}>
                      <Text style={styles.txnId}>{a.transaction_id.substring(0, 16)}...</Text>
                      <View style={[styles.badge, { backgroundColor: color + '33' }]}>
                        <Text style={[styles.badgeText, { color }]}>{label}</Text>
                      </View>
                      <Text style={[styles.scoreText, { color }]}>{(a.anomaly_score * 100).toFixed(0)}%</Text>
                    </View>
                    {/* Score bar */}
                    <View style={styles.barBg}>
                      <View style={[styles.barFill, { width: `${a.anomaly_score * 100}%` as any, backgroundColor: color }]} />
                    </View>
                    {a.reasons?.length > 0 && (
                      <Text style={styles.reason} numberOfLines={1}>{a.reasons[0]}</Text>
                    )}
                    <Text style={styles.tapHint}>Tap for details →</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Detail modal */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {selected && <AnomalyDetail anomaly={selected} onClose={() => setSelected(null)} />}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function AnomalyDetail({ anomaly, onClose }: { anomaly: any; onClose: () => void }) {
  const { label, color } = getScoreLabel(anomaly.anomaly_score);
  return (
    <ScrollView>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>ANOMALY DETAIL</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.modalBadgeRow]}>
        <View style={[styles.badge, { backgroundColor: color + '33' }]}>
          <Text style={[styles.badgeText, { color }]}>{label}</Text>
        </View>
        <Text style={[styles.modalScore, { color }]}>{(anomaly.anomaly_score * 100).toFixed(1)}% anomaly score</Text>
      </View>

      <DetailRow label="TRANSACTION ID" value={anomaly.transaction_id} mono />
      <DetailRow label="ACCOUNT" value={anomaly.account_id} />
      <DetailRow label="AMOUNT" value={anomaly.amount != null ? `$${Number(anomaly.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'N/A'} mono />
      <DetailRow label="DATE" value={anomaly.date || 'N/A'} />
      <DetailRow label="MERCHANT" value={anomaly.merchant_name || anomaly.description || 'N/A'} />
      <DetailRow label="CATEGORY" value={anomaly.category || 'N/A'} />

      {anomaly.reasons?.length > 0 && (
        <View style={styles.reasonsBox}>
          <Text style={styles.reasonsTitle}>DETECTION REASONS</Text>
          {anomaly.reasons.map((r: string, i: number) => (
            <View key={i} style={styles.reasonRow}>
              <Text style={styles.reasonBullet}>›</Text>
              <Text style={styles.reasonText}>{r}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

function SummaryPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={[styles.summaryPill, { borderColor: color + '55' }]}>
      <Text style={[styles.summaryCount, { color }]}>{count}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const mono = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: Colors.bgBase },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 14 },
  headerLabel: { fontSize: 10, letterSpacing: 3, color: Colors.amber, marginBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, fontFamily: mono },
  accountScroll: { marginBottom: 10 },
  filterScroll: { marginBottom: 14 },
  chip: { borderWidth: 1, borderColor: Colors.border, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, backgroundColor: Colors.bgSurface },
  chipActive: { borderColor: Colors.amber, backgroundColor: Colors.amberDim },
  chipText: { fontSize: 11, color: Colors.textMuted, letterSpacing: 1 },
  chipTextActive: { color: Colors.amber },
  filterChip: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 5, marginRight: 8, backgroundColor: Colors.bgSurface },
  filterChipActive: { borderColor: Colors.amber, backgroundColor: Colors.amberDim },
  filterChipText: { fontSize: 10, color: Colors.textMuted, letterSpacing: 1.5 },
  filterChipTextActive: { color: Colors.amber, fontWeight: '700' },
  loadingBox: { alignItems: 'center', padding: 40, gap: 12 },
  loadingText: { color: Colors.amber, letterSpacing: 2, fontSize: 11 },
  errorBox: { backgroundColor: Colors.redDim, borderWidth: 1, borderColor: Colors.red, padding: 12, borderRadius: 4, marginBottom: 16 },
  errorText: { color: Colors.red, fontSize: 12 },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryPill: { flex: 1, backgroundColor: Colors.bgSurface, borderWidth: 1, borderRadius: 4, padding: 10, alignItems: 'center' },
  summaryCount: { fontSize: 20, fontWeight: '700' },
  summaryLabel: { fontSize: 8, letterSpacing: 1.5, color: Colors.textMuted, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 10, letterSpacing: 3, color: Colors.textMuted },
  sectionCount: { fontSize: 11, color: Colors.amber },
  emptyBox: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, padding: 20, borderRadius: 4, alignItems: 'center' },
  emptyText: { color: Colors.textMuted, fontSize: 12 },
  card: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderRadius: 4, marginBottom: 8, flexDirection: 'row', overflow: 'hidden' },
  cardAccent: { width: 3 },
  cardBody: { flex: 1, padding: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  txnId: { fontSize: 11, color: Colors.amber, fontFamily: mono, flex: 1 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2 },
  badgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  scoreText: { fontSize: 12, fontWeight: '700', fontFamily: mono },
  barBg: { height: 3, backgroundColor: Colors.border, borderRadius: 2, marginBottom: 8 },
  barFill: { height: 3, borderRadius: 2 },
  reason: { fontSize: 11, color: Colors.textSecondary, marginBottom: 4 },
  tapHint: { fontSize: 9, color: Colors.textMuted, letterSpacing: 1 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.bgSurface, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderTopWidth: 1, borderColor: Colors.borderBright, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 11, letterSpacing: 3, color: Colors.amber },
  closeBtn: { padding: 4 },
  closeBtnText: { color: Colors.textMuted, fontSize: 16 },
  modalBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  modalScore: { fontSize: 13, fontWeight: '700' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailLabel: { fontSize: 10, letterSpacing: 1.5, color: Colors.textMuted },
  detailValue: { fontSize: 12, color: Colors.textPrimary, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  mono: { fontFamily: mono },
  reasonsBox: { marginTop: 16, backgroundColor: Colors.bgElevated, padding: 14, borderRadius: 4 },
  reasonsTitle: { fontSize: 10, letterSpacing: 2, color: Colors.textMuted, marginBottom: 10 },
  reasonRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  reasonBullet: { color: Colors.amber, fontSize: 14 },
  reasonText: { fontSize: 12, color: Colors.textSecondary, flex: 1 },
});
