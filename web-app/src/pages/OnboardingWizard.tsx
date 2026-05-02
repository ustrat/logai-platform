import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, ArrowRight, Loader2, Zap, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { catalogApi, paymentsApi } from '../services/paymentsApi';
import api from '../services/api';

function AuthLoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTop: '3px solid var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Setting up your workspace…</p>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

type BillingPeriod = 'monthly' | 'annual';

interface CatalogProduct {
  productKey: string;
  name: string;
  description: string;
  tagline?: string;
  category: 'plan' | 'addon';
  sortOrder: number;
  featureKeys: string[];
  features: string[];
  prices: { monthly: number | null; annual: number | null };
  hasStripeSync: boolean;
}

declare global {
  interface Window { Plaid: any; }
}

// ── Constants ──────────────────────────────────────────────────────────────

const STEPS = ['Choose Plan', 'Account Setup', 'Connect Bank'];

const PLAN_THEMES = [
  { accent: '#1d4ed8', light: 'rgba(29,78,216,0.08)', border: 'rgba(29,78,216,0.22)' },
  { accent: '#7c3aed', light: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.22)' },
  { accent: '#0891b2', light: 'rgba(8,145,178,0.08)', border: 'rgba(8,145,178,0.22)' },
];

function fmt(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
}

// ── Step bar ───────────────────────────────────────────────────────────────

