import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import { AnomaliesPage, PatternsPage, MonitorPage, SettingsPage } from './pages/PlaceholderPages';
import Renewalcommandcenter from './pages/Renewalcommandcenter';
import RenewalRiskQueue from './pages/RenewalRiskQueue';
import CaseFeed from './pages/CaseFeed';
import ProviderWatchlist from './pages/ProviderWatchlist';
import PlaidConnect from './pages/PlaidConnect';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/anomalies" element={<AnomaliesPage />} />
            <Route path="/patterns" element={<PatternsPage />} />
            <Route path="/monitor" element={<MonitorPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/renewals" element={<Renewalcommandcenter />} />
            <Route path="/risk-queue" element={<RenewalRiskQueue />} />
            <Route path="/case-feed" element={<CaseFeed />} />
            <Route path="/watchlist" element={<ProviderWatchlist />} />
            <Route path="/plaid" element={<PlaidConnect />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
