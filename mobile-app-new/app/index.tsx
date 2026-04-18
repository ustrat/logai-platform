import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';

export default function Index() {
  const { token, isHydrated } = useAuthStore();

  if (!isHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#f59e0b" size="large" />
      </View>
    );
  }

  return <Redirect href={token ? '/(tabs)' : '/login'} />;
}
