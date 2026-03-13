import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('admin@logai.dev');
  const [password, setPassword] = useState('admin1234');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authApi.login(email, password);
      await setAuth(res.data.data.user, res.data.data.token);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Check API connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Background grid lines */}
      <View style={styles.gridOverlay} pointerEvents="none" />

      <View style={styles.card}>
        {/* Logo */}
        <View style={styles.logoRow}>
          <Text style={styles.logoMark}>⬡</Text>
          <View>
            <Text style={styles.logoText}>LOGAI</Text>
            <Text style={styles.logoSub}>TRANSACTION INTELLIGENCE</Text>
          </View>
        </View>

        <View style={styles.divider} />
        <Text style={styles.sectionLabel}>SYSTEM ACCESS</Text>

        {/* Email */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>EMAIL_ADDRESS</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        {/* Password */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠ {error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.buttonText}>AUTHENTICATE →</Text>
          }
        </TouchableOpacity>

        <Text style={styles.footer}>LOGAI v1.0 · SECURE CONNECTION</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgBase,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.4,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: 28,
    borderRadius: 4,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  logoMark: {
    fontSize: 28,
    color: Colors.amber,
  },
  logoText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 4,
  },
  logoSub: {
    fontSize: 9,
    letterSpacing: 2,
    color: Colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 3,
    color: Colors.amber,
    marginBottom: 20,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    padding: 12,
    borderRadius: 4,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  errorBox: {
    backgroundColor: Colors.redDim,
    borderWidth: 1,
    borderColor: Colors.red,
    padding: 10,
    borderRadius: 4,
    marginBottom: 12,
  },
  errorText: {
    color: Colors.red,
    fontSize: 12,
  },
  button: {
    backgroundColor: Colors.amber,
    padding: 14,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  footer: {
    marginTop: 20,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
