import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { inferenceApi, plaidApi } from '../services/api';
import { Colors, SEVERITY_COLORS } from '../theme';
import { router } from 'expo-router';

export default function DashboardScreen() {
  const [accountId, setAccountId] = useState('');

  // Load real account IDs from ML service
  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await inferenceApi.accounts();
      return (res.data as any).accounts as string[];
    },
    staleTime: 60_000,
  });

  const accounts = accountsData?.slice(0, 8) || [];
  const currentAccountId = accountId || accounts[0] || '';

  // Plaid connection status
  const { data: plaidStatus } = useQuery({
    queryKey: ['plaid-status'],
    queryFn: async () => {
      const res = await plaidApi.status();
      return res.data.data as { connected: boolean; institution?: string; accountCount?: number };
    },
    staleTime: 30_000,
  });

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['analyze', currentAccountId],
    queryFn: async () => {
      const res = await inferenceApi.analyze({ account_id: currentAccountId, limit: 200 });
      return res.data.data;
    },
    enabled: !!currentAccountId,
  });

  const trainMutation = useMutation({ mutationFn: () => inferenceApi.train() });

  const anomalies = data?.anomalies || [];
  const recommendations = data?.recommendations || [];
  const flagged = anomalies.filter((a: any) => a.is_anomaly);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={Colors.amber} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>TRANSACTION INTELLIGENCE</Text>
        <Text style={styles.headerTitle}>Dashboard</Text>
      </View>

      {/* Plaid connection banner */}
      {plaidStatus && (
        <TouchableOpacity
          style={[styles.plaidBanner, { borderColor: plaidStatus.connected ? Colors.green : Colors.amber }]}
          onPress={() => router.push('/(tabs)/connect' as any)}
          activeOpacity={0.8}
        >
          <View style={[styles.plaidDot, { backgroundColor: plaidStatus.connected ? Colors.green : Colors.textMuted }]} />
          <Text style={[styles.plaidBannerText, { color: plaidStatus.connected ? Colors.green : Colors.textMuted }]}>
            {plaidStatus.connected
              ? `PLAID · ${plaidStatus.institution || 'CONNECTED'} · ${plaidStatus.accountCount || 0} accounts`
              : 'PLAID · NOT CONNECTED — Tap to link bank'}
          </Text>
          <Text style={styles.plaidArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Account selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountScroll}>
        {accounts.map(acc => (
          <TouchableOpacity
            key={acc}
            style={[styles.accountChip, currentAccountId === acc && styles.accountChipActive]}
            onPress={() => setAccountId(acc)}
          >
            <Text style={[styles.accountChipText, currentAccountId === acc && styles.accountChipTextActive]}>
              {acc}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Train button */}
      <TouchableOpacity
        style={styles.trainBtn}
        onPress={() => trainMutation.mutate()}
        disabled={trainMutation.isPending}
      >
        <Text style={styles.trainBtnText}>
          {trainMutation.isPending ? 'TRAINING MODEL...' : '⚡ RETRAIN MODEL'}
        </Text>
      </TouchableOpacity>

      {isLoading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={Colors.amber} />
          <Text style={styles.loadingText}>RUNNING INFERENCE ENGINE...</Text>
        </View>
      )}

      {isError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠ Cannot reach API. Check your IP address in api.ts</Text>
        </View>
      )}

      {data && (
        <>
          {/* Stat cards */}
          <View style={styles.statsGrid}>
            <StatCard label="ANALYZED" value={data.transactions_analyzed} color={Colors.blue} />
            <StatCard label="ANOMALIES" value={flagged.length} color={Colors.red} highlight={flagged.length > 0} />
            <StatCard label="PATTERNS" value={data.patterns?.patterns?.length || 0} color={Colors.amber} />
            <StatCard label="ALERTS" value={recommendations.length} color={Colors.green} />
          </View>

          {/* Recommendations */}
          <SectionHeader title="RECOMMENDATIONS" count={recommendations.length} />
          {recommendations.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No recommendations — account looks clean ✓</Text>
            </View>
          )}
          {recommendations.map((rec: any, i: number) => (
            <View key={i} style={[styles.recCard, { borderLeftColor: SEVERITY_COLORS[rec.severity] || Colors.border }]}>
              <View style={styles.recTop}>
                <View style={[styles.badge, { backgroundColor: (SEVERITY_COLORS[rec.severity] || Colors.border) + '33' }]}>
                  <Text style={[styles.badgeText, { color: SEVERITY_COLORS[rec.severity] }]}>
                    {rec.severity.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.recCategory}>{rec.category}</Text>
                <Text style={styles.recConfidence}>{Math.round(rec.confidence * 100)}%</Text>
              </View>
              <Text style={styles.recMessage}>{rec.message}</Text>
              <Text style={styles.recAction}>→ {rec.recommended_action}</Text>
            </View>
          ))}

          {/* Flagged transactions */}
          <SectionHeader title="FLAGGED TRANSACTIONS" count={flagged.length} />
          {flagged.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No anomalies detected ✓</Text>
            </View>
          )}
          {flagged.slice(0, 15).map((a: any) => (
            <View key={a.transaction_id} style={styles.txnCard}>
              <View style={styles.txnTop}>
                <Text style={styles.txnId}>{a.transaction_id.substring(0, 12)}...</Text>
                <ScorePill score={a.anomaly_score} />
              </View>
              <View style={styles.scoreBarBg}>
                <View style={[styles.scoreBarFill, {
                  width: `${a.anomaly_score * 100}%` as any,
                  backgroundColor: a.anomaly_score >= 0.85 ? Colors.red : a.anomaly_score >= 0.7 ? Colors.amber : Colors.blue,
                }]} />
              </View>
              {a.reasons.length > 0 && (
                <Text style={styles.txnReasons}>{a.reasons[0]}</Text>
              )}
            </View>
          ))}

          {/* Patterns */}
          {data.patterns?.patterns?.length > 0 && (
            <>
              <SectionHeader title="DETECTED PATTERNS" count={data.patterns.patterns.length} />
              {data.patterns.patterns.map((p: any, i: number) => (
                <View key={i} style={styles.patternCard}>
                  <Text style={styles.patternType}>{p.type.replace(/_/g, ' ').toUpperCase()}</Text>
                  {Object.entries(p)
                    .filter(([k]) => k !== 'type')
                    .slice(0, 3)
                    .map(([k, v]) => (
                      <View key={k} style={styles.patternRow}>
                        <Text style={styles.patternKey}>{k.replace(/_/g, ' ')}</Text>
                        <Text style={styles.patternVal}>
                          {typeof v === 'number' ? (Number.isInteger(v) ? v : (v as number).toFixed(2)) : String(v).substring(0, 25)}
                        </Text>
                      </View>
                    ))}
                </View>
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function StatCard({ label, value, color, highlight }: any) {
  return (
    <View style={[styles.statCard, highlight && { borderColor: color }]}>
      <Text style={[styles.statValue, { color: highlight ? color : Colors.textPrimary }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ScorePill({ score }: { score: number }) {
  const color = score >= 0.85 ? Colors.red : score >= 0.7 ? Colors.amber : Colors.blue;
  return (
    <View style={[styles.scorePill, { backgroundColor: color + '33' }]}>
      <Text style={[styles.scorePillText, { color }]}>{(score * 100).toFixed(0)}%</Text>
    </View>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgBase },
  content: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 16 },
  headerLabel: { fontSize: 10, letterSpacing: 3, color: Colors.amber, marginBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
  plaidBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgSurface, borderWidth: 1, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, gap: 8 },
  plaidDot: { width: 7, height: 7, borderRadius: 4 },
  plaidBannerText: { fontSize: 10, letterSpacing: 1, flex: 1 },
  plaidArrow: { color: Colors.textMuted, fontSize: 12 },
  accountScroll: { marginBottom: 12 },
  accountChip: { borderWidth: 1, borderColor: Colors.border, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, backgroundColor: Colors.bgSurface },
  accountChipActive: { borderColor: Colors.amber, backgroundColor: Colors.amberDim },
  accountChipText: { fontSize: 11, color: Colors.textMuted, letterSpacing: 1 },
  accountChipTextActive: { color: Colors.amber },
  trainBtn: { backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border, padding: 10, borderRadius: 4, alignItems: 'center', marginBottom: 16 },
  trainBtnText: { color: Colors.amber, fontSize: 11, letterSpacing: 2 },
  loadingBox: { alignItems: 'center', padding: 40, gap: 12 },
  loadingText: { color: Colors.amber, letterSpacing: 2, fontSize: 11 },
  errorBox: { backgroundColor: Colors.redDim, borderWidth: 1, borderColor: Colors.red, padding: 12, borderRadius: 4, marginBottom: 16 },
  errorText: { color: Colors.red, fontSize: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, padding: 16, borderRadius: 4 },
  statValue: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary },
  statLabel: { fontSize: 9, letterSpacing: 2, color: Colors.textMuted, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 8 },
  sectionTitle: { fontSize: 10, letterSpacing: 3, color: Colors.textMuted },
  sectionCount: { fontSize: 11, color: Colors.amber },
  emptyBox: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, padding: 16, borderRadius: 4, marginBottom: 8 },
  emptyText: { color: Colors.textMuted, fontSize: 12, textAlign: 'center' },
  recCard: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3, padding: 14, borderRadius: 4, marginBottom: 8 },
  recTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2 },
  badgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  recCategory: { fontSize: 10, color: Colors.textMuted, flex: 1 },
  recConfidence: { fontSize: 10, color: Colors.textMuted },
  recMessage: { fontSize: 12, color: Colors.textPrimary, marginBottom: 6 },
  recAction: { fontSize: 11, color: Colors.amber },
  txnCard: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, padding: 12, borderRadius: 4, marginBottom: 8 },
  txnTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  txnId: { fontSize: 11, color: Colors.amber, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
  scoreBarBg: { height: 4, backgroundColor: Colors.border, borderRadius: 2, marginBottom: 6 },
  scoreBarFill: { height: 4, borderRadius: 2 },
  scorePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  scorePillText: { fontSize: 10, fontWeight: '700' },
  txnReasons: { fontSize: 11, color: Colors.textSecondary },
  patternCard: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, padding: 14, borderRadius: 4, marginBottom: 8 },
  patternType: { fontSize: 9, letterSpacing: 2, color: Colors.amber, marginBottom: 10 },
  patternRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  patternKey: { fontSize: 11, color: Colors.textMuted, textTransform: 'capitalize' },
  patternVal: { fontSize: 11, color: Colors.textPrimary, fontWeight: '700' },
});