function StepBar({ current }: { current: number }) {
  const dotItems = STEPS.flatMap((_, i) => {
    const stepNum = i + 1;
    const done   = current > stepNum;
    const active = current === stepNum;

    const dot = (
      <div key={`dot-${i}`} style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        background: done ? '#16a34a' : active ? '#1d4ed8' : 'var(--bg-elevated)',
        border: `2px solid ${done ? '#16a34a' : active ? '#1d4ed8' : 'var(--border)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: done || active ? '#fff' : 'var(--text-muted)',
        fontWeight: 700, fontSize: 13, transition: 'all 0.3s',
        boxShadow: active ? '0 0 0 4px rgba(29,78,216,0.15)' : 'none',
      }}>
        {done ? <Check size={15} strokeWidth={2.5} /> : stepNum}
      </div>
    );

    if (i < STEPS.length - 1) {
      return [dot, (
        <div key={`line-${i}`} style={{
          flex: 1, height: 2, minWidth: 40,
          background: current > i + 1 ? '#16a34a' : 'var(--border)',
          transition: 'background 0.4s', margin: '0 4px',
        }} />
      )];
    }
    return [dot];
  });

  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>{dotItems}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        {STEPS.map((label, i) => (
          <span key={i} style={{
            fontSize: 11, letterSpacing: '0.3px',
            fontWeight: current === i + 1 ? 700 : 500,
            color: current === i + 1 ? 'var(--text-primary)' : current > i + 1 ? '#16a34a' : 'var(--text-muted)',
            flex: i === 1 ? 1 : 'none',
            textAlign: i === 0 ? 'left' : i === 2 ? 'right' : 'center',
          }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Step 1 — Choose Plan ───────────────────────────────────────────────────

function StepPlan({
  plans, catalogLoading, period, setPeriod, onCheckout, checkoutLoading,
}: {
  plans: CatalogProduct[];
  catalogLoading: boolean;
  period: BillingPeriod;
  setPeriod: (p: BillingPeriod) => void;
  onCheckout: (productKey: string) => void;
  checkoutLoading: string | null;
}) {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <p style={{ fontSize: 10, letterSpacing: '3px', color: '#1d4ed8', fontWeight: 700, marginBottom: 10 }}>STEP 1 OF 3</p>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px', fontFamily: 'var(--font-display)' }}>
          Choose your plan
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 22px' }}>
          14-day free trial on every product · No credit card required · Cancel any time
        </p>

        {/* Billing toggle */}
        <div style={{ display: 'inline-flex', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, gap: 4 }}>
          {(['monthly', 'annual'] as BillingPeriod[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '7px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: period === p ? 700 : 500,
              color: period === p ? 'var(--text-primary)' : 'var(--text-muted)',
              background: period === p ? 'var(--bg-surface)' : 'transparent',
              boxShadow: period === p ? 'var(--shadow-sm)' : 'none',
              display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
            }}>
              {p === 'monthly' ? 'Monthly' : 'Annual'}
              {p === 'annual' && (
                <span style={{ fontSize: 10, background: '#dcfce7', color: '#15803d', padding: '1px 7px', borderRadius: 10, fontWeight: 700 }}>
                  Save 17%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Loading shimmer */}
      {catalogLoading && (
        <div style={{ display: 'flex', gap: 20 }}>
          {[0, 1].map(i => (
            <div key={i} style={{ flex: 1, height: 380, borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)', animation: 'shimmer 1.5s infinite', backgroundSize: '200% 100%' }} />
          ))}
        </div>
      )}

      {/* Plan cards */}
      {!catalogLoading && plans.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(plans.length, 3)}, 1fr)`, gap: 20 }}>
          {plans.map((product, i) => {
            const theme = PLAN_THEMES[i % PLAN_THEMES.length];
            const price = period === 'annual' && product.prices.annual
              ? product.prices.annual
              : product.prices.monthly ?? product.prices.annual ?? 0;
            const displayInterval = period === 'annual' && product.prices.annual ? 'year' : 'month';
            const monthlyCost = period === 'annual' && product.prices.annual
              ? Math.round(product.prices.annual / 12) : null;

            return (
              <div key={product.productKey} style={{
                background: 'var(--bg-surface)', borderRadius: 14,
                border: `2px solid var(--border)`, boxShadow: 'var(--shadow-sm)',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = theme.accent;
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 24px ${theme.border}`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                {/* Color bar */}
                <div style={{ height: 4, background: theme.accent }} />

                {/* Header */}
                <div style={{ padding: '22px 24px 0', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: theme.light, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Zap size={20} color={theme.accent} strokeWidth={2.5} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{product.name}</h3>
                      {product.tagline && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: theme.light, color: theme.accent, border: `1px solid ${theme.border}` }}>
                          {product.tagline}
                        </span>
                      )}
                    </div>
                    {product.description && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{product.description}</p>
                    )}
                  </div>
                </div>

                {/* Features */}
                {product.features.length > 0 && (
                  <>
                    <div style={{ height: 1, background: 'var(--border)', margin: '16px 24px' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', padding: '0 24px' }}>
                      {product.features.map((f, fi) => (
                        <div key={fi} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                          <Check size={12} color={theme.accent} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2 }} />
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{f}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div style={{ flex: 1 }} />
                <div style={{ height: 1, background: 'var(--border)', margin: '16px 24px' }} />

                {/* Price + CTA */}
                <div style={{ padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', marginTop: 4 }}>$</span>
                      <span style={{ fontSize: 36, fontWeight: 800, color: theme.accent, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>
                        {(price / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 3 }}>/{displayInterval}</span>
                    </div>
                    {monthlyCost && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>~{fmt(monthlyCost)}/mo · billed annually</div>
                    )}
                    {period === 'annual' && product.prices.annual && product.prices.monthly && (
                      <div style={{ fontSize: 11, color: theme.accent, fontWeight: 600, marginTop: 2 }}>
                        Save {fmt(product.prices.monthly * 12 - product.prices.annual)}/yr
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => onCheckout(product.productKey)}
                    disabled={checkoutLoading !== null}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '11px 18px', borderRadius: 9, border: `2px solid ${theme.accent}`,
                      background: theme.accent, color: '#fff',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      opacity: checkoutLoading !== null && checkoutLoading !== product.productKey ? 0.5 : 1,
                      whiteSpace: 'nowrap', transition: 'opacity 0.15s',
                    }}
                  >
                    {checkoutLoading === product.productKey
                      ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                      : <><span>Start free trial</span><ArrowRight size={13} /></>}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 24px 18px', margin: 0 }}>
                  14-day trial · No credit card required
                </p>
              </div>
            );
          })}
        </div>
      )}

      {!catalogLoading && plans.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 40px', background: 'var(--bg-surface)', border: '1px dashed var(--border)', borderRadius: 14 }}>
          <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No plans available</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Contact your administrator to seed the product catalog.</p>
        </div>
      )}
    </div>
  );
}

// ── Step 2 — Account Setup ─────────────────────────────────────────────────

function StepAccount({
  userEmail, workEmail, setWorkEmail, tosAccepted, setTosAccepted, onContinue,
}: {
  userEmail: string;
  workEmail: string;
  setWorkEmail: (v: string) => void;
  tosAccepted: boolean;
  setTosAccepted: (v: boolean) => void;
  onContinue: () => void;
}) {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <p style={{ fontSize: 10, letterSpacing: '3px', color: '#1d4ed8', fontWeight: 700, marginBottom: 10 }}>STEP 2 OF 3</p>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px', fontFamily: 'var(--font-display)' }}>
          Set up your account
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
          Verify your identity and accept our terms to continue.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Email verified row */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ fontSize: 10, letterSpacing: '2px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 14 }}>VERIFIED IDENTITY</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShieldCheck size={20} color="#16a34a" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{userEmail}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Verified via single sign-on</div>
              </div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', color: '#16a34a', background: 'rgba(22,163,74,0.1)', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(22,163,74,0.2)' }}>
              VERIFIED
            </span>
          </div>
        </div>

        {/* Work email input */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
          <label style={{ fontSize: 10, letterSpacing: '2px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 10, display: 'block' }}>
            EMAIL ACCOUNT FOR NOTIFICATIONS
          </label>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
            This email will receive alerts, renewal reminders, and subscription intelligence reports.
          </p>
          <input
            type="email"
            value={workEmail}
            onChange={e => setWorkEmail(e.target.value)}
            placeholder="your@company.com"
            style={{
              width: '100%', padding: '10px 12px',
              background: 'var(--bg-base)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text-primary)',
              fontSize: 14, outline: 'none', boxSizing: 'border-box',
              fontFamily: 'var(--font-mono)',
            }}
          />
        </div>

        {/* Mobile app downloads */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ fontSize: 10, letterSpacing: '2px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>MOBILE APP</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.6 }}>
            Manage subscriptions and receive alerts on the go. Available soon on iOS and Android.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            {/* App Store */}
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 14px', background: 'var(--bg-base)',
              border: '1px solid var(--border)', borderRadius: 10,
              position: 'relative', opacity: 0.65, userSelect: 'none',
            }}>
              <svg width="20" height="24" viewBox="0 0 20 24" fill="currentColor" style={{ color: 'var(--text-primary)', flexShrink: 0 }}>
                <path d="M16.5 12.5c0-2.9 2.4-4.3 2.5-4.4-1.4-2-3.5-2.2-4.2-2.2-1.8-.2-3.5 1-4.4 1-1 0-2.4-1-3.9-1-2 0-3.9 1.2-4.9 3-2.1 3.6-.6 9 1.5 11.9 1 1.4 2.2 3 3.8 3 1.5-.1 2-1 3.8-1 1.9 0 2.4 1 3.9 1 1.6 0 2.7-1.5 3.7-3 1.2-1.7 1.6-3.3 1.6-3.4-.1-.1-3.4-1.3-3.4-4.9zm-3.1-9c.8-1 1.4-2.4 1.2-3.8-1.2.1-2.7.8-3.5 1.8-.8.9-1.5 2.3-1.3 3.7 1.4.1 2.8-.7 3.6-1.7z"/>
              </svg>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.4px', marginBottom: 1 }}>Download on the</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>App Store</div>
              </div>
              <span style={{
                position: 'absolute', top: -7, right: -4,
                fontSize: 8, fontWeight: 800, letterSpacing: '0.4px',
                background: '#f59e0b', color: '#fff', padding: '2px 7px', borderRadius: 6,
              }}>SOON</span>
            </div>

            {/* Google Play */}
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 14px', background: 'var(--bg-base)',
              border: '1px solid var(--border)', borderRadius: 10,
              position: 'relative', opacity: 0.65, userSelect: 'none',
            }}>
              <svg width="20" height="22" viewBox="0 0 20 22" fill="none" style={{ flexShrink: 0 }}>
                <path d="M1 1.1L11 11 1 20.9C.7 20.7.5 20.3.5 19.9V2.1C.5 1.7.7 1.3 1 1.1Z" fill="#32BBFF"/>
                <path d="M15.5 7.3.9 1.1C1.2.9 1.6.8 2 1L14.3 7.3H15.5Z" fill="#04D262"/>
                <path d="M19.5 9.8l-3-1.5H15L11 11l4 4 1.5-.8 3-1.5c.8-.5.8-2 0-2.9Z" fill="#FFD400"/>
                <path d="M1 20.9 11 11l4 4L2 20.9c-.4.2-.8.2-1 0Z" fill="#F93448"/>
              </svg>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.4px', marginBottom: 1 }}>Get it on</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>Google Play</div>
              </div>
              <span style={{
                position: 'absolute', top: -7, right: -4,
                fontSize: 8, fontWeight: 800, letterSpacing: '0.4px',
                background: '#f59e0b', color: '#fff', padding: '2px 7px', borderRadius: 6,
              }}>SOON</span>
            </div>
          </div>
        </div>

        {/* Terms of Service */}
        <div
          onClick={() => setTosAccepted(!tosAccepted)}
          style={{
            background: tosAccepted ? 'rgba(29,78,216,0.04)' : 'var(--bg-surface)',
            border: `1px solid ${tosAccepted ? 'rgba(29,78,216,0.3)' : 'var(--border)'}`,
            borderRadius: 12, padding: '16px 20px',
            display: 'flex', alignItems: 'flex-start', gap: 14,
            cursor: 'pointer', userSelect: 'none', transition: 'all 0.2s',
          }}
        >
          <div style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
            border: `2px solid ${tosAccepted ? '#1d4ed8' : 'var(--border)'}`,
            background: tosAccepted ? '#1d4ed8' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }}>
            {tosAccepted && <Check size={13} color="#fff" strokeWidth={3} />}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            I agree to the{' '}
            <span
              onClick={e => e.stopPropagation()}
              style={{ color: '#1d4ed8', textDecoration: 'underline', cursor: 'pointer' }}
            >
              Terms of Service
            </span>
            {' '}and{' '}
            <span
              onClick={e => e.stopPropagation()}
              style={{ color: '#1d4ed8', textDecoration: 'underline', cursor: 'pointer' }}
            >
              Privacy Policy
            </span>
            . I understand that my bank data is processed securely through Plaid and used solely for subscription intelligence.
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onContinue}
          disabled={!tosAccepted || !workEmail.trim()}
          style={{
            width: '100%', padding: '14px 20px', borderRadius: 10, border: 'none',
            background: tosAccepted && workEmail.trim() ? '#1d4ed8' : 'var(--bg-elevated)',
            color: tosAccepted && workEmail.trim() ? '#fff' : 'var(--text-muted)',
            fontSize: 15, fontWeight: 700, cursor: tosAccepted && workEmail.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.2s', letterSpacing: '0.2px',
          }}
        >
          <span>Continue to Bank Setup</span><ArrowRight size={16} />
        </button>

      </div>
    </div>
  );
}

// ── Step 3 — Connect Bank ──────────────────────────────────────────────────

function StepBank({
  plaidStatus, plaidError, onOpenPlaid, onSandbox, onComplete,
}: {
  plaidStatus: 'idle' | 'loading' | 'connected' | 'error';
  plaidError: string;
  onOpenPlaid: () => void;
  onSandbox: () => void;
  onComplete: () => void;
}) {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <p style={{ fontSize: 10, letterSpacing: '3px', color: '#1d4ed8', fontWeight: 700, marginBottom: 10 }}>STEP 3 OF 3</p>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px', fontFamily: 'var(--font-display)' }}>
          Connect your bank
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
          Securely link your bank to unlock AI-powered subscription detection and spend intelligence.
        </p>
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 28 }}>

        {plaidStatus !== 'connected' ? (
          <>
            {/* Trust indicators */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
              {['🔒 Bank-grade encryption', '✦ Read-only access', '⚡ Powered by Plaid'].map(t => (
                <div key={t} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px' }}>
                  {t}
                </div>
              ))}
            </div>

            {plaidError && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#ef4444', fontSize: 13 }}>
                ⚠ {plaidError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={onOpenPlaid}
                disabled={plaidStatus === 'loading'}
                style={{
                  padding: '14px 20px', background: '#1d4ed8', border: 'none', borderRadius: 10,
                  color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  letterSpacing: '0.2px', transition: 'opacity 0.15s',
                  opacity: plaidStatus === 'loading' ? 0.7 : 1,
                }}
              >
                {plaidStatus === 'loading'
                  ? <><Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Connecting…</>
                  : '🏦  Connect Real Bank'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '1px' }}>OR</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              <button
                onClick={onSandbox}
                disabled={plaidStatus === 'loading'}
                style={{
                  padding: '14px 20px', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 10, color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'opacity 0.15s', opacity: plaidStatus === 'loading' ? 0.7 : 1,
                }}
              >
                🧪  Use Sandbox (Fake Chase Bank)
              </button>
            </div>

            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.6 }}>
              Sandbox uses Plaid test credentials — no real bank account required. Perfect for evaluating the platform.
            </p>
          </>
        ) : (
          <>
            {/* Connected state */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Check size={24} color="#16a34a" strokeWidth={2.5} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Bank account connected</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Your financial data is ready for analysis</div>
              </div>
            </div>

            <button
              onClick={onComplete}
              style={{
                width: '100%', padding: '14px 20px', borderRadius: 10, border: 'none',
                background: '#16a34a', color: '#fff', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                letterSpacing: '0.2px',
              }}
            >
              <Check size={16} strokeWidth={2.5} />
              <span>Complete Setup</span>
            </button>
          </>
        )}
      </div>

      {/* Skip option */}
      {plaidStatus !== 'connected' && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={onComplete}
            style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: '4px 0' }}
          >
            Skip for now — I'll connect my bank later
          </button>
        </div>
      )}
    </div>
  );
}

// ── Completion screen ──────────────────────────────────────────────────────

function StepComplete({ workEmail, navigate }: { workEmail: string; navigate: (to: string) => void }) {
  return (
    <div style={{ textAlign: 'center' }}>
      {/* Animated checkmark ring */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(22,163,74,0.1)', border: '3px solid #16a34a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 0 8px rgba(22,163,74,0.08)',
          animation: 'pulse 1.5s ease-out forwards',
        }}>
          <Check size={36} color="#16a34a" strokeWidth={2.5} />
        </div>
      </div>

      <h2 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px', fontFamily: 'var(--font-display)' }}>
        You're all set!
      </h2>
      <p style={{ fontSize: 15, color: 'var(--text-muted)', margin: '0 0 32px', lineHeight: 1.6 }}>
        Your account is ready. Here's what was configured:
      </p>

      {/* Summary checklist */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', textAlign: 'left', marginBottom: 28 }}>
        {[
          { label: 'Subscription active', sub: '14-day free trial started' },
          { label: 'Email verified', sub: workEmail },
          { label: 'Terms of Service accepted', sub: 'Your data is protected under our privacy policy' },
          { label: 'Bank account connected', sub: 'Subscription intelligence is ready' },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '10px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <Check size={12} color="#16a34a" strokeWidth={3} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontFamily: item.sub.includes('@') ? 'var(--font-mono)' : undefined }}>{item.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate('/')}
        style={{
          width: '100%', padding: '15px 20px', borderRadius: 10, border: 'none',
          background: 'linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)',
          color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          letterSpacing: '0.2px', boxShadow: '0 4px 16px rgba(29,78,216,0.3)',
        }}
      >
        <span>Go to Dashboard</span>
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

// ── Main Wizard ────────────────────────────────────────────────────────────

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isLoading: authLoading, isAuthenticated, signIn } = useAuth();

  // Compute step early (not a hook — safe before any returns)
  const stepParam = parseInt(searchParams.get('step') || '1', 10);
  const step = [1, 2, 3].includes(stepParam) ? stepParam : 1;

  // ── All hooks must be declared before any conditional return ──────────────

  // Step 1 state
  const [period, setPeriod]                   = useState<BillingPeriod>('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // Step 2 state
  const [workEmail, setWorkEmail]     = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);

  // Step 3 state
  const [plaidStatus, setPlaidStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('idle');
  const [plaidError, setPlaidError]   = useState('');
  const [completed, setCompleted]     = useState(false);

  // Trigger Cognito login when unauthenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      sessionStorage.setItem('auth_redirect', window.location.pathname + window.location.search);
      signIn();
    }
  }, [authLoading, isAuthenticated, signIn]);

  // Pre-fill work email from auth user
  useEffect(() => {
    const email = user?.profile?.email ?? '';
    if (email && !workEmail) setWorkEmail(email);
  }, [user]);

  // Load Plaid script once
  useEffect(() => {
    if (!document.getElementById('plaid-link-script')) {
      const script = document.createElement('script');
      script.id = 'plaid-link-script';
      script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
      document.head.appendChild(script);
    }
  }, []);

  // Catalog products — only fetch once auth is confirmed so the token is available
  const { data: catalogData, isLoading: catalogLoading } = useQuery({
    queryKey: ['catalog-products'],
    queryFn: () => catalogApi.getProducts().then(r => r.data?.data?.products as CatalogProduct[]),
    staleTime: 120_000,
    enabled: step === 1 && isAuthenticated,
  });

  // ── Auth guard (after all hooks) ──────────────────────────────────────────
  if (authLoading || !isAuthenticated) return <AuthLoadingScreen />;

  const plans = (catalogData ?? []).filter(p => p.category === 'plan');
  const goToStep = (n: number) => setSearchParams({ step: String(n) }, { replace: true });

  // Stripe checkout
  const handleCheckout = async (productKey: string) => {
    setCheckoutLoading(productKey);
    try {
      const priceId    = `${productKey}::${period}`;
      const successUrl = `${window.location.origin}/onboarding?step=2`;
      const cancelUrl  = `${window.location.origin}/onboarding?step=1`;
      const res = await paymentsApi.createCheckoutSession(priceId, successUrl, cancelUrl);
      const url = res.data?.data?.checkoutUrl;
      if (url) window.location.href = url;
      else setCheckoutLoading(null);
    } catch {
      setCheckoutLoading(null);
    }
  };

  // Step 2 → 3
  const handleAccountContinue = () => {
    localStorage.setItem('tos_accepted', '1');
    localStorage.setItem('wizard_work_email', workEmail.trim());
    goToStep(3);
  };

  // Plaid Link
  const openPlaidLink = async () => {
    setPlaidStatus('loading');
    setPlaidError('');
    try {
      const res   = await api.post('/plaid/link-token');
      const token = res.data.data.link_token;
      const handler = window.Plaid.create({
        token,
        onSuccess: async (publicToken: string) => {
          try {
            await api.post('/plaid/exchange-token', { public_token: publicToken });
            setPlaidStatus('connected');
          } catch {
            setPlaidError('Failed to connect bank account. Please try again.');
            setPlaidStatus('error');
          }
        },
        onExit: () => { if (plaidStatus === 'loading') setPlaidStatus('idle'); },
      });
      handler.open();
    } catch (err: any) {
      setPlaidError(err.response?.data?.error || 'Failed to initialize bank connection.');
      setPlaidStatus('error');
    }
  };

  const connectSandbox = async () => {
    setPlaidStatus('loading');
    setPlaidError('');
    try {
      await api.post('/plaid/sandbox/connect');
      setPlaidStatus('connected');
    } catch (err: any) {
      setPlaidError(err.response?.data?.error || 'Sandbox connect failed.');
      setPlaidStatus('error');
    }
  };

  const userEmail = user?.profile?.email ?? '';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '44px 20px 80px',
      fontFamily: 'var(--font-display)',
    }}>

      {/* Brand mark */}
      <div style={{ marginBottom: 44, textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
          ValuePilot
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, letterSpacing: '0.5px' }}>
          Get started in minutes
        </div>
      </div>

      {/* Step bar — always fixed width */}
      <div style={{ width: '100%', maxWidth: 520, marginBottom: 36 }}>
        <StepBar current={completed ? 3 : step} />
      </div>

      {/* Step content — wider on step 1 for plan cards */}
      <div style={{ width: '100%', maxWidth: completed ? 480 : step === 1 ? 960 : 520 }}>

        {step === 1 && (
          <StepPlan
            plans={plans}
            catalogLoading={catalogLoading}
            period={period}
            setPeriod={setPeriod}
            onCheckout={handleCheckout}
            checkoutLoading={checkoutLoading}
          />
        )}

        {step === 2 && (
          <StepAccount
            userEmail={userEmail}
            workEmail={workEmail}
            setWorkEmail={setWorkEmail}
            tosAccepted={tosAccepted}
            setTosAccepted={setTosAccepted}
            onContinue={handleAccountContinue}
          />
        )}

        {step === 3 && !completed && (
          <StepBank
            plaidStatus={plaidStatus}
            plaidError={plaidError}
            onOpenPlaid={openPlaidLink}
            onSandbox={connectSandbox}
            onComplete={() => setCompleted(true)}
          />
        )}

        {step === 3 && completed && (
          <StepComplete workEmail={workEmail || userEmail} navigate={navigate} />
        )}

      </div>

      {/* Back link — subtle, only on step 2+ */}
      {step > 1 && !completed && (
        <button
          onClick={() => goToStep(step - 1)}
          style={{
            marginTop: 20, fontSize: 12, color: 'var(--text-muted)',
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          ← Back to {STEPS[step - 2]}
        </button>
      )}

      <style>{`
        @keyframes spin    { from { transform: rotate(0deg) }   to { transform: rotate(360deg) } }
        @keyframes shimmer { 0%   { opacity: 1 }                50% { opacity: 0.6 }              100% { opacity: 1 } }
        @keyframes pulse   { 0%   { box-shadow: 0 0 0 0 rgba(22,163,74,0.3) }  70% { box-shadow: 0 0 0 16px rgba(22,163,74,0) } 100% { box-shadow: 0 0 0 0 rgba(22,163,74,0) } }
      `}</style>
    </div>
  );
}
