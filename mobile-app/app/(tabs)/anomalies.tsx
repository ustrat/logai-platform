import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../src/theme';

export default function AnomaliesTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>ANOMALIES</Text>
      <Text style={styles.sub}>Deep-dive anomaly explorer coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgBase, justifyContent: 'center', alignItems: 'center', gap: 12 },
  label: { fontSize: 10, letterSpacing: 4, color: Colors.amber },
  sub: { fontSize: 16, color: Colors.textSecondary },
});
