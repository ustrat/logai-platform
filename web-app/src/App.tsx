import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import OidcCallback from './pages/OidcCallback';
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
import SmartReminder from './pages/SmartReminder';
import AutoDraft from './pages/AutoDraft';
import SpendAnalyzer from './pages/SpendAnalyzer';
import ContractWatch from './pages/ContractWatch';
import CurrencyGuard from './pages/CurrencyGuard';
import TaxNormalizer from './pages/TaxNormalizer';
import EscalateAI from './pages/EscalateAI';
import EmailIntelligence from './pages/EmailIntelligence';
import AccountPage from './pages/AccountPage';
import OnboardingWizard from './pages/OnboardingWizard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

// Redirect to /login if not authenticated
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, signIn } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) { signIn(); return null; }
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login"           element={<LoginPage />} />
            <Route path="/auth/callback"   element={<OidcCallback />} />

            {/* Onboarding wizard — auth handled internally (shows spinner, not blank) */}
            <Route path="/onboarding" element={<OnboardingWizard />} />

            {/* Protected routes */}
            <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/anomalies"             element={<AnomaliesPage />} />
              <Route path="/patterns"              element={<PatternsPage />} />
              <Route path="/monitor"               element={<MonitorPage />} />
              <Route path="/settings"              element={<SettingsPage />} />
              <Route path="/renewals"              element={<Renewalcommandcenter />} />
              <Route path="/risk-queue"            element={<RenewalRiskQueue />} />
              <Route path="/case-feed"             element={<CaseFeed />} />
              <Route path="/watchlist"             element={<ProviderWatchlist />} />
              <Route path="/plaid"                 element={<PlaidConnect />} />
              <Route path="/event-normalization"   element={<EventNormalizationReview />} />
              <Route path="/eligibility-review"    element={<RenewalEligibilityReview />} />
              <Route path="/probability-workbench" element={<RenewalProbabilityWorkbench />} />
              <Route path="/strategy-selector"     element={<StrategySelector />} />
              <Route path="/subscriptions"         element={<SubscriptionIntelligence />} />
              <Route path="/pricing"               element={<PricingPage />} />
              <Route path="/partner-portal"        element={<PartnerPortal />} />
              <Route path="/enterprise"            element={<EnterpriseSales />} />
              <Route path="/ai-intelligence"       element={<AIIntelligence />} />
              <Route path="/email-intel"           element={<EmailIntelligence />} />
              <Route path="/smart-reminder"        element={<SmartReminder />} />
              <Route path="/auto-draft"            element={<AutoDraft />} />
              <Route path="/spend-analyzer"        element={<SpendAnalyzer />} />
              <Route path="/contract-watch"        element={<ContractWatch />} />
              <Route path="/currency-guard"        element={<CurrencyGuard />} />
              <Route path="/tax-normalizer"        element={<TaxNormalizer />} />
              <Route path="/escalate-ai"           element={<EscalateAI />} />
              <Route path="/account"               element={<AccountPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
