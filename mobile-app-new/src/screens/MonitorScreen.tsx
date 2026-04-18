import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import api, { inferenceApi, getApiBase } from '../services/api';
import { Colors } from '../theme';

const mono = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

export default function MonitorScreen() {
  const { data: health, isLoading: healthLoading, refetch: refetchHealth, isFetching: healthFetching } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      // Override baseURL so we hit /health (root) not /api/v1/health
      const res = await api.get('/health', { baseURL: getApiBase() });
      return res.data as { status: string; mlService?: string; timestamp?: string; version?: string };
    },
    refetchInterval: 30000,
  });

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['ml-summary'],
    queryFn: async () => {
      const res = await inferenceApi.summary();
      return res.data.data as any;
    },
    retry: 1,
  });

  const isOnline = health?.status === 'ok' || health?.status === 'healthy';
  const mlOnline = health?.mlService === 'ok' || health?.mlService === 'healthy' || health?.mlService === 'connected';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={healthFetching}
          onRefresh={() => { refetchHealth(); refetchSummary(); }}
          tintColor={Colors.amber}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>SYSTEM HEALTH</Text>
        <Text style={styles.headerTitle}>Monitor</Text>
      </View>

      {healthLoading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={Colors.amber} />
          <Text style={styles.loadingText}>CHECKING SYSTEM STATUS...</Text>
        </View>
      )}

      {health && (
        <>
          {/* Service status cards */}
          <View style={styles.serviceGrid}>
            <ServiceCard
              name="API SERVER"
              status={isOnline ? 'ONLINE' : 'OFFLINE'}
              online={isOnline}
              detail={health.version ? `v${health.version}` : undefined}
            />
            <ServiceCard
              name="ML SERVICE"
              status={mlOnline ? 'ONLINE' : (health.mlService ? health.mlService.toUpperCase() : 'UNKNOWN')}
              online={mlOnline}
            />
          </View>

          {health.timestamp && (
            <View style={styles.timestampRow}>
              <Text style={styles.timestampLabel}>LAST CHECKED</Text>
              <Text style={styles.timestampValue}>{new Date(health.timestamp).toLocaleTimeString()}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.refreshBtn} onPress={() => { refetchHealth(); refetchSummary(); }}>
            <Text style={styles.refreshBtnText}>↺ REFRESH STATUS</Text>
          </TouchableOpacity>
        </>
      )}

      {/* ML System Summary */}
      <SectionHeader title="ML SYSTEM SUMMARY" />

      {summaryLoading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={Colors.amber} />
          <Text style={styles.loadingText}>LOADING ML INFO...</Text>
        </View>
      )}

      {summary && (
        <>
          {summary.model_version && (
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>MODEL INFO</Text>
              <InfoRow label="MODEL VERSION" value={summary.model_version} />
              {summary.data_source && <InfoRow label="DATA SOURCE" value={summary.data_source} />}
              {summary.total_accounts != null && <InfoRow label="TOTAL ACCOUNTS" value={String(summary.total_accounts)} />}
              {summary.total_transactions != null && <InfoRow label="TOTAL TRANSACTIONS" value={String(summary.total_transactions)} />}
            </View>
          )}

          {summary.accounts && Array.isArray(summary.accounts) && (
            <>
              <Text style={styles.subSectionTitle}>ACCOUNTS IN SYSTEM</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountScroll}>
                {summary.accounts.map((acc: any, i: number) => (
                  <View key={i} style={styles.accountPill}>
                    <Text style={styles.accountPillText}>{typeof acc === 'string' ? acc : acc.account_id || JSON.stringify(acc)}</Text>
                  </View>
                ))}
              </ScrollView>
            </>
          )}

          {summary.anomaly_stats && (
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>ANOMALY STATISTICS</Text>
              {Object.entries(summary.anomaly_stats).map(([k, v]) => (
                <InfoRow key={k} label={k.replace(/_/g, ' ').toUpperCase()} value={String(v)} />
              ))}
            </View>
          )}
        </>
      )}

      {/* Auto-refresh note */}
      <View style={styles.noteBox}>
        <Text style={styles.noteText}>↺ Status refreshes automatically every 30 seconds. Pull down to refresh manually.</Text>
      </View>
    </ScrollView>
  );
}

function ServiceCard({ name, status, online, detail }: { name: string; status: string; online: boolean; detail?: string }) {
  const color = online ? Colors.green : Colors.red;
  return (
    <View style={[styles.serviceCard, { borderColor: color + '66' }]}>
      <View style={[styles.serviceDot, { backgroundColor: color }]} />
      <Text style={styles.serviceName}>{name}</Text>
      <Text style={[styles.serviceStatus, { color }]}>{status}</Text>
      {detail && <Text style={styles.serviceDetail}>{detail}</Text>}
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgBase },
  content: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 16 },
  headerLabel: { fontSize: 10, letterSpacing: 3, color: Colors.amber, marginBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, fontFamily: mono },
  loadingBox: { alignItems: 'center', padding: 32, gap: 12 },
  loadingText: { color: Colors.amber, letterSpacing: 2, fontSize: 11 },
  serviceGrid: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  serviceCard: { flex: 1, backgroundColor: Colors.bgSurface, borderWidth: 1, borderRadius: 4, padding: 14, alignItems: 'center' },
  serviceDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 8 },
  serviceName: { fontSize: 9, letterSpacing: 2, color: Colors.textMuted, marginBottom: 6 },
  serviceStatus: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  serviceDetail: { fontSize: 10, color: Colors.textMuted, marginTop: 4, fontFamily: mono },
  timestampRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, padding: 10, borderRadius: 4, marginBottom: 10 },
  timestampLabel: { fontSize: 10, letterSpacing: 1.5, color: Colors.textMuted },
  timestampValue: { fontSize: 11, color: Colors.textPrimary, fontFamily: mono },
  refreshBtn: { borderWidth: 1, borderColor: Colors.border, padding: 10, borderRadius: 4, alignItems: 'center', marginBottom: 20 },
  refreshBtnText: { color: Colors.amber, fontSize: 11, letterSpacing: 2 },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: { fontSize: 10, letterSpacing: 3, color: Colors.textMuted },
  subSectionTitle: { fontSize: 9, letterSpacing: 2, color: Colors.textMuted, marginBottom: 10, marginTop: 4 },
  infoCard: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderRadius: 4, padding: 14, marginBottom: 12 },
  infoCardTitle: { fontSize: 9, letterSpacing: 2, color: Colors.amber, marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { fontSize: 10, letterSpacing: 1.5, color: Colors.textMuted },
  infoValue: { fontSize: 12, color: Colors.textPrimary, fontWeight: '600', fontFamily: mono },
  accountScroll: { marginBottom: 14 },
  accountPill: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  accountPillText: { fontSize: 11, color: Colors.amber, fontFamily: mono },
  noteBox: { backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border, padding: 12, borderRadius: 4, marginTop: 8 },
  noteText: { fontSize: 11, color: Colors.textMuted, lineHeight: 17 },
});
