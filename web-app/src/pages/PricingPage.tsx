import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Check, ExternalLink, Loader2, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { paymentsApi } from '../services/paymentsApi';

// Accent palette cycles through products in order
const ACCENTS = [
  { accent: '#1e3a5f', light: 'rgba(30,58,95,0.07)',   border: 'rgba(30,58,95,0.18)',   icon: '⬡' },
  { accent: '#7c3aed', light: 'rgba(124,58,237,0.07)', border: 'rgba(124,58,237,0.18)', icon: '↺' },
  { accent: '#0891b2', light: 'rgba(8,145,178,0.07)',  border: 'rgba(8,145,178,0.18)',  icon: '◈' },
  { accent: '#b45309', light: 'rgba(180,83,9,0.07)',   border: 'rgba(180,83,9,0.18)',   icon: '◆' },
  { accent: '#15803d', light: 'rgba(21,128,61,0.07)',  border: 'rgba(21,128,61,0.18)',  icon: '◉' },
];

interface StripePrice {
  priceId: string;
  amount: number;
  currency: string;
  interval: string | null;
  intervalCount: number;
}

interface StripeProduct {
  productId: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: StripePrice[];
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency.toUpperCase(),
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100);
}

function intervalLabel(price: StripePrice) {
  if (!price.interval) return 'one-time';
  const count = price.intervalCount > 1 ? `${price.intervalCount} ` : '';
  return `every ${count}${price.interval}`;
}

