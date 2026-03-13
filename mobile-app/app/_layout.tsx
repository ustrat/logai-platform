import { Tabs } from 'expo-router';
import { Colors } from '../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bgSurface },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: { fontFamily: 'monospace', fontSize: 13, letterSpacing: 2 },
        tabBarStyle: {
          backgroundColor: Colors.bgSurface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: Colors.amber,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 9, letterSpacing: 1.5, marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'DASHBOARD',
          tabBarLabel: 'DASHBOARD',
          tabBarIcon: ({ color }) => <TabIcon symbol="⬡" color={color} />,
        }}
      />
      <Tabs.Screen
        name="anomalies"
        options={{
          title: 'ANOMALIES',
          tabBarLabel: 'ANOMALIES',
          tabBarIcon: ({ color }) => <TabIcon symbol="⚠" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'PROFILE',
          tabBarLabel: 'PROFILE',
          tabBarIcon: ({ color }) => <TabIcon symbol="◉" color={color} />,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ symbol, color }: { symbol: string; color: string }) {
  const { Text } = require('react-native');
  return <Text style={{ color, fontSize: 16 }}>{symbol}</Text>;
}
