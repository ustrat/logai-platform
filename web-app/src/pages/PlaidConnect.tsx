import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  name: string;
  merchant_name: string;
  category: string;
  sub_category: string;
  payment_channel: string;
  pending: boolean;
  currency: string;
}

interface PlaidAccount {
  account_id: string;
  name: string;
  type: string;
  subtype: string;
  balances: { current: number; available: number; iso_currency_code: string };
}

declare global {
  interface Window { Plaid: any; }
}

export default function PlaidConnect() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('idle');
  const [transactions, setTransactions] = useState<PlaidTransaction[]>([]);
  const [accounts, setAccounts] = useState<PlaidAccount[]>([]);
  const [error, setError] = useState('');
  const [linkToken, setLinkToken] = useState('');
  const [isSandbox, setIsSandbox] = useState(false);

  // Check if already connected on mount
  useEffect(() => {
  const token = localStorage.getItem('token');
  if (!token) return;
  api.get('/plaid/status').then(res => {
    if (res.data.data.connected) {
      setStatus('connected');
      loadTransactions();
    }
  }).catch(() => {});
}, []);

  // Load Plaid Link script
  useEffect(() => {
    if (!document.getElementById('plaid-link-script')) {
      const script = document.createElement('script');
      script.id = 'plaid-link-script';
      script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
      document.head.appendChild(script);
    }
  }, []);

  const getLinkToken = async () => {
    setStatus('loading');
    setError('');
    try {
      const res = await api.post('/plaid/link-token');
      setLinkToken(res.data.data.link_token);
      return res.data.data.link_token;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to get link token');
      setStatus('error');
      return null;
    }
  };

  const openPlaidLink = async () => {
    const token = await getLinkToken();
    if (!token) return;

    const handler = window.Plaid.create({
      token,
      onSuccess: async (publicToken: string) => {
        try {
          await api.post('/plaid/exchange-token', { public_token: publicToken });
          setStatus('connected');
          loadTransactions();
        } catch (err: any) {
          setError('Failed to connect bank account');
          setStatus('error');
        }
      },
      onExit: () => setStatus('idle'),
    });

    handler.open();
  };

  const connectSandbox = async () => {
    setStatus('loading');
    setError('');
    try {
      await api.post('/plaid/sandbox/connect');
      setIsSandbox(true);
      setStatus('connected');
      loadTransactions();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Sandbox connect failed');
      setStatus('error');
    }
  };

  const loadTransactions = async () => {
    try {
      const res = await api.get('/plaid/transactions?count=100');
      setTransactions(res.data.data.transactions);
      setAccounts(res.data.data.accounts || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load transactions');
    }
  };

  const disconnect = async () => {
    await api.delete('/plaid/disconnect');
    setStatus('idle');
    setTransactions([]);
    setAccounts([]);
    setIsSandbox(false);
  };

  const CATEGORY_COLORS: Record<string, string> = {
    FOOD_AND_DRINK: '#f59e0b',
    TRANSPORTATION: '#3b82f6',
    SHOPPING: '#8b5cf6',
    ENTERTAINMENT: '#ec4899',
    TRANSFER: '#10b981',
    OTHER: '#6b7280',
  };

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: '10px', letterSpacing: '3px', color: 'var(--amber)', marginBottom: 4 }}>BANK INTEGRATION</p>
        <h1 style={{ fontSize: '24px', fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontWeight: 700 }}>
          Plaid Transactions
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4 }}>
          Connect a bank account to pull live transaction data
        </p>
      </div>

      {/* Connection Panel */}
      {status !== 'connected' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 28, marginBottom: 24, maxWidth: 500 }}>
          <p style={{ fontSize: '10px', letterSpacing: '2px', color: 'var(--text-muted)', marginBottom: 16 }}>CONNECT BANK ACCOUNT</p>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', padding: 10, marginBottom: 16, color: 'var(--red)', fontSize: '12px' }}>
              ⚠ {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={openPlaidLink}
              disabled={status === 'loading'}
              style={{ padding: '12px 20px', background: 'var(--amber)', border: 'none', borderRadius: 'var(--radius)', color: '#000', fontWeight: 700, fontSize: '12px', letterSpacing: '1px', cursor: 'pointer' }}
            >
              {status === 'loading' ? 'CONNECTING...' : '🏦 CONNECT REAL BANK'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            <button
              onClick={connectSandbox}
              disabled={status === 'loading'}
              style={{ padding: '12px 20px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', fontSize: '12px', letterSpacing: '1px', cursor: 'pointer' }}
            >
              🧪 USE SANDBOX (FAKE CHASE BANK)
            </button>
          </div>

          <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 16 }}>
            Sandbox mode uses Plaid test data — no real bank credentials required.
          </p>
        </div>
      )}

      {/* Connected State */}
      {status === 'connected' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} />
              <span style={{ fontSize: '12px', color: 'var(--green)', letterSpacing: '1px' }}>
                {isSandbox ? 'SANDBOX CONNECTED — Chase Test Bank' : 'BANK CONNECTED'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={loadTransactions} style={{ padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 'var(--radius)', fontSize: '11px', cursor: 'pointer' }}>
                ↺ REFRESH
              </button>
              <button onClick={disconnect} style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 'var(--radius)', fontSize: '11px', cursor: 'pointer' }}>
                DISCONNECT
              </button>
            </div>
          </div>

          {/* Accounts */}
          {accounts.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
              {accounts.map((acc: any) => (
                <div key={acc.account_id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px' }}>
                  <p style={{ fontSize: '10px', letterSpacing: '2px', color: 'var(--text-muted)', marginBottom: 6 }}>{acc.subtype?.toUpperCase()}</p>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{acc.name}</p>
                  <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--amber)', fontFamily: 'monospace' }}>
                    ${(acc.balances?.current || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  {acc.balances?.available != null && (
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
                      Available: ${(acc.balances.available).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Transactions Table */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', letterSpacing: '3px', color: 'var(--text-muted)' }}>TRANSACTIONS</span>
              <span style={{ fontSize: '11px', color: 'var(--amber)' }}>{transactions.length} records</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['DATE', 'MERCHANT', 'CATEGORY', 'CHANNEL', 'AMOUNT'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '9px', letterSpacing: '2px', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 50).map((txn, i) => (
                    <tr key={txn.transaction_id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{txn.date}</td>
                      <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-primary)' }}>{txn.merchant_name || txn.name}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 3, fontSize: '9px', fontWeight: 700, letterSpacing: '0.5px',
                          background: (CATEGORY_COLORS[txn.category] || '#6b7280') + '22',
                          color: CATEGORY_COLORS[txn.category] || '#6b7280',
                        }}>{txn.category?.replace(/_/g, ' ')}</span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: '11px', color: 'var(--text-muted)' }}>{txn.payment_channel}</td>
                      <td style={{ padding: '10px 16px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: txn.amount > 0 ? 'var(--red)' : 'var(--green)', textAlign: 'right' }}>
                        {txn.amount > 0 ? '-' : '+'}${Math.abs(txn.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {transactions.length > 50 && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                Showing 50 of {transactions.length} transactions
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
