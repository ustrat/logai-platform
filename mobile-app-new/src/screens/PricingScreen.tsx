import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, ActivityIndicator, Linking, Alert,
} from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Colors } from '../theme';
import api from '../services/api';

const mono = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

const PAYMENTS_BASE = 'https://m4w7fhqthd.execute-api.us-east-1.amazonaws.com/v1';

const PRICE_IDS = {
  starter_monthly:    'price_1TLyJ4LPtSno8ya1rzXzk14y',
  starter_annual:     'price_1TLyJ4LPtSno8ya1rzXzk14y',
  pro_monthly:        'price_1TLyK9LPtSno8ya1V2VQKt6e',
  pro_annual:         'price_1TLyK9LPtSno8ya1V2VQKt6e',
  enterprise_monthly: 'price_1TLyJ4LPtSno8ya1rzXzk14y',
  enterprise_annual:  'price_1TLyJ4LPtSno8ya1rzXzk14y',
} as const;

type PriceKey = keyof typeof PRICE_IDS;

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    tagline: 'For growing teams',
    monthlyPrice: 29,
    annualPrice: 23,
    priceKey_monthly: 'starter_monthly' as PriceKey,
    priceKey_annual:  'starter_annual'  as PriceKey,
    color: '#1d4ed8',
    icon: '🛡',
    features: ['Up to 5 users', '1,000 accounts', 'Renewal risk scoring', 'Plaid integration', 'Email alerts'],
  },
  {
    key: 'pro',
    name: 'Pro',
    tagline: 'For scaling revenue teams',
    monthlyPrice: 79,
    annualPrice: 63,
    priceKey_monthly: 'pro_monthly' as PriceKey,
    priceKey_annual:  'pro_annual'  as PriceKey,
    color: '#7c3aed',
    icon: '⚡',
    featured: true,
    features: ['Up to 25 users', '10,000 accounts', 'Advanced ML predictions', 'Subscription intelligence', 'Case feed & workflow', 'Priority support'],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    tagline: 'For large organisations',
    monthlyPrice: null,
    annualPrice: null,
    priceKey_monthly: 'enterprise_monthly' as PriceKey,
    priceKey_annual:  'enterprise_annual'  as PriceKey,
    color: '#f59e0b',
    icon: '★',
    features: ['Unlimited users', 'Unlimited accounts', 'Custom ML models', 'White-label', 'SSO / SAML', '24/7 phone support'],
  },
] as const;

