import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';

export default function Index() {
  const { token } = useAuthStore();
  return <Redirect href={token ? '/(tabs)' : '/login'} />;
}
