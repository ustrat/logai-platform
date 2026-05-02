import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Check, ExternalLink, Loader2, ArrowRight, AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import { paymentsApi, catalogApi } from '../services/paymentsApi';

// ── Types ──────────────────────────────────────────────────────────────────

type BillingPeriod = 'monthly' | 'annual';
type BillingCategory = 'plan' | 'addon';

interface CatalogProduct {
  productKey:   string;
  name:         string;
  description:  string;
  tagline?:     string;
  category:     BillingCategory;
  sortOrder:    number;
  featureKeys:  string[];
  features:     string[];
  prices:       { monthly: number | null; annual: number | null };
  hasStripeSync: boolean;
}

// ── Accent palette per product ─────────────────────────────────────────────

const PLAN_THEMES = [
  { accent: '#1d4ed8', light: 'rgba(29,78,216,0.07)',   border: 'rgba(29,78,216,0.18)'   },
  { accent: '#7c3aed', light: 'rgba(124,58,237,0.07)', border: 'rgba(124,58,237,0.18)'  },
];

const ADDON_THEMES = [
  { accent: '#0891b2', light: 'rgba(8,145,178,0.07)',  border: 'rgba(8,145,178,0.18)'   },
  { accent: '#b45309', light: 'rgba(180,83,9,0.07)',   border: 'rgba(180,83,9,0.18)'    },
  { accent: '#15803d', light: 'rgba(21,128,61,0.07)',  border: 'rgba(21,128,61,0.18)'   },
  { accent: '#be185d', light: 'rgba(190,24,93,0.07)',  border: 'rgba(190,24,93,0.18)'   },
  { accent: '#0f766e', light: 'rgba(15,118,110,0.07)', border: 'rgba(15,118,110,0.18)'  },
];

function fmt(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(cents / 100);
}

// ── Product card ───────────────────────────────────────────────────────────

