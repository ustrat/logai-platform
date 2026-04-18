import { Tabs } from 'expo-router';
import { Text, View, StyleSheet, Platform } from 'react-native';
import { Colors } from '../../src/theme';

const mono = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

function HeaderLeft() {
  return (
    <View style={styles.headerLeft}>
      <Text style={styles.headerLogo}>⬡</Text>
      <View>
        <Text style={styles.headerBrand}>RenewalGuard</Text>
        <Text style={styles.headerSub}>SUBSCRIPTION INTELLIGENCE</Text>
      </View>
    </View>
  );
}

function HeaderTitle({ title }: { title: string }) {
  return <Text style={styles.headerPageTitle}>{title}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Colors.navy },
        headerTintColor: '#ffffff',
        headerShadowVisible: false,
        headerLeft: () => <HeaderLeft />,
        tabBarStyle: {
          backgroundColor: Colors.bgSurface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: Colors.navy,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 9, letterSpacing: 1.5, marginTop: 2, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerTitle: () => <HeaderTitle title="DASHBOARD" />,
          tabBarLabel: 'DASHBOARD',
          tabBarIcon: ({ color }) => <TabIcon symbol="⬡" color={color} />,
        }}
      />
      <Tabs.Screen
        name="anomalies"
        options={{
          headerTitle: () => <HeaderTitle title="ANOMALIES" />,
          tabBarLabel: 'ANOMALIES',
          tabBarIcon: ({ color }) => <TabIcon symbol="⚠" color={color} />,
        }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{
          headerTitle: () => <HeaderTitle title="SUBSCRIPTIONS" />,
          tabBarLabel: 'SUBSCRIPTIONS',
          tabBarIcon: ({ color }) => <TabIcon symbol="↻" color={color} />,
        }}
      />
      <Tabs.Screen
        name="connect"
        options={{
          headerTitle: () => <HeaderTitle title="CONNECT" />,
          tabBarLabel: 'CONNECT',
          tabBarIcon: ({ color }) => <TabIcon symbol="⬛" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerTitle: () => <HeaderTitle title="PROFILE" />,
          tabBarLabel: 'PROFILE',
          tabBarIcon: ({ color }) => <TabIcon symbol="◉" color={color} />,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ symbol, color }: { symbol: string; color: string }) {
  return <Text style={{ color, fontSize: 16 }}>{symbol}</Text>;
}

const styles = StyleSheet.create({
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 16,
  },
  headerLogo: {
    fontSize: 20,
    color: Colors.amber,
  },
  headerBrand: {
    fontFamily: mono,
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 2,
  },
  headerSub: {
    fontSize: 7,
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 1,
  },
  headerPageTitle: {
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
});