export default function PricingPage() {
  const [selectedPrices, setSelectedPrices] = useState<Record<string, string>>({});
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);

  const params         = new URLSearchParams(window.location.search);
  const checkoutStatus = params.get('checkout');

  // Fetch products live from Stripe
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['stripe-products'],
    queryFn: () => paymentsApi.getProducts().then(r => r.data?.data?.products as StripeProduct[]),
    staleTime: 60_000,
  });

  // Fetch active subscriptions
  const { data: subData } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: () => paymentsApi.getSubscription().then(r => r.data?.data ?? null),
    retry: false,
  });

  const activeProductIds = new Set<string>(
    (subData?.subscriptions ?? [])
      .filter((s: any) => ['active', 'trialing', 'past_due'].includes(s.status))
      .map((s: any) => s.productId)
      .filter(Boolean)
  );

  const checkout = useMutation({
    mutationFn: async ({ priceId, productId }: { priceId: string; productId: string }) => {
      setLoadingProductId(productId);
      const successUrl = `${window.location.origin}/pricing?checkout=success`;
      const cancelUrl  = `${window.location.origin}/pricing?checkout=cancelled`;
      return paymentsApi.createCheckoutSession(priceId, successUrl, cancelUrl).then(r => r.data);
    },
    onSuccess: (data) => {
      const url = data?.data?.checkoutUrl;
      if (url) window.location.href = url;
      else setLoadingProductId(null);
    },
    onError: () => setLoadingProductId(null),
  });

  const portal = useMutation({
    mutationFn: () => paymentsApi.createPortalSession().then(r => r.data),
    onSuccess: (data) => { if (data?.data?.portalUrl) window.location.href = data.data.portalUrl; },
  });

  const products = productsData ?? [];

  const handleSubscribe = (product: StripeProduct) => {
    const priceId = selectedPrices[product.productId] ?? product.prices[0]?.priceId;
    if (!priceId) return;
    checkout.mutate({ priceId, productId: product.productId });
  };

  const getSelectedPrice = (product: StripeProduct): StripePrice | undefined => {
    const id = selectedPrices[product.productId];
    return product.prices.find(p => p.priceId === id) ?? product.prices[0];
  };

  return (
    <div style={S.page}>

      {/* ── Status banners ──────────────────────────────────────── */}
      {checkoutStatus === 'success' && (
        <div style={{ ...S.banner, ...S.bannerSuccess }}>
          <CheckCircle2 size={15} />
          <span>Payment confirmed — your subscription is now active.</span>
        </div>
      )}
      {checkoutStatus === 'cancelled' && (
        <div style={{ ...S.banner, ...S.bannerWarn }}>
          <AlertCircle size={15} />
          <span>Checkout cancelled — no charge was made.</span>
        </div>
      )}

      {/* ── Active subscription bar ─────────────────────────────── */}
      {activeProductIds.size > 0 && (
        <div style={S.activeBanner}>
          <div style={S.activeBannerLeft}>
            <div style={S.activeDot} />
            <span style={S.activeTxt}>
              {Array.from(activeProductIds).length === 1
                ? `${subData.subscriptions.find((s: any) => activeProductIds.has(s.productId))?.productName} is active`
                : `${activeProductIds.size} active subscriptions`}
            </span>
          </div>
          <button style={S.manageBtn} onClick={() => portal.mutate()} disabled={portal.isPending}>
            {portal.isPending ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : <ExternalLink size={12} />}
            Manage billing
          </button>
        </div>
      )}

      {/* ── Hero ────────────────────────────────────────────────── */}
      <div style={S.hero}>
        <p style={S.eyebrow}>VALUEPILOT PRODUCTS</p>
        <h1 style={S.heroTitle}>Revenue intelligence,<br />built for every team</h1>
        <p style={S.heroSub}>14-day free trial on every product · No credit card required · Cancel any time</p>
      </div>

      {/* ── Loading skeleton ────────────────────────────────────── */}
      {productsLoading && (
        <div style={S.loadingRow}>
          {[0, 1].map(i => <div key={i} style={S.skeleton} />)}
        </div>
      )}

      {/* ── Product cards ───────────────────────────────────────── */}
      {!productsLoading && products.length > 0 && (
        <div style={{ ...S.cardGrid, gridTemplateColumns: products.length === 1 ? '560px' : `repeat(${Math.min(products.length, 3)}, 1fr)`, justifyContent: 'center' }}>
          {products.map((product, i) => {
            const theme      = ACCENTS[i % ACCENTS.length];
            const isActive   = activeProductIds.has(product.productId);
            const isLoading  = loadingProductId === product.productId;
            const selPrice   = getSelectedPrice(product);
            const hasMultiple = product.prices.length > 1;

            return (
              <div key={product.productId} style={{ ...S.card, borderColor: isActive ? theme.accent : '#e5e7eb', opacity: isActive ? 0.7 : 1 }}>
                <div style={{ ...S.cardTopLine, backgroundColor: theme.accent }} />

                {/* Header */}
                <div style={S.cardHeader}>
                  <div style={{ ...S.iconWrap, backgroundColor: theme.light, border: `1px solid ${theme.border}` }}>
                    <span style={{ color: theme.accent, fontSize: 18, fontWeight: 700 }}>{theme.icon}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h2 style={S.productName}>{product.name}</h2>
                      {isActive && (
                        <span style={{ ...S.pill, background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
                          ✓ Active
                        </span>
                      )}
                    </div>
                    {product.description && (
                      <p style={S.productDesc}>{product.description}</p>
                    )}
                  </div>
                </div>

                {/* Metadata features (from Stripe product metadata) */}
                {Object.keys(product.metadata).filter(k => k.startsWith('feature_')).length > 0 && (
                  <>
                    <div style={S.divider} />
                    <div style={S.featuresGrid}>
                      {Object.entries(product.metadata)
                        .filter(([k]) => k.startsWith('feature_'))
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([k, v]) => (
                          <div key={k} style={S.featureItem}>
                            <Check size={12} color={theme.accent} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2 }} />
                            <span style={S.featureText}>{v}</span>
                          </div>
                        ))}
                    </div>
                  </>
                )}

                <div style={{ flex: 1 }} />
                <div style={S.divider} />

                {/* Price selector (if multiple prices) */}
                {hasMultiple && (
                  <div style={S.priceSelector}>
                    {product.prices.map(p => (
                      <button
                        key={p.priceId}
                        style={{
                          ...S.priceOption,
                          ...(getSelectedPrice(product)?.priceId === p.priceId
                            ? { borderColor: theme.accent, background: theme.light, color: theme.accent }
                            : {}),
                        }}
                        onClick={() => setSelectedPrices(prev => ({ ...prev, [product.productId]: p.priceId }))}
                      >
                        <span style={{ fontWeight: 700 }}>{formatAmount(p.amount, p.currency)}</span>
                        <span style={{ fontSize: 11, opacity: 0.7 }}>{intervalLabel(p)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Price + CTA */}
                <div style={S.cardFooter}>
                  {selPrice && (
                    <div>
                      <div style={S.priceRow}>
                        <span style={S.priceCurrency}>{selPrice.currency.toUpperCase() === 'USD' ? '$' : selPrice.currency.toUpperCase()}</span>
                        <span style={{ ...S.priceNum, color: theme.accent }}>
                          {(selPrice.amount / 100).toLocaleString('en-US', { minimumFractionDigits: selPrice.amount % 100 === 0 ? 0 : 2 })}
                        </span>
                        <span style={S.pricePer}>/{selPrice.interval ?? 'one-time'}</span>
                      </div>
                      {selPrice.interval === 'year' && (
                        <div style={S.priceMonthly}>
                          ~{formatAmount(Math.round(selPrice.amount / 12), selPrice.currency)}/mo
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    style={{
                      ...S.ctaBtn,
                      backgroundColor: isActive ? 'transparent' : theme.accent,
                      borderColor: theme.accent,
                      color: isActive ? theme.accent : '#fff',
                      cursor: isActive ? 'default' : 'pointer',
                    }}
                    onClick={() => !isActive && handleSubscribe(product)}
                    disabled={isActive || isLoading || checkout.isPending}
                  >
                    {isLoading
                      ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                      : isActive
                      ? 'Subscribed'
                      : <><span>Start free trial</span> <ArrowRight size={13} /></>
                    }
                  </button>
                </div>

                {!isActive && <p style={S.trialNote}>14-day trial · No credit card required</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────── */}
      {!productsLoading && products.length === 0 && (
        <div style={S.emptyState}>
          <p style={{ fontWeight: 600, color: '#374151' }}>No products available</p>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Add products in your Stripe dashboard — they'll appear here automatically.</p>
        </div>
      )}

      {/* ── Bundle callout ──────────────────────────────────────── */}
      {products.length > 1 && (
        <div style={S.bundle}>
          <div>
            <p style={S.bundleEyebrow}>BUNDLE & SAVE</p>
            <h3 style={S.bundleTitle}>Subscribe to all {products.length} products</h3>
            <p style={S.bundleSub}>Get the full ValuePilot platform at a discounted bundle rate. Contact us for pricing.</p>
          </div>
          <a href="mailto:sales@valuepilot.io?subject=Bundle Pricing" style={S.bundleBtn}>
            Talk to sales <ExternalLink size={13} />
          </a>
        </div>
      )}

      {/* ── Trust row ───────────────────────────────────────────── */}
      <div style={S.trustRow}>
        {['🔒  Bank-grade encryption', '✦  SOC2 Type II', '↩  Cancel any time', '🤝  Onboarding support'].map(t => (
          <div key={t} style={S.trustItem}><span style={{ fontSize: 12, color: '#6b7280' }}>{t}</span></div>
        ))}
      </div>

    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: '32px 40px 60px', maxWidth: 1080, margin: '0 auto', fontFamily: 'var(--font-display)' },

  banner: { display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, marginBottom: 16 },
  bannerSuccess: { background: '#dcfce7', border: '1px solid #86efac', color: '#15803d' },
  bannerWarn:    { background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e' },

  activeBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 18px', marginBottom: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  activeBannerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  activeDot: { width: 8, height: 8, borderRadius: 4, background: '#16a34a', flexShrink: 0 },
  activeTxt: { fontSize: 13, fontWeight: 600, color: '#111827' },
  manageBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, background: '#fff', border: '1px solid #e5e7eb', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' },

  hero:      { textAlign: 'center', marginBottom: 36 },
  eyebrow:   { fontSize: 10, letterSpacing: '3px', color: '#1d4ed8', fontWeight: 700, marginBottom: 12 },
  heroTitle: { fontSize: 32, fontWeight: 800, color: '#111827', lineHeight: 1.25, marginBottom: 10 },
  heroSub:   { fontSize: 13, color: '#6b7280' },

  loadingRow: { display: 'flex', gap: 20, marginBottom: 24 },
  skeleton:   { flex: 1, height: 420, background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)', borderRadius: 14, backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' },

  cardGrid: { display: 'grid', gap: 20, marginBottom: 24 },
  card: { background: '#fff', borderRadius: 14, borderWidth: 2, borderStyle: 'solid', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'opacity 0.2s' },
  cardTopLine: { height: 4, flexShrink: 0 },
  cardHeader: { display: 'flex', alignItems: 'flex-start', gap: 14, padding: '20px 24px 0' },
  iconWrap: { width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  productName: { fontSize: 19, fontWeight: 800, color: '#111827', margin: '0 0 3px' },
  productDesc: { fontSize: 12, color: '#6b7280', margin: '4px 0 0', lineHeight: 1.5 },
  pill: { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 },

  divider: { height: 1, background: '#f3f4f6', margin: '16px 24px' },

  featuresGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', padding: '0 24px' },
  featureItem:  { display: 'flex', alignItems: 'flex-start', gap: 7 },
  featureText:  { fontSize: 12, color: '#374151', lineHeight: 1.4 },

  priceSelector: { display: 'flex', gap: 8, padding: '0 24px', marginBottom: 4, flexWrap: 'wrap' },
  priceOption: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fafafa', cursor: 'pointer', fontSize: 13, color: '#374151', transition: 'all 0.15s' },

  cardFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' },
  priceRow:   { display: 'flex', alignItems: 'baseline', gap: 2 },
  priceCurrency: { fontSize: 15, fontWeight: 700, color: '#374151', marginTop: 4 },
  priceNum:   { fontSize: 34, fontWeight: 800, lineHeight: 1, fontFamily: 'var(--font-mono)' },
  pricePer:   { fontSize: 12, color: '#9ca3af', marginLeft: 3 },
  priceMonthly: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  ctaBtn: { display: 'flex', alignItems: 'center', gap: 7, padding: '11px 18px', borderRadius: 9, borderWidth: 2, borderStyle: 'solid', fontSize: 13, fontWeight: 700, transition: 'all 0.15s', whiteSpace: 'nowrap' },
  trialNote: { fontSize: 11, color: '#9ca3af', textAlign: 'center', padding: '8px 24px 18px', margin: 0 },

  emptyState: { textAlign: 'center', padding: '60px 40px', background: '#fff', borderRadius: 14, border: '1px dashed #d1d5db', marginBottom: 24 },

  bundle: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)', borderRadius: 14, padding: '28px 32px', marginBottom: 24 },
  bundleEyebrow: { fontSize: 9, letterSpacing: '3px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 6 },
  bundleTitle: { fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 6px' },
  bundleSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', maxWidth: 480, lineHeight: 1.6 },
  bundleBtn: { display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, padding: '12px 22px', borderRadius: 9, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', marginLeft: 32 },

  trustRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  trustItem: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 14px', flex: 1, minWidth: 180, justifyContent: 'center' },
};
