import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';

const mono = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>ACCOUNT</Text>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      {/* User info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>USER INFO</Text>
        <Row k="NAME" v={user?.name || '—'} />
        <Row k="EMAIL" v={user?.email || '—'} />
        <Row k="ROLE" v={user?.role?.toUpperCase() || '—'} highlight />
      </View>

      {/* System info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SYSTEM</Text>
        <Row k="API VERSION" v="v1.0" />
        <Row k="ML MODEL" v="Isolation Forest" />
        <Row k="DATA SOURCE" v="Synthetic / Plaid" />
        <Row k="MOBILE BUILD" v="mobile-app-new" />
      </View>

      {/* Navigation links */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TOOLS</Text>
        <NavLink label="⬡  System Monitor" desc="Service health & ML status" onPress={() => router.push('/monitor')} />
        <NavLink label="⚙  Settings" desc="API URL, preferences" onPress={() => router.push('/settings')} />
        <NavLink label="⚡  Upgrade Plan" desc="View ValuePilot pricing & billing" onPress={() => router.push('/pricing')} highlight />
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>⊗ LOG OUT</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowKey}>{k}</Text>
      <Text style={[styles.rowVal, highlight && { color: Colors.amber }]}>{v}</Text>
    </View>
  );
}

function NavLink({ label, desc, onPress, highlight }: { label: string; desc: string; onPress: () => void; highlight?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.navLink, highlight && { backgroundColor: 'rgba(245,158,11,0.06)' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.navLinkLabel, highlight && { color: Colors.amber, fontWeight: '700' }]}>{label}</Text>
        <Text style={styles.navLinkDesc}>{desc}</Text>
      </View>
      <Text style={styles.navArrow}>→</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgBase },
  content: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 20 },
  headerLabel: { fontSize: 10, letterSpacing: 3, color: Colors.amber, marginBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, fontFamily: mono },
  section: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderRadius: 4, marginBottom: 14, overflow: 'hidden' },
  sectionTitle: { fontSize: 9, letterSpacing: 2.5, color: Colors.textMuted, padding: 12, paddingBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  rowKey: { fontSize: 11, color: Colors.textMuted, letterSpacing: 1 },
  rowVal: { fontSize: 11, color: Colors.textPrimary, fontWeight: '700', fontFamily: mono },
  navLink: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  navLinkLabel: { fontSize: 13, color: Colors.textPrimary, marginBottom: 2 },
  navLinkDesc: { fontSize: 10, color: Colors.textMuted },
  navArrow: { color: Colors.amber, fontSize: 16, marginLeft: 8 },
  logoutBtn: { borderWidth: 1, borderColor: Colors.red, padding: 14, borderRadius: 4, alignItems: 'center', marginTop: 8 },
  logoutText: { color: Colors.red, fontSize: 12, letterSpacing: 2, fontWeight: '700' },
});
