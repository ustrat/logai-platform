import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Platform, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plaidApi } from '../services/api';
import { Colors } from '../theme';

const mono = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

export default function PlaidScreen() {
  const queryClient = useQueryClient();
  const [txPage, setTxPage] = useState(0);
  const PAGE_SIZE = 20;

  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus, isFetching: statusFetching } = useQuery({
    queryKey: ['plaid-status'],
    queryFn: async () => {
      const res = await plaidApi.status();
      return res.data.data as { connected: boolean; institution?: string; accountCount?: number; lastSync?: string };
    },
  });

  const { data: txData, isLoading: txLoading, refetch: refetchTx, isFetching: txFetching } = useQuery({
    queryKey: ['plaid-transactions', txPage],
    queryFn: async () => {
      const res = await plaidApi.transactions(PAGE_SIZE, txPage * PAGE_SIZE);
      return res.data.data as { transactions: any[]; total: number };
    },
    enabled: statusData?.connected === true,
  });

  const { data: accountsData } = useQuery({
    queryKey: ['plaid-accounts'],
    queryFn: async () => {
      const res = await plaidApi.accounts();
      return res.data.data as any[];
    },
    enabled: statusData?.connected === true,
  });

  const sandboxMutation = useMutation({
    mutationFn: () => plaidApi.connectSandbox(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plaid-status'] });
      queryClient.invalidateQueries({ queryKey: ['plaid-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['plaid-accounts'] });
    },
    onError: (err: any) => {
      Alert.alert('Connection Failed', err.response?.data?.error || 'Could not connect sandbox account.');
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => plaidApi.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plaid-status'] });
      queryClient.invalidateQueries({ queryKey: ['plaid-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['plaid-accounts'] });
    },
  });

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Bank',
      'Remove your linked bank account? Transaction data will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: () => disconnectMutation.mutate() },
      ]
    );
  };

  const transactions = txData?.transactions || [];
  const totalTx = txData?.total || 0;
  const totalPages = Math.ceil(totalTx / PAGE_SIZE);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={statusFetching || txFetching} onRefresh={() => { refetchStatus(); refetchTx(); }} tintColor={Colors.amber} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>BANK INTEGRATION</Text>
        <Text style={styles.headerTitle}>Plaid Connect</Text>
      </View>

      {statusLoading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={Colors.amber} />
          <Text style={styles.loadingText}>CHECKING CONNECTION...</Text>
        </View>
      )}

      {statusData && (
        <>
          {/* Connection status card */}
          <View style={[styles.statusCard, { borderColor: statusData.connected ? Colors.green : Colors.border }]}>
            <View style={styles.statusTop}>
              <View style={[styles.statusDot, { backgroundColor: statusData.connected ? Colors.green : Colors.textMuted }]} />
              <Text style={[styles.statusLabel, { color: statusData.connected ? Colors.green : Colors.textMuted }]}>
                {statusData.connected ? 'CONNECTED' : 'NOT CONNECTED'}
              </Text>
            </View>

            {statusData.connected ? (
              <>
                {statusData.institution && (
                  <Text style={styles.institutionName}>{statusData.institution}</Text>
                )}
                <View style={styles.metaRow}>
                  {statusData.accountCount != null && (
                    <MetaChip label="ACCOUNTS" value={String(statusData.accountCount)} />
                  )}
                  {statusData.lastSync && (
                    <MetaChip label="LAST SYNC" value={new Date(statusData.lastSync).toLocaleDateString()} />
                  )}
                </View>

                <TouchableOpacity
                  style={styles.disconnectBtn}
                  onPress={handleDisconnect}
                  disabled={disconnectMutation.isPending}
                >
                  <Text style={styles.disconnectBtnText}>
                    {disconnectMutation.isPending ? 'DISCONNECTING...' : '⊗ DISCONNECT BANK'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.connectDesc}>
                  Link your bank account to enable AI-powered subscription detection and transaction analysis.
                </Text>

                <TouchableOpacity
                  style={styles.connectBtn}
                  onPress={() => sandboxMutation.mutate()}
                  disabled={sandboxMutation.isPending}
                >
                  {sandboxMutation.isPending
                    ? <ActivityIndicator color="#000" size="small" />
                    : <Text style={styles.connectBtnText}>⬡ CONNECT SANDBOX (CHASE)</Text>
                  }
                </TouchableOpacity>

                <View style={styles.noteBox}>
                  <Text style={styles.noteText}>
                    ℹ In production, a Plaid Link flow would launch. Sandbox mode connects a test Chase account for development.
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Accounts */}
          {statusData.connected && accountsData && accountsData.length > 0 && (
            <>
              <SectionHeader title="LINKED ACCOUNTS" count={accountsData.length} />
              {accountsData.map((acc: any, i: number) => (
                <View key={i} style={styles.accountCard}>
                  <View style={styles.accountTop}>
                    <Text style={styles.accountName}>{acc.name || acc.official_name || 'Account'}</Text>
                    <Text style={styles.accountType}>{acc.subtype?.toUpperCase() || acc.type?.toUpperCase() || ''}</Text>
                  </View>
                  <View style={styles.accountBalances}>
                    {acc.balances?.current != null && (
                      <BalanceItem label="CURRENT" value={`$${Number(acc.balances.current).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                    )}
                    {acc.balances?.available != null && (
                      <BalanceItem label="AVAILABLE" value={`$${Number(acc.balances.available).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                    )}
                  </View>
                  {acc.mask && (
                    <Text style={styles.accountMask}>···· {acc.mask}</Text>
                  )}
                </View>
              ))}
            </>
          )}

          {/* Transactions */}
          {statusData.connected && (
            <>
              <SectionHeader title="RECENT TRANSACTIONS" count={totalTx} />

              {txLoading && (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color={Colors.amber} />
                  <Text style={styles.loadingText}>LOADING TRANSACTIONS...</Text>
                </View>
              )}

              {transactions.map((tx: any, i: number) => (
                <View key={tx.transaction_id || i} style={styles.txCard}>
                  <View style={styles.txTop}>
                    <Text style={styles.txMerchant} numberOfLines={1}>
                      {tx.merchant_name || tx.name || 'Unknown'}
                    </Text>
                    <Text style={[styles.txAmount, { color: tx.amount > 0 ? Colors.red : Colors.green }]}>
                      {tx.amount > 0 ? '-' : '+'}${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View style={styles.txBottom}>
                    <Text style={styles.txDate}>{tx.date}</Text>
                    {tx.category && (
                      <Text style={styles.txCategory}>{Array.isArray(tx.category) ? tx.category[0] : tx.category}</Text>
                    )}
                  </View>
                </View>
              ))}

              {totalPages > 1 && (
                <View style={styles.pagination}>
                  <TouchableOpacity
                    style={[styles.pageBtn, txPage === 0 && styles.pageBtnDisabled]}
                    onPress={() => setTxPage(p => Math.max(0, p - 1))}
                    disabled={txPage === 0}
                  >
                    <Text style={styles.pageBtnText}>← PREV</Text>
                  </TouchableOpacity>
                  <Text style={styles.pageInfo}>{txPage + 1} / {totalPages}</Text>
                  <TouchableOpacity
                    style={[styles.pageBtn, txPage >= totalPages - 1 && styles.pageBtnDisabled]}
                    onPress={() => setTxPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={txPage >= totalPages - 1}
                  >
                    <Text style={styles.pageBtnText}>NEXT →</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </>
      )}
    </ScrollView>
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

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaChip}>
      <Text style={styles.metaChipLabel}>{label}</Text>
      <Text style={styles.metaChipValue}>{value}</Text>
    </View>
  );
}

function BalanceItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.balanceItem}>
      <Text style={styles.balanceLabel}>{label}</Text>
      <Text style={styles.balanceValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgBase },
  content: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 16 },
  headerLabel: { fontSize: 10, letterSpacing: 3, color: Colors.amber, marginBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, fontFamily: mono },
  loadingBox: { alignItems: 'center', padding: 40, gap: 12 },
  loadingText: { color: Colors.amber, letterSpacing: 2, fontSize: 11 },
  statusCard: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderRadius: 4, padding: 18, marginBottom: 20 },
  statusTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  institutionName: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12, fontFamily: mono },
  metaRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  metaChip: { backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 6 },
  metaChipLabel: { fontSize: 8, letterSpacing: 2, color: Colors.textMuted, marginBottom: 2 },
  metaChipValue: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  connectDesc: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16, lineHeight: 20 },
  connectBtn: { backgroundColor: Colors.amber, padding: 14, borderRadius: 4, alignItems: 'center', marginBottom: 12 },
  connectBtnText: { color: '#000', fontWeight: '700', fontSize: 12, letterSpacing: 2, fontFamily: mono },
  disconnectBtn: { borderWidth: 1, borderColor: Colors.red, padding: 10, borderRadius: 4, alignItems: 'center' },
  disconnectBtnText: { color: Colors.red, fontSize: 11, letterSpacing: 2 },
  noteBox: { backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border, padding: 12, borderRadius: 4 },
  noteText: { fontSize: 11, color: Colors.textMuted, lineHeight: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 10, letterSpacing: 3, color: Colors.textMuted },
  sectionCount: { fontSize: 11, color: Colors.amber },
  accountCard: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderRadius: 4, padding: 14, marginBottom: 8 },
  accountTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  accountName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  accountType: { fontSize: 9, letterSpacing: 1.5, color: Colors.amber },
  accountBalances: { flexDirection: 'row', gap: 16, marginBottom: 6 },
  balanceItem: {},
  balanceLabel: { fontSize: 9, letterSpacing: 1.5, color: Colors.textMuted, marginBottom: 2 },
  balanceValue: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, fontFamily: mono },
  accountMask: { fontSize: 11, color: Colors.textMuted, fontFamily: mono },
  txCard: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, padding: 12, borderRadius: 4, marginBottom: 6 },
  txTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  txMerchant: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, flex: 1, marginRight: 8 },
  txAmount: { fontSize: 13, fontWeight: '700', fontFamily: mono },
  txBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  txDate: { fontSize: 11, color: Colors.textMuted, fontFamily: mono },
  txCategory: { fontSize: 10, color: Colors.textMuted },
  pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  pageBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: 4, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.bgSurface },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { fontSize: 10, color: Colors.amber, letterSpacing: 1.5 },
  pageInfo: { fontSize: 11, color: Colors.textMuted },
});
