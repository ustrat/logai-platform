import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../src/store/authStore';
import { loadApiBase } from '../src/services/api';
import { Colors } from '../src/theme';
import { registerNotificationCategories, CATEGORY_ROUTES } from '../src/services/notifications';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export default function RootLayout() {
  const { loadToken } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Load API base and auth token before rendering screens
    // so all queries use the correct URL from the start
    Promise.all([loadToken(), loadApiBase()]).then(() => setReady(true));
    registerNotificationCategories();

    // Route to the correct tab based on notification category
    let responseSub: { remove: () => void } | null = null;
    try {
      responseSub = Notifications.addNotificationResponseReceivedListener(response => {
        const actionId = response.actionIdentifier;
        if (actionId === 'snooze') return;
        const category = response.notification.request.content.data?.category as string | undefined;
        const route = (category && CATEGORY_ROUTES[category]) || '/(tabs)/subscriptions';
        router.push(route as any);
      });
    } catch { /* native module absent — notifications disabled */ }

    return () => responseSub?.remove();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bgBase, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Colors.amber} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.bgSurface },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: { fontFamily: 'monospace', fontSize: 13, letterSpacing: 2 },
          contentStyle: { backgroundColor: Colors.bgBase },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="monitor" options={{ title: 'MONITOR' }} />
        <Stack.Screen name="settings" options={{ title: 'SETTINGS' }} />
      </Stack>
    </QueryClientProvider>
  );
}
