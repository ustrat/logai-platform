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
import EventNormalizationReview from './pages/EventNormalizationReview';
import RenewalEligibilityReview from './pages/RenewalEligibilityReview';
import RenewalProbabilityWorkbench from './pages/RenewalProbabilityWorkbench';
import StrategySelector from './pages/StrategySelector';
import SubscriptionIntelligence from './pages/SubscriptionIntelligence';
import PricingPage from './pages/PricingPage';
import PartnerPortal from './pages/PartnerPortal';
import EnterpriseSales from './pages/EnterpriseSales';
import AIIntelligence from './pages/AIIntelligence';


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
            <Route path="/event-normalization" element={<EventNormalizationReview />} />
            <Route path="/eligibility-review" element={<RenewalEligibilityReview />} />
            <Route path="/probability-workbench" element={<RenewalProbabilityWorkbench />} />
            <Route path="/strategy-selector" element={<StrategySelector />} />
            <Route path="/subscriptions" element={<SubscriptionIntelligence />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/partner-portal" element={<PartnerPortal />} />
            <Route path="/enterprise" element={<EnterpriseSales />} />
            <Route path="/ai-intelligence" element={<AIIntelligence />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
