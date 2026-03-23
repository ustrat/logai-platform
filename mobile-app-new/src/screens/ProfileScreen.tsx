import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>ACCOUNT</Text>

      <View style={styles.card}>
        <Row k="NAME" v={user?.name || '—'} />
        <Row k="EMAIL" v={user?.email || '—'} />
        <Row k="ROLE" v={user?.role?.toUpperCase() || '—'} highlight />
      </View>

      <Text style={styles.label}>SYSTEM</Text>
      <View style={styles.card}>
        <Row k="API VERSION" v="v1.0.0" />
        <Row k="ML MODEL" v="Isolation Forest" />
        <Row k="DATA SOURCE" v="Synthetic" />
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>LOGOUT →</Text>
      </TouchableOpacity>
    </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgBase, padding: 16 },
  label: { fontSize: 10, letterSpacing: 3, color: Colors.textMuted, marginBottom: 10, marginTop: 16 },
  card: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderRadius: 4, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowKey: { fontSize: 11, color: Colors.textMuted, letterSpacing: 1 },
  rowVal: { fontSize: 11, color: Colors.textPrimary, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
  logoutBtn: { marginTop: 24, borderWidth: 1, borderColor: Colors.red, padding: 14, borderRadius: 4, alignItems: 'center' },
  logoutText: { color: Colors.red, fontSize: 12, letterSpacing: 2 },
});
