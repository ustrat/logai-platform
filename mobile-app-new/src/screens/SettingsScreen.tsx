import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { getApiBase, saveApiBase, loadApiBase } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';

const mono = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

export default function SettingsScreen() {
  const [apiUrl, setApiUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { logout } = useAuthStore();

  useEffect(() => {
    loadApiBase().then(() => setApiUrl(getApiBase()));
  }, []);

  const handleSave = async () => {
    const trimmed = apiUrl.trim();
    if (!trimmed.startsWith('http')) {
      Alert.alert('Invalid URL', 'API URL must start with http:// or https://');
      return;
    }
    setSaving(true);
    try {
      await saveApiBase(trimmed);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

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
        <Text style={styles.headerLabel}>CONFIGURATION</Text>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {/* API Config */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>API CONNECTION</Text>

        <Text style={styles.fieldLabel}>API BASE URL</Text>
        <TextInput
          style={styles.input}
          value={apiUrl}
          onChangeText={setApiUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="http://192.168.x.x:4000"
          placeholderTextColor={Colors.textMuted}
        />
        <Text style={styles.hint}>
          Find your IP: run `ipconfig` on Windows, look for IPv4 Address.{'\n'}
          Example: http://192.168.1.42:4000
        </Text>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color={Colors.bgBase} size="small" />
            : <Text style={styles.saveBtnText}>{saved ? '✓ SAVED' : 'SAVE URL'}</Text>
          }
        </TouchableOpacity>
      </View>

      {/* App info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>APPLICATION INFO</Text>
        <InfoRow label="APP VERSION" value="1.0.0" />
        <InfoRow label="PLATFORM" value={Platform.OS.toUpperCase()} />
        <InfoRow label="BUILD" value="mobile-app-new" />
        <InfoRow label="API ROUTES" value="/api/v1/*" />
      </View>

      {/* Quick links */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>NAVIGATION</Text>
        <NavLink label="Dashboard" onPress={() => router.push('/(tabs)')} />
        <NavLink label="Anomaly Detection" onPress={() => router.push('/(tabs)/anomalies')} />
        <NavLink label="Subscriptions" onPress={() => router.push('/(tabs)/subscriptions')} />
        <NavLink label="Plaid Connect" onPress={() => router.push('/(tabs)/connect')} />
        <NavLink label="System Monitor" onPress={() => router.push('/monitor')} />
      </View>

      {/* Danger zone */}
      <View style={[styles.section, styles.dangerSection]}>
        <Text style={[styles.sectionTitle, { color: Colors.red }]}>ACCOUNT</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>⊗ LOG OUT</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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

function NavLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.navLink} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.navLinkText}>{label}</Text>
      <Text style={styles.navLinkArrow}>→</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgBase },
  content: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 20 },
  headerLabel: { fontSize: 10, letterSpacing: 3, color: Colors.amber, marginBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, fontFamily: mono },
  section: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderRadius: 4, padding: 16, marginBottom: 16 },
  dangerSection: { borderColor: Colors.red + '55' },
  sectionTitle: { fontSize: 9, letterSpacing: 2.5, color: Colors.textMuted, marginBottom: 14 },
  fieldLabel: { fontSize: 10, letterSpacing: 1.5, color: Colors.textMuted, marginBottom: 6 },
  input: {
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    padding: 12,
    borderRadius: 4,
    fontSize: 13,
    fontFamily: mono,
    marginBottom: 8,
  },
  hint: { fontSize: 11, color: Colors.textMuted, lineHeight: 17, marginBottom: 14 },
  saveBtn: { backgroundColor: Colors.amber, padding: 12, borderRadius: 4, alignItems: 'center' },
  saveBtnText: { color: '#000', fontWeight: '700', fontSize: 12, letterSpacing: 2, fontFamily: mono },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { fontSize: 10, letterSpacing: 1.5, color: Colors.textMuted },
  infoValue: { fontSize: 12, color: Colors.textPrimary, fontWeight: '600', fontFamily: mono },
  navLink: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  navLinkText: { fontSize: 13, color: Colors.textPrimary },
  navLinkArrow: { color: Colors.amber, fontSize: 14 },
  logoutBtn: { borderWidth: 1, borderColor: Colors.red, padding: 12, borderRadius: 4, alignItems: 'center' },
  logoutBtnText: { color: Colors.red, fontWeight: '700', fontSize: 12, letterSpacing: 2 },
});