async function paymentsRequest(path: string, body?: object) {
  const token = api.defaults.headers.common['Authorization'];
  const res   = await fetch(`${PAYMENTS_BASE}${path}`, {
    method:  body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token as string } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export default function PricingScreen() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const { data: sub } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: () => paymentsRequest('/subscription').catch(() => null),
    retry: false,
  });

  const checkout = useMutation({
    mutationFn: async ({ priceKey, planKey }: { priceKey: PriceKey; planKey: string }) => {
      setLoadingPlan(planKey);
      const priceId    = PRICE_IDS[priceKey];
      const successUrl = 'valuepilot://pricing?checkout=success';
      const cancelUrl  = 'valuepilot://pricing?checkout=cancelled';
      const data = await paymentsRequest('/checkout/session', { price_id: priceId, success_url: successUrl, cancel_url: cancelUrl });
      return data;
    },
    onSuccess: (data) => {
      setLoadingPlan(null);
      if (data?.checkout_url) {
        Linking.openURL(data.checkout_url).catch(() =>
          Alert.alert('Error', 'Could not open checkout. Please try again.'),
        );
      }
    },
    onError: () => {
      setLoadingPlan(null);
      Alert.alert('Checkout Unavailable', 'Could not start checkout. Make sure you are logged in and try again.');
    },
  });

  const currentPlanKey = sub?.subscription?.plan?.toLowerCase?.() ?? null;
  const isActive       = sub?.subscription?.status === 'active';

  const handleCTA = (plan: typeof PLANS[number]) => {
    if (plan.key === 'enterprise') {
      Linking.openURL('mailto:sales@valuepilot.io?subject=Enterprise Inquiry');
      return;
    }
    const priceKey = billing === 'monthly' ? plan.priceKey_monthly : plan.priceKey_annual;
    checkout.mutate({ priceKey, planKey: plan.key });
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={s.header}>
        <Text style={s.eyebrow}>VALUEPILOT PLANS</Text>
        <Text style={s.title}>Simple, transparent{'\n'}pricing</Text>
        <Text style={s.sub}>Start free. Scale as you grow. Cancel any time.</Text>
      </View>

      {/* ── Current plan banner ─────────────────────────────────── */}
      {isActive && (
        <View style={s.activeBanner}>
          <View style={s.activeDot} />
          <Text style={s.activeBannerText}>
            <Text style={{ fontWeight: '700' }}>{sub.subscription.plan}</Text> plan is active
          </Text>
        </View>
      )}

      {/* ── Billing toggle ──────────────────────────────────────── */}
      <View style={s.toggle}>
        <TouchableOpacity
          style={[s.toggleBtn, billing === 'monthly' && s.toggleActive]}
          onPress={() => setBilling('monthly')}
        >
          <Text style={[s.toggleText, billing === 'monthly' && s.toggleTextActive]}>Monthly</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.toggleBtn, billing === 'annual' && s.toggleActive]}
          onPress={() => setBilling('annual')}
        >
          <Text style={[s.toggleText, billing === 'annual' && s.toggleTextActive]}>Annual</Text>
          <View style={s.saveBadge}><Text style={s.saveBadgeText}>−20%</Text></View>
        </TouchableOpacity>
      </View>

      {/* ── Plan cards ──────────────────────────────────────────── */}
      {PLANS.map(plan => {
        const price     = billing === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
        const isCurrent = currentPlanKey === plan.key && isActive;
        const isLoading = loadingPlan === plan.key;

        return (
          <View
            key={plan.key}
            style={[s.card, plan.featured && s.cardFeatured, isCurrent && { borderColor: plan.color, borderWidth: 2 }]}
          >
            {plan.featured && (
              <View style={[s.featuredBadge, { backgroundColor: plan.color }]}>
                <Text style={s.featuredBadgeText}>MOST POPULAR</Text>
              </View>
            )}
            {isCurrent && (
              <View style={[s.currentBadge, { backgroundColor: plan.color }]}>
                <Text style={s.currentBadgeText}>CURRENT PLAN</Text>
              </View>
            )}

            {/* Plan top */}
            <View style={s.cardTop}>
              <View style={[s.iconWrap, { backgroundColor: plan.color + '18' }]}>
                <Text style={s.icon}>{plan.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.planName}>{plan.name}</Text>
                <Text style={s.planTagline}>{plan.tagline}</Text>
              </View>
            </View>

            {/* Price */}
            <View style={s.priceRow}>
              {price !== null ? (
                <>
                  <Text style={s.priceCurrency}>$</Text>
                  <Text style={[s.priceNum, { color: plan.featured ? plan.color : Colors.textPrimary }]}>
                    {price}
                  </Text>
                  <Text style={s.pricePer}>
                    {'/mo'}{billing === 'annual' ? '\nbilled annually' : ''}
                  </Text>
                </>
              ) : (
                <Text style={[s.priceCustom, { color: plan.color }]}>Custom</Text>
              )}
            </View>

            {/* Features */}
            <View style={s.features}>
              {plan.features.map(f => (
                <View key={f} style={s.featureRow}>
                  <Text style={[s.checkmark, { color: plan.color }]}>✓</Text>
                  <Text style={s.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            {/* CTA */}
            <TouchableOpacity
              style={[
                s.cta,
                plan.featured
                  ? { backgroundColor: plan.color, borderColor: plan.color }
                  : { backgroundColor: 'transparent', borderColor: plan.color },
                isCurrent && { opacity: 0.5 },
              ]}
              onPress={() => handleCTA(plan)}
              disabled={isLoading || isCurrent}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={plan.featured ? '#fff' : plan.color} size="small" />
              ) : (
                <Text style={[s.ctaText, { color: plan.featured ? '#fff' : plan.color }]}>
                  {isCurrent ? 'Current plan' : plan.key === 'enterprise' ? 'Contact Sales' : `Start ${plan.name} →`}
                </Text>
              )}
            </TouchableOpacity>

            {plan.key !== 'enterprise' && !isCurrent && (
              <Text style={s.trialNote}>14-day free trial · No card required</Text>
            )}
          </View>
        );
      })}

      {/* ── Trust signals ────────────────────────────────────────── */}
      <View style={s.trustRow}>
        {['🔒  Bank-grade encryption', '✦  SOC2 Type II', '↩  Cancel any time'].map(t => (
          <View key={t} style={s.trustItem}>
            <Text style={s.trustText}>{t}</Text>
          </View>
        ))}
      </View>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <View style={s.faqSection}>
        <Text style={s.faqTitle}>Common questions</Text>
        {[
          { q: 'Can I switch plans?', a: 'Yes, upgrade or downgrade any time. Prorated credits apply.' },
          { q: 'How does the free trial work?', a: '14 days free on any plan. Your card is not charged until the trial ends.' },
          { q: 'Can I cancel?', a: 'Cancel any time from account settings. Your plan stays active until period end.' },
        ].map(({ q, a }) => (
          <View key={q} style={s.faqCard}>
            <Text style={s.faqQ}>{q}</Text>
            <Text style={s.faqA}>{a}</Text>
          </View>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bgBase },
  scroll: { padding: 20 },

  header:  { marginBottom: 24 },
  eyebrow: { fontSize: 9, letterSpacing: 3, color: Colors.blue, fontWeight: '700', marginBottom: 8 },
  title:   { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, fontFamily: mono, lineHeight: 34, marginBottom: 8 },
  sub:     { fontSize: 13, color: Colors.textMuted, lineHeight: 20 },

  activeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(22,163,74,0.08)', borderWidth: 1, borderColor: 'rgba(22,163,74,0.3)',
    borderRadius: 8, padding: 12, marginBottom: 20,
  },
  activeDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.green },
  activeBannerText: { fontSize: 13, color: Colors.green },

  toggle: {
    flexDirection: 'row', alignSelf: 'center',
    backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 30, padding: 4, marginBottom: 24, gap: 4,
  },
  toggleBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 26 },
  toggleActive:    { backgroundColor: Colors.navy },
  toggleText:      { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  toggleTextActive: { color: '#fff' },
  saveBadge:       { backgroundColor: Colors.greenDim, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  saveBadgeText:   { fontSize: 9, fontWeight: '800', color: Colors.green },

  card: {
    backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 16, padding: 20, marginBottom: 16, position: 'relative',
    overflow: 'hidden',
  },
  cardFeatured: {
    borderColor: '#7c3aed', borderWidth: 2,
    shadowColor: '#7c3aed', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  featuredBadge: {
    position: 'absolute', top: 0, right: 0,
    paddingHorizontal: 14, paddingVertical: 6,
    borderBottomLeftRadius: 10,
  },
  featuredBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  currentBadge: {
    position: 'absolute', top: 0, left: 0,
    paddingHorizontal: 14, paddingVertical: 6,
    borderBottomRightRadius: 10,
  },
  currentBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 1 },

  cardTop:  { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16, marginTop: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  icon:     { fontSize: 20 },
  planName: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  planTagline: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  priceRow:     { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginBottom: 20 },
  priceCurrency: { fontSize: 16, fontWeight: '700', color: Colors.textSecondary, marginTop: 4 },
  priceNum:      { fontSize: 44, fontWeight: '800', fontFamily: mono, lineHeight: 48 },
  pricePer:      { fontSize: 11, color: Colors.textMuted, marginLeft: 4 },
  priceCustom:   { fontSize: 32, fontWeight: '800', fontFamily: mono },

  features:   { gap: 10, marginBottom: 22 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkmark:  { fontSize: 14, fontWeight: '700', width: 16 },
  featureText: { fontSize: 13, color: Colors.textSecondary, flex: 1 },

  cta: {
    paddingVertical: 14, borderRadius: 10, borderWidth: 2,
    alignItems: 'center', marginBottom: 10,
  },
  ctaText:   { fontSize: 15, fontWeight: '700' },
  trialNote: { fontSize: 11, color: Colors.textMuted, textAlign: 'center' },

  trustRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28, justifyContent: 'center' },
  trustItem: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  trustText: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },

  faqSection: { gap: 10 },
  faqTitle:   { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  faqCard:    { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 14 },
  faqQ:       { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  faqA:       { fontSize: 12, color: Colors.textMuted, lineHeight: 18 },
});