function ProductCard({ product, theme, isActive, period, onSubscribe, loading }: {
  product:     CatalogProduct;
  theme:       typeof PLAN_THEMES[0];
  isActive:    boolean;
  period:      BillingPeriod;
  onSubscribe: () => void;
  loading:     boolean;
}) {
  const price = period === 'annual' && product.prices.annual ? product.prices.annual
              : product.prices.monthly ?? product.prices.annual ?? 0;
  const hasAnnual = !!product.prices.annual;
  const displayInterval = period === 'annual' && hasAnnual ? 'year' : 'month';
  const monthlyCost = period === 'annual' && hasAnnual ? Math.round((product.prices.annual ?? 0) / 12) : null;

  return (
    <div style={{ ...S.card, borderColor: isActive ? theme.accent : 'var(--border)', opacity: isActive ? 0.82 : 1 }}>
      <div style={{ ...S.cardTopLine, background: theme.accent }} />

      {/* Header */}
      <div style={S.cardHeader}>
        <div style={{ ...S.iconWrap, background: theme.light, border: `1px solid ${theme.border}` }}>
          <Zap size={18} color={theme.accent} strokeWidth={2.5} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2 style={S.productName}>{product.name}</h2>
            {product.tagline && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: theme.light, color: theme.accent, border: `1px solid ${theme.border}` }}>
                {product.tagline}
              </span>
            )}
            {isActive && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
                ✓ Active
              </span>
            )}
          </div>
          {product.description && <p style={S.productDesc}>{product.description}</p>}
        </div>
      </div>

      {/* Feature bullets */}
      {product.features.length > 0 && (
        <>
          <div style={S.divider} />
          <div style={S.featuresGrid}>
            {product.features.map((f, i) => (
              <div key={i} style={S.featureItem}>
                <Check size={12} color={theme.accent} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={S.featureText}>{f}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ flex: 1 }} />
      <div style={S.divider} />

      {/* Price + CTA */}
      <div style={S.cardFooter}>
        <div>
          <div style={S.priceRow}>
            <span style={S.priceCurrency}>$</span>
            <span style={{ ...S.priceNum, color: theme.accent }}>
              {((price) / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </span>
            <span style={S.pricePer}>/{displayInterval}</span>
          </div>
          {monthlyCost && (
            <div style={S.priceMonthly}>~{fmt(monthlyCost)}/mo · billed annually</div>
          )}
          {period === 'annual' && hasAnnual && product.prices.monthly && (
            <div style={{ ...S.priceMonthly, color: theme.accent, fontWeight: 600 }}>
              Save {fmt(product.prices.monthly * 12 - (product.prices.annual ?? 0))}/yr
            </div>
          )}
        </div>

        <button
          style={{ ...S.ctaBtn, background: isActive ? 'transparent' : theme.accent, borderColor: theme.accent, color: isActive ? theme.accent : '#fff', cursor: isActive ? 'default' : 'pointer' }}
          onClick={() => !isActive && onSubscribe()}
          disabled={isActive || loading}
        >
          {loading
            ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
            : isActive ? 'Subscribed'
            : <><span>Start free trial</span><ArrowRight size={13} /></>}
        </button>
      </div>
      {!isActive && <p style={S.trialNote}>14-day trial · No credit card required</p>}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [period, setPeriod]           = useState<BillingPeriod>('monthly');
  const [loadingKey, setLoadingKey]   = useState<string | null>(null);

  const params         = new URLSearchParams(window.location.search);
  const checkoutStatus = params.get('checkout');

  const { data: catalogData, isLoading: catalogLoading } = useQuery({
    queryKey: ['catalog-products'],
    queryFn: () => catalogApi.getProducts().then(r => r.data?.data?.products as CatalogProduct[]),
    staleTime: 120_000,
  });

  const { data: subData } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: () => paymentsApi.getSubscription().then(r => r.data?.data ?? null),
    retry: false,
  });

  const activeFeatureKeys = new Set<string>(
    (subData?.subscriptions ?? [])
      .filter((s: any) => ['active', 'trialing', 'past_due'].includes(s.status))
      .flatMap((s: any) => (s.metadata?.featureKeys ?? '').split(',').filter(Boolean))
  );

  const checkout = useMutation({
    mutationFn: async ({ productKey }: { productKey: string }) => {
      setLoadingKey(productKey);
      const priceId    = `${productKey}::${period}`;
      const successUrl = `${window.location.origin}/pricing?checkout=success`;
      const cancelUrl  = `${window.location.origin}/pricing?checkout=cancelled`;
      return paymentsApi.createCheckoutSession(priceId, successUrl, cancelUrl).then(r => r.data);
    },
    onSuccess: (data) => {
      const url = data?.data?.checkoutUrl;
      if (url) window.location.href = url;
      else setLoadingKey(null);
    },
    onError: () => setLoadingKey(null),
  });

  const portal = useMutation({
    mutationFn: () => paymentsApi.createPortalSession().then(r => r.data),
    onSuccess: (data) => { if (data?.data?.portalUrl) window.location.href = data.data.portalUrl; },
  });

  const allProducts = catalogData ?? [];
  const plans  = allProducts.filter(p => p.category === 'plan');
  const addons = allProducts.filter(p => p.category === 'addon');

  const isProductActive = (product: CatalogProduct) =>
    product.featureKeys.some(k => activeFeatureKeys.has(k));

  const hasActiveSub = activeFeatureKeys.size > 0;

  return (
    <div style={S.page}>

      {/* Status banners */}
      {checkoutStatus === 'success' && (
        <div style={{ ...S.banner, background: '#dcfce7', border: '1px solid #86efac', color: '#15803d' }}>
          <CheckCircle2 size={15} /><span>Payment confirmed — your subscription is now active.</span>
        </div>
      )}
      {checkoutStatus === 'cancelled' && (
        <div style={{ ...S.banner, background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e' }}>
          <AlertCircle size={15} /><span>Checkout cancelled — no charge was made.</span>
        </div>
      )}

      {/* Active subscription bar */}
      {hasActiveSub && (
        <div style={S.activeBanner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: '#16a34a', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>You have an active subscription</span>
          </div>
          <button style={S.manageBtn} onClick={() => portal.mutate()} disabled={portal.isPending}>
            {portal.isPending ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : <ExternalLink size={12} />}
            Manage billing
          </button>
        </div>
      )}

      {/* Hero */}
      <div style={S.hero}>
        <p style={S.eyebrow}>VALUEPILOT PRODUCTS</p>
        <h1 style={S.heroTitle}>Revenue intelligence,<br />built for every team</h1>
        <p style={S.heroSub}>14-day free trial on every product · No credit card required · Cancel any time</p>

        {/* Billing period toggle */}
        <div style={S.periodToggle}>
          {(['monthly', 'annual'] as BillingPeriod[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ ...S.periodBtn, ...(period === p ? S.periodBtnActive : {}) }}>
              {p === 'monthly' ? 'Monthly' : 'Annual'}
              {p === 'annual' && <span style={{ fontSize: 10, marginLeft: 6, background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>Save up to 17%</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Loading skeleton */}
      {catalogLoading && (
        <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
          {[0, 1].map(i => <div key={i} style={{ flex: 1, height: 440, background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)', borderRadius: 14, backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />)}
        </div>
      )}

      {/* Plan cards */}
      {!catalogLoading && plans.length > 0 && (
        <>
          <div style={{ ...S.sectionLabel }}>PLANS</div>
          <div style={{ ...S.cardGrid, gridTemplateColumns: `repeat(${Math.min(plans.length, 3)}, 1fr)` }}>
            {plans.map((product, i) => (
              <ProductCard
                key={product.productKey}
                product={product}
                theme={PLAN_THEMES[i % PLAN_THEMES.length]}
                isActive={isProductActive(product)}
                period={period}
                loading={loadingKey === product.productKey}
                onSubscribe={() => checkout.mutate({ productKey: product.productKey })}
              />
            ))}
          </div>
        </>
      )}

      {/* Add-on cards */}
      {!catalogLoading && addons.length > 0 && (
        <>
          <div style={{ ...S.sectionLabel, marginTop: 32 }}>ADD-ONS</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Extend any plan with individual modules. Each add-on can be purchased independently.
          </p>
          <div style={{ ...S.cardGrid, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {addons.map((product, i) => (
              <ProductCard
                key={product.productKey}
                product={product}
                theme={ADDON_THEMES[i % ADDON_THEMES.length]}
                isActive={isProductActive(product)}
                period={period}
                loading={loadingKey === product.productKey}
                onSubscribe={() => checkout.mutate({ productKey: product.productKey })}
              />
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!catalogLoading && allProducts.length === 0 && (
        <div style={S.emptyState}>
          <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No products in catalog</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>An admin can seed the price book via POST /api/v1/catalog/seed</p>
        </div>
      )}

      {/* Bundle callout */}
      {plans.length > 1 && (
        <div style={S.bundle}>
          <div>
            <p style={S.bundleEyebrow}>ENTERPRISE · VOLUME PRICING</p>
            <h3 style={S.bundleTitle}>Custom pricing for large deployments</h3>
            <p style={S.bundleSub}>Multi-seat, multi-tenant, or government contracts — contact us for a tailored quote.</p>
          </div>
          <a href="mailto:sales@valuepilot.io?subject=Enterprise Pricing" style={S.bundleBtn}>
            Talk to sales <ExternalLink size={13} />
          </a>
        </div>
      )}

      {/* Trust row */}
      <div style={S.trustRow}>
        {['🔒  Bank-grade encryption', '✦  SOC 2 Type II', '↩  Cancel any time', '🤝  Onboarding support'].map(t => (
          <div key={t} style={S.trustItem}><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t}</span></div>
        ))}
      </div>

      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  page: { padding: '32px 40px 60px', maxWidth: 1100, margin: '0 auto', fontFamily: 'var(--font-display)' },

  banner: { display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, marginBottom: 16 },

  activeBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 18px', marginBottom: 28, boxShadow: 'var(--shadow-sm)' },
  manageBtn:    { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' },

  hero:      { textAlign: 'center', marginBottom: 32 },
  eyebrow:   { fontSize: 10, letterSpacing: '3px', color: 'var(--blue)', fontWeight: 700, marginBottom: 12 },
  heroTitle: { fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25, marginBottom: 10 },
  heroSub:   { fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 },

  periodToggle:   { display: 'inline-flex', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, gap: 4, margin: '0 auto' },
  periodBtn:      { padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', background: 'transparent', display: 'flex', alignItems: 'center', transition: 'all 0.15s' },
  periodBtnActive:{ background: 'var(--bg-surface)', color: 'var(--text-primary)', fontWeight: 700, boxShadow: 'var(--shadow-sm)' },

  sectionLabel: { fontSize: 10, letterSpacing: '2px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 14 },

  cardGrid: { display: 'grid', gap: 20, marginBottom: 8 },
  card: { background: 'var(--bg-surface)', borderRadius: 14, borderWidth: 2, borderStyle: 'solid', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'all 0.2s' },
  cardTopLine:  { height: 4, flexShrink: 0 },
  cardHeader:   { display: 'flex', alignItems: 'flex-start', gap: 14, padding: '20px 24px 0' },
  iconWrap:     { width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  productName:  { fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 3px' },
  productDesc:  { fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.5 },

  divider:      { height: 1, background: 'var(--border)', margin: '16px 24px' },
  featuresGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', padding: '0 24px' },
  featureItem:  { display: 'flex', alignItems: 'flex-start', gap: 7 },
  featureText:  { fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 },

  cardFooter:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' },
  priceRow:     { display: 'flex', alignItems: 'baseline', gap: 2 },
  priceCurrency:{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', marginTop: 4 },
  priceNum:     { fontSize: 34, fontWeight: 800, lineHeight: 1, fontFamily: 'var(--font-mono)' },
  pricePer:     { fontSize: 12, color: 'var(--text-muted)', marginLeft: 3 },
  priceMonthly: { fontSize: 11, color: 'var(--text-muted)', marginTop: 2 },
  ctaBtn:       { display: 'flex', alignItems: 'center', gap: 7, padding: '11px 18px', borderRadius: 9, borderWidth: 2, borderStyle: 'solid', fontSize: 13, fontWeight: 700, transition: 'all 0.15s', whiteSpace: 'nowrap' },
  trialNote:    { fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 24px 18px', margin: 0 },

  emptyState: { textAlign: 'center', padding: '60px 40px', background: 'var(--bg-surface)', borderRadius: 14, border: '1px dashed var(--border)', marginBottom: 24 },

  bundle:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)', borderRadius: 14, padding: '28px 32px', marginBottom: 24, marginTop: 32 },
  bundleEyebrow:{ fontSize: 9, letterSpacing: '3px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 6 },
  bundleTitle:  { fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 6px' },
  bundleSub:    { fontSize: 13, color: 'rgba(255,255,255,0.65)', maxWidth: 480, lineHeight: 1.6 },
  bundleBtn:    { display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, padding: '12px 22px', borderRadius: 9, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', marginLeft: 32 },

  trustRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  trustItem:{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', flex: 1, minWidth: 180, justifyContent: 'center' },
};
