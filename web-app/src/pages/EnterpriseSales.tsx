import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, ChevronRight, ChevronLeft, CheckCircle2, XCircle, Clock, FileText,
  DollarSign, Users, Building2, Send, Eye, Check, X, Loader2,
  ArrowRight, AlertTriangle, Trash2, Shield, Globe, CreditCard,
  MoreHorizontal, RefreshCw,
} from 'lucide-react';
import { enterpriseApi } from '../services/enterpriseApi';

// ── Types ─────────────────────────────────────────────────────────────────────
type OrderStatus = 'draft' | 'submitted' | 'pending_finance' | 'approved' | 'rejected' | 'invoiced' | 'paid';
type OrgType = 'federal' | 'commercial';

interface Customer {
  id: string; name: string; orgType: OrgType; domain: string;
  billingEmail: string; billingContact: string; phone?: string;
  address?: string; city?: string; state?: string; country: string;
  contractNumber?: string; agencyName?: string; industry?: string;
}

interface LineItem {
  product: string; description: string; seats: number;
  unitPrice: number; term: number; discount: number; total: number;
}

interface ApprovalEntry {
  stage: string; actorEmail: string; action: string; comment: string; timestamp: string;
}

interface Order {
  id: string; orderNumber: string; customerId: string; customerName: string;
  lineItems: LineItem[]; subtotal: number; totalDiscount: number; grandTotal: number;
  currency: string; paymentTerms: string; status: OrderStatus;
  salesPersonEmail: string; salesPersonName: string;
  notes: string; internalNotes: string; approvalHistory: ApprovalEntry[];
  invoiceId?: string; createdAt: string; submittedAt?: string; approvedAt?: string;
}

interface Invoice {
  id: string; invoiceNumber: string; status: string;
  sentTo: string; grandTotal: number; dueDate: string; paidAt?: string;
}

interface Stats {
  counts: Record<string, number>;
  revenue: { draft: number; pending: number; approved: number; invoiced: number; paid: number };
  totalCustomers: number;
  totalOrders: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number, currency = 'usd') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(n);

const STATUS_CFG: Record<OrderStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  draft:           { label: 'Draft',            color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: <FileText size={11} /> },
  submitted:       { label: 'Pending Sales',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  icon: <Clock size={11} /> },
  pending_finance: { label: 'Pending Finance',  color: '#f97316', bg: 'rgba(249,115,22,0.1)',  icon: <Clock size={11} /> },
  approved:        { label: 'Approved',         color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   icon: <CheckCircle2 size={11} /> },
  rejected:        { label: 'Rejected',         color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   icon: <XCircle size={11} /> },
  invoiced:        { label: 'Invoiced',         color: '#0891b2', bg: 'rgba(8,145,178,0.1)',   icon: <Send size={11} /> },
  paid:            { label: 'Paid',             color: '#22c55e', bg: 'rgba(34,197,94,0.15)',  icon: <CheckCircle2 size={11} /> },
};

function StatusPill({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.draft;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color, fontWeight: 700, letterSpacing: '0.3px' }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Pipeline stages ───────────────────────────────────────────────────────────
const PIPELINE: { status: OrderStatus; label: string }[] = [
  { status: 'draft',           label: 'Draft' },
  { status: 'submitted',       label: 'Sales Review' },
  { status: 'pending_finance', label: 'Finance Review' },
  { status: 'approved',        label: 'Approved' },
  { status: 'invoiced',        label: 'Invoiced' },
  { status: 'paid',            label: 'Paid' },
];

// ── New Customer Modal ────────────────────────────────────────────────────────
function CustomerModal({ onClose, onSaved }: { onClose: () => void; onSaved: (c: Customer) => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '', orgType: 'commercial' as OrgType, domain: '', billingEmail: '',
    billingContact: '', phone: '', address: '', city: '', state: '', country: 'US',
    contractNumber: '', agencyName: '', dunsNumber: '', industry: '', website: '',
  });

  const mutation = useMutation({
    mutationFn: () => enterpriseApi.createCustomer(form),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['entCustomers'] });
      onSaved(r.data.data.customer);
    },
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const isFed = form.orgType === 'federal';

  return (
    <Modal title="NEW CUSTOMER" onClose={onClose} width={540}>
      {/* Progress */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {['Account', 'Billing', 'Details'].map((s, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: step >= i ? '#f59e0b' : 'rgba(255,255,255,0.08)' }} />
        ))}
      </div>

      {step === 0 && (
        <div>
          <SelectF label="ACCOUNT TYPE" value={form.orgType} onChange={v => set('orgType', v)} options={[['commercial','Commercial Enterprise'],['federal','Federal Government']]} />
          <MF label="ORGANISATION NAME *" value={form.name} onChange={v => set('name', v)} placeholder="Acme Federal Agency" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MF label="PRIMARY DOMAIN" value={form.domain} onChange={v => set('domain', v)} placeholder="acme.gov" />
            <MF label="PHONE" value={form.phone} onChange={v => set('phone', v)} placeholder="+1 202 555 0100" />
          </div>
          {isFed && <>
            <MF label="AGENCY NAME" value={form.agencyName} onChange={v => set('agencyName', v)} placeholder="Department of Homeland Security" />
            <MF label="CONTRACT / ORDER NUMBER" value={form.contractNumber} onChange={v => set('contractNumber', v)} placeholder="GS-10F-0123X" />
            <MF label="DUNS / UEI" value={form.dunsNumber} onChange={v => set('dunsNumber', v)} placeholder="079555555" />
          </>}
          {!isFed && <>
            <MF label="INDUSTRY" value={form.industry} onChange={v => set('industry', v)} placeholder="Healthcare, Finance…" />
            <MF label="WEBSITE" value={form.website} onChange={v => set('website', v)} placeholder="https://acme.com" />
          </>}
        </div>
      )}

      {step === 1 && (
        <div>
          <MF label="BILLING EMAIL *" value={form.billingEmail} onChange={v => set('billingEmail', v)} placeholder="ap@acme.gov" />
          <MF label="BILLING CONTACT NAME *" value={form.billingContact} onChange={v => set('billingContact', v)} placeholder="Jane Smith" />
          <MF label="ADDRESS" value={form.address} onChange={v => set('address', v)} placeholder="1234 Main St, Suite 500" />
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
            <MF label="CITY" value={form.city} onChange={v => set('city', v)} placeholder="Washington" />
            <MF label="STATE" value={form.state} onChange={v => set('state', v)} placeholder="DC" />
            <MF label="COUNTRY" value={form.country} onChange={v => set('country', v)} placeholder="US" />
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ padding: '8px 0' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 6, padding: 16 }}>
            <Row2 label="Organisation" value={form.name} />
            <Row2 label="Type" value={isFed ? 'Federal Government' : 'Commercial Enterprise'} />
            <Row2 label="Domain" value={form.domain} />
            <Row2 label="Billing Email" value={form.billingEmail} />
            <Row2 label="Billing Contact" value={form.billingContact} />
            {isFed && form.contractNumber && <Row2 label="Contract" value={form.contractNumber} />}
          </div>
        </div>
      )}

      <ModalFooter
        step={step} total={3}
        onBack={() => setStep(s => s - 1)}
        onNext={() => step < 2 ? setStep(s => s + 1) : mutation.mutate()}
        nextLabel={step === 2 ? (mutation.isPending ? 'SAVING...' : 'CREATE CUSTOMER') : 'NEXT'}
        disabled={step === 0 ? !form.name : step === 1 ? !form.billingEmail || !form.billingContact : false}
        onClose={onClose}
      />
    </Modal>
  );
}

// ── New Order Wizard ──────────────────────────────────────────────────────────
const VP_PRODUCTS = ['RenewalGuard', 'RefundPilot'];
const PAYMENT_TERMS = ['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90', 'Due on Receipt'];

function OrderWizard({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [lineItems, setLineItems] = useState<Omit<LineItem, 'total'>[]>([
    { product: 'RenewalGuard', description: 'Enterprise license — unlimited renewals', seats: 100, unitPrice: 299, term: 1, discount: 0 },
  ]);
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [submitAfter, setSubmitAfter] = useState(false);

  const customersQ = useQuery({
    queryKey: ['entCustomers'],
    queryFn: () => enterpriseApi.getCustomers().then(r => r.data.data.customers as Customer[]),
  });

  const createOrderMutation = useMutation({
    mutationFn: () => enterpriseApi.createOrder({
      customerId: selectedCustomer!.id, lineItems, paymentTerms, notes, internalNotes,
    }),
    onSuccess: async (r) => {
      if (submitAfter) {
        await enterpriseApi.submitOrder(r.data.data.order.id);
      }
      qc.invalidateQueries({ queryKey: ['entOrders'] });
      qc.invalidateQueries({ queryKey: ['entStats'] });
      onClose();
    },
  });

  const addLine = () => setLineItems(l => [...l, { product: 'RenewalGuard', description: '', seats: 100, unitPrice: 299, term: 1, discount: 0 }]);
  const removeLine = (i: number) => setLineItems(l => l.filter((_, idx) => idx !== i));
  const setLine = (i: number, k: string, v: string | number) => setLineItems(l => l.map((item, idx) => idx === i ? { ...item, [k]: v } : item));

  const totals = lineItems.reduce((acc, item) => {
    const base = item.seats * item.unitPrice * item.term;
    const disc = base * (item.discount / 100);
    return { subtotal: acc.subtotal + base, discount: acc.discount + disc, grand: acc.grand + base - disc };
  }, { subtotal: 0, discount: 0, grand: 0 });

  const steps = ['Customer', 'Products', 'Terms', 'Review'];

  return (
    <>
      {showNewCustomer && (
        <CustomerModal
          onClose={() => setShowNewCustomer(false)}
          onSaved={(c) => { setSelectedCustomer(c); setShowNewCustomer(false); }}
        />
      )}
      <Modal title="NEW ENTERPRISE ORDER" onClose={onClose} width={680}>
        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: step > i ? '#22c55e' : step === i ? '#f59e0b' : 'rgba(255,255,255,0.06)', color: step >= i ? '#000' : 'var(--text-muted)', border: step === i ? '2px solid #f59e0b' : '2px solid transparent' }}>
                  {step > i ? <Check size={12} /> : i + 1}
                </div>
                <span style={{ fontSize: 9, letterSpacing: '1px', color: step === i ? '#f59e0b' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{s.toUpperCase()}</span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 1, background: step > i ? '#22c55e' : 'rgba(255,255,255,0.08)', margin: '0 8px', marginBottom: 20 }} />
              )}
            </div>
          ))}
        </div>

        {/* Step 0 — Customer */}
        {step === 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 10, letterSpacing: '1.5px', color: 'var(--text-muted)' }}>SELECT CUSTOMER</span>
              <button onClick={() => setShowNewCustomer(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, color: '#f59e0b', cursor: 'pointer', fontSize: 11 }}>
                <Plus size={11} /> New Customer
              </button>
            </div>
            {customersQ.isLoading ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} /></div>
            ) : customersQ.data?.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                <Building2 size={28} style={{ display: 'block', margin: '0 auto 10px' }} />
                <div style={{ marginBottom: 12, fontSize: 12 }}>No customers yet.</div>
                <button onClick={() => setShowNewCustomer(true)} style={{ padding: '8px 18px', background: '#f59e0b', border: 'none', borderRadius: 4, color: '#000', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                  Create First Customer
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
                {customersQ.data?.map(c => (
                  <div key={c.id} onClick={() => setSelectedCustomer(c)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 6, border: `1px solid ${selectedCustomer?.id === c.id ? '#f59e0b' : 'var(--border)'}`, background: selectedCustomer?.id === c.id ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 6, background: c.orgType === 'federal' ? 'rgba(124,58,237,0.12)' : 'rgba(8,145,178,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {c.orgType === 'federal' ? <Shield size={14} color="#7c3aed" /> : <Globe size={14} color="#0891b2" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.billingEmail} · {c.country}</div>
                    </div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: c.orgType === 'federal' ? 'rgba(124,58,237,0.1)' : 'rgba(8,145,178,0.1)', color: c.orgType === 'federal' ? '#7c3aed' : '#0891b2' }}>
                      {c.orgType === 'federal' ? 'FEDERAL' : 'COMMERCIAL'}
                    </span>
                    {selectedCustomer?.id === c.id && <Check size={14} color="#f59e0b" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 1 — Products */}
        {step === 1 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 10, letterSpacing: '1.5px', color: 'var(--text-muted)' }}>LINE ITEMS</span>
              <button onClick={addLine} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}>
                <Plus size={11} /> Add Line
              </button>
            </div>

            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 72px 80px 56px 64px 30px', gap: 6, marginBottom: 6 }}>
              {['PRODUCT', 'DESCRIPTION', 'SEATS', '$/SEAT/YR', 'TERM', 'DISC%', ''].map(h => (
                <div key={h} style={{ fontSize: 9, letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 700 }}>{h}</div>
              ))}
            </div>

            {lineItems.map((item, i) => {
              const base = item.seats * item.unitPrice * item.term;
              const disc = base * (item.discount / 100);
              const total = base - disc;
              return (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 72px 80px 56px 64px 30px', gap: 6, alignItems: 'center' }}>
                    <select value={item.product} onChange={e => setLine(i, 'product', e.target.value)}
                      style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 4, color: '#fff', fontSize: 11 }}>
                      {VP_PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <input value={item.description} onChange={e => setLine(i, 'description', e.target.value)}
                      placeholder="Description" style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 4, color: '#fff', fontSize: 11 }} />
                    <input type="number" min={1} value={item.seats} onChange={e => setLine(i, 'seats', parseInt(e.target.value) || 0)}
                      style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 4, color: '#fff', fontSize: 11, textAlign: 'right' }} />
                    <input type="number" min={0} step={1} value={item.unitPrice} onChange={e => setLine(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                      style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 4, color: '#fff', fontSize: 11, textAlign: 'right' }} />
                    <select value={item.term} onChange={e => setLine(i, 'term', parseInt(e.target.value))}
                      style={{ padding: '6px 4px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 4, color: '#fff', fontSize: 11 }}>
                      {[1,2,3,5].map(t => <option key={t} value={t}>{t}yr</option>)}
                    </select>
                    <input type="number" min={0} max={100} value={item.discount} onChange={e => setLine(i, 'discount', parseFloat(e.target.value) || 0)}
                      style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 4, color: item.discount > 0 ? '#22c55e' : '#fff', fontSize: 11, textAlign: 'right' }} />
                    {lineItems.length > 1 && (
                      <button onClick={() => removeLine(i)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#f59e0b', marginTop: 3, paddingRight: 34 }}>
                    {fmt(total)} {item.discount > 0 && <span style={{ color: '#22c55e' }}>({item.discount}% off)</span>}
                  </div>
                </div>
              );
            })}

            {/* Totals summary */}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: 240 }}>
                {totals.discount > 0 && <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>Subtotal</span><span>{fmt(totals.subtotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#22c55e', marginBottom: 4 }}>
                    <span>Discount</span><span>− {fmt(totals.discount)}</span>
                  </div>
                </>}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: '#fff', borderTop: totals.discount > 0 ? '1px solid var(--border)' : 'none', paddingTop: totals.discount > 0 ? 8 : 0 }}>
                  <span>TOTAL</span><span style={{ color: '#f59e0b' }}>{fmt(totals.grand)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Terms */}
        {step === 2 && (
          <div>
            <SelectF label="PAYMENT TERMS" value={paymentTerms} onChange={setPaymentTerms} options={PAYMENT_TERMS.map(t => [t, t])} />
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 6 }}>NOTES (VISIBLE ON INVOICE)</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Special terms, support SLA, compliance requirements…"
                style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 4, color: '#fff', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 9, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 6 }}>INTERNAL NOTES (NOT ON INVOICE)</div>
              <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={2} placeholder="Deal context, approval notes, sales strategy…"
                style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 4, color: '#fff', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, cursor: 'pointer' }}>
              <input type="checkbox" checked={submitAfter} onChange={e => setSubmitAfter(e.target.checked)} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Submit for approval immediately after creating</span>
            </label>
          </div>
        )}

        {/* Step 3 — Review */}
        {step === 3 && selectedCustomer && (
          <div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                {selectedCustomer.orgType === 'federal' ? <Shield size={14} color="#7c3aed" /> : <Globe size={14} color="#0891b2" />}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{selectedCustomer.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selectedCustomer.billingEmail}</div>
                </div>
              </div>
              <div style={{ padding: '12px 16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ fontSize: 9, letterSpacing: '1px', color: 'var(--text-muted)' }}>
                      <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 600 }}>PRODUCT</th>
                      <th style={{ textAlign: 'center', paddingBottom: 8, fontWeight: 600 }}>SEATS</th>
                      <th style={{ textAlign: 'center', paddingBottom: 8, fontWeight: 600 }}>TERM</th>
                      <th style={{ textAlign: 'right', paddingBottom: 8, fontWeight: 600 }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, i) => {
                      const base = item.seats * item.unitPrice * item.term;
                      const total = base - base * (item.discount / 100);
                      return (
                        <tr key={i}>
                          <td style={{ padding: '5px 0', fontSize: 12, color: '#fff' }}>{item.product}</td>
                          <td style={{ padding: '5px 0', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>{item.seats.toLocaleString()}</td>
                          <td style={{ padding: '5px 0', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>{item.term}yr</td>
                          <td style={{ padding: '5px 0', fontSize: 12, color: '#fff', textAlign: 'right', fontWeight: 600 }}>{fmt(total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{paymentTerms}</span>
                  <div style={{ textAlign: 'right' }}>
                    {totals.discount > 0 && <div style={{ fontSize: 11, color: '#22c55e', marginBottom: 2 }}>Saving {fmt(totals.discount)}</div>}
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>{fmt(totals.grand)}</div>
                  </div>
                </div>
              </div>
            </div>
            {submitAfter && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 4, fontSize: 11, color: '#f59e0b' }}>
                <Send size={11} /> Order will be submitted for approval immediately after creation
              </div>
            )}
          </div>
        )}

        <ModalFooter
          step={step} total={4}
          onBack={() => setStep(s => s - 1)}
          onNext={() => step < 3 ? setStep(s => s + 1) : createOrderMutation.mutate()}
          nextLabel={step === 3 ? (createOrderMutation.isPending ? 'CREATING...' : (submitAfter ? 'CREATE & SUBMIT' : 'CREATE ORDER')) : 'NEXT'}
          disabled={step === 0 ? !selectedCustomer : step === 1 ? lineItems.length === 0 : false}
          onClose={onClose}
        />
      </Modal>
    </>
  );
}

// ── Approve / Reject Modal ────────────────────────────────────────────────────
function ApprovalModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);

  const approveMutation = useMutation({
    mutationFn: () => enterpriseApi.approveOrder(order.id, comment),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entOrders'] }); qc.invalidateQueries({ queryKey: ['entStats'] }); onClose(); },
  });
  const rejectMutation = useMutation({
    mutationFn: () => enterpriseApi.rejectOrder(order.id, comment),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entOrders'] }); qc.invalidateQueries({ queryKey: ['entStats'] }); onClose(); },
  });

  const stageLabel = order.status === 'submitted' ? 'Sales Manager Review' : 'Finance Review';
  const nextLabel  = order.status === 'submitted' ? 'Pending Finance' : 'Approved';

  return (
    <Modal title="APPROVAL REVIEW" onClose={onClose} width={480}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>ORDER</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{order.orderNumber} — {order.customerName}</div>
        <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700, marginTop: 4 }}>{fmt(order.grandTotal)}</div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 11, color: 'var(--text-muted)' }}>
        Stage: <strong style={{ color: '#fff' }}>{stageLabel}</strong> · Approving moves this to <strong style={{ color: '#22c55e' }}>{nextLabel}</strong>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 9, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 8 }}>YOUR DECISION</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button onClick={() => setAction('approve')} style={{ padding: '10px', borderRadius: 4, border: `2px solid ${action === 'approve' ? '#22c55e' : 'var(--border)'}`, background: action === 'approve' ? 'rgba(34,197,94,0.08)' : 'transparent', color: action === 'approve' ? '#22c55e' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700, fontSize: 12 }}>
            <CheckCircle2 size={14} /> APPROVE
          </button>
          <button onClick={() => setAction('reject')} style={{ padding: '10px', borderRadius: 4, border: `2px solid ${action === 'reject' ? '#ef4444' : 'var(--border)'}`, background: action === 'reject' ? 'rgba(239,68,68,0.08)' : 'transparent', color: action === 'reject' ? '#ef4444' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700, fontSize: 12 }}>
            <XCircle size={14} /> REJECT
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 9, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 6 }}>COMMENT {action === 'reject' ? '(REQUIRED)' : '(OPTIONAL)'}</div>
        <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Enter your reasoning, conditions, or notes…"
          style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 4, color: '#fff', fontSize: 12, resize: 'none', boxSizing: 'border-box' }} />
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
        <button
          disabled={!action || (action === 'reject' && !comment) || approveMutation.isPending || rejectMutation.isPending}
          onClick={() => action === 'approve' ? approveMutation.mutate() : rejectMutation.mutate()}
          style={{ padding: '8px 20px', borderRadius: 4, border: 'none', background: !action ? '#374151' : action === 'approve' ? '#22c55e' : '#ef4444', color: '#fff', cursor: !action ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, opacity: !action ? 0.5 : 1 }}>
          {(approveMutation.isPending || rejectMutation.isPending) ? 'PROCESSING...' : action === 'approve' ? 'APPROVE ORDER' : action === 'reject' ? 'REJECT ORDER' : 'SELECT DECISION'}
        </button>
      </div>
    </Modal>
  );
}

// ── Invoice Modal ─────────────────────────────────────────────────────────────
function InvoiceModal({ order, customer, onClose }: { order: Order; customer?: Customer; onClose: () => void }) {
  const qc = useQueryClient();
  const [sentTo, setSentTo] = useState(customer?.billingEmail || '');
  const [dueDate, setDueDate] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const mutation = useMutation({
    mutationFn: () => enterpriseApi.createInvoice(order.id, { sentTo, dueDate: dueDate || undefined }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['entOrders'] });
      qc.invalidateQueries({ queryKey: ['entStats'] });
      if (r.data.data.preview) setPreview(r.data.data.preview);
      if (r.data.data.emailSent) setEmailSent(true);
    },
  });

  if (preview) {
    return (
      <Modal title="INVOICE PREVIEW" onClose={onClose} width={900}>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {emailSent
            ? <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#22c55e', fontSize: 12 }}><CheckCircle2 size={14} /> Invoice sent to {sentTo}</div>
            : <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b', fontSize: 12 }}><AlertTriangle size={14} /> No SMTP configured — invoice not emailed. Add SMTP_HOST to .env to enable.</div>}
          <button onClick={onClose} style={{ padding: '7px 16px', background: '#f59e0b', border: 'none', borderRadius: 4, color: '#000', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>DONE</button>
        </div>
        <iframe
          srcDoc={preview}
          style={{ width: '100%', height: 600, border: '1px solid var(--border)', borderRadius: 6, background: '#fff' }}
          title="Invoice Preview"
        />
      </Modal>
    );
  }

  return (
    <Modal title="GENERATE INVOICE" onClose={onClose} width={460}>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 6, padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{order.orderNumber} — {order.customerName}</div>
        {order.lineItems.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 3 }}>
            <span>{item.product} × {item.seats.toLocaleString()} seats ({item.term}yr)</span>
            <span style={{ color: '#fff' }}>{fmt(item.total)}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#f59e0b' }}>
          <span>TOTAL</span><span>{fmt(order.grandTotal)}</span>
        </div>
      </div>

      <MF label="SEND INVOICE TO *" value={sentTo} onChange={setSentTo} placeholder="billing@customer.com" />
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 9, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 6 }}>DUE DATE (leave blank for {order.paymentTerms})</div>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 4, color: '#fff', fontSize: 12, width: '100%', boxSizing: 'border-box' }} />
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
        <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
        <button onClick={() => mutation.mutate()} disabled={!sentTo || mutation.isPending}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 4, border: 'none', background: sentTo ? '#f59e0b' : '#374151', color: sentTo ? '#000' : '#fff', cursor: sentTo ? 'pointer' : 'default', fontSize: 12, fontWeight: 700 }}>
          <Send size={13} /> {mutation.isPending ? 'GENERATING...' : 'GENERATE & SEND'}
        </button>
      </div>
    </Modal>
  );
}

// ── Order Detail Panel ────────────────────────────────────────────────────────
function OrderPanel({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [showApprove, setShowApprove]   = useState(false);
  const [showInvoice, setShowInvoice]   = useState(false);

  const detailQ = useQuery({
    queryKey: ['entOrder', orderId],
    queryFn: () => enterpriseApi.getOrder(orderId).then(r => r.data.data as { order: Order; customer: Customer; invoice: Invoice | null }),
  });

  const submitMutation = useMutation({
    mutationFn: () => enterpriseApi.submitOrder(orderId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entOrders'] }); qc.invalidateQueries({ queryKey: ['entOrder', orderId] }); qc.invalidateQueries({ queryKey: ['entStats'] }); },
  });

  const markPaidMutation = useMutation({
    mutationFn: () => enterpriseApi.markPaid(detailQ.data!.invoice!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entOrders'] }); qc.invalidateQueries({ queryKey: ['entOrder', orderId] }); qc.invalidateQueries({ queryKey: ['entStats'] }); },
  });

  if (detailQ.isLoading) {
    return (
      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 480, background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} color="var(--text-muted)" />
      </div>
    );
  }

  const { order, customer, invoice } = detailQ.data!;
  const canSubmit = order.status === 'draft';
  const canApprove = ['submitted', 'pending_finance'].includes(order.status);
  const canInvoice = order.status === 'approved';
  const canMarkPaid = order.status === 'invoiced' && invoice;

  return (
    <>
      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 480, background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', zIndex: 200, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{order.orderNumber}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{order.salesPersonEmail}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusPill status={order.status} />
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', flex: 1 }}>
          {/* Customer */}
          <SectionTitle>CUSTOMER</SectionTitle>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 6, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{customer?.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{customer?.billingEmail}</div>
            {customer?.contractNumber && <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 4 }}>Contract: {customer.contractNumber}</div>}
          </div>

          {/* Line items */}
          <SectionTitle>LINE ITEMS</SectionTitle>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
            {order.lineItems.map((item, i) => (
              <div key={i} style={{ padding: '10px 14px', borderBottom: i < order.lineItems.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{item.product}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>{fmt(item.total)}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {item.seats.toLocaleString()} seats × ${item.unitPrice}/yr × {item.term}yr
                  {item.discount > 0 && <span style={{ color: '#22c55e', marginLeft: 6 }}>({item.discount}% disc)</span>}
                </div>
              </div>
            ))}
            <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', background: 'rgba(245,158,11,0.04)' }}>
              {order.totalDiscount > 0 && <span style={{ fontSize: 11, color: '#22c55e' }}>Saving {fmt(order.totalDiscount)}</span>}
              <span style={{ fontSize: 15, fontWeight: 800, color: '#f59e0b', marginLeft: 'auto' }}>{fmt(order.grandTotal)}</span>
            </div>
          </div>

          {/* Invoice info */}
          {invoice && (
            <>
              <SectionTitle>INVOICE</SectionTitle>
              <div style={{ background: 'rgba(8,145,178,0.04)', border: '1px solid rgba(8,145,178,0.2)', borderRadius: 6, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{invoice.invoiceNumber}</span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: invoice.status === 'paid' ? 'rgba(34,197,94,0.1)' : 'rgba(8,145,178,0.1)', color: invoice.status === 'paid' ? '#22c55e' : '#0891b2', fontWeight: 700 }}>{invoice.status.toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Due: {new Date(invoice.dueDate).toLocaleDateString()} · {invoice.sentTo}</div>
                {invoice.paidAt && <div style={{ fontSize: 11, color: '#22c55e', marginTop: 4 }}>Paid: {new Date(invoice.paidAt).toLocaleDateString()}</div>}
              </div>
            </>
          )}

          {/* Approval history */}
          {order.approvalHistory.length > 0 && (
            <>
              <SectionTitle>APPROVAL HISTORY</SectionTitle>
              <div style={{ marginBottom: 16 }}>
                {order.approvalHistory.map((entry, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < order.approvalHistory.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.action === 'approved' ? '#22c55e' : entry.action === 'rejected' ? '#ef4444' : '#f59e0b', flexShrink: 0, marginTop: 4 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: '#fff' }}>{entry.comment}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{entry.actorEmail} · {new Date(entry.timestamp).toLocaleString()}</div>
                    </div>
                    <span style={{ fontSize: 9, color: entry.action === 'approved' ? '#22c55e' : entry.action === 'rejected' ? '#ef4444' : '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>{entry.action}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Notes */}
          {order.notes && (
            <>
              <SectionTitle>NOTES</SectionTitle>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>{order.notes}</div>
            </>
          )}
        </div>

        {/* Action bar */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          {canSubmit && (
            <button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: '#f59e0b', border: 'none', borderRadius: 4, color: '#000', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              <Send size={13} /> {submitMutation.isPending ? 'SUBMITTING...' : 'SUBMIT FOR APPROVAL'}
            </button>
          )}
          {canApprove && (
            <button onClick={() => setShowApprove(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 4, color: '#22c55e', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              <CheckCircle2 size={13} /> REVIEW & APPROVE
            </button>
          )}
          {canInvoice && (
            <button onClick={() => setShowInvoice(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: 'rgba(8,145,178,0.1)', border: '1px solid rgba(8,145,178,0.3)', borderRadius: 4, color: '#0891b2', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              <FileText size={13} /> GENERATE & SEND INVOICE
            </button>
          )}
          {canMarkPaid && (
            <button onClick={() => markPaidMutation.mutate()} disabled={markPaidMutation.isPending}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 4, color: '#22c55e', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              <CreditCard size={13} /> {markPaidMutation.isPending ? 'MARKING...' : 'MARK AS PAID'}
            </button>
          )}
        </div>
      </div>

      {showApprove && <ApprovalModal order={order} onClose={() => { setShowApprove(false); qc.invalidateQueries({ queryKey: ['entOrder', orderId] }); }} />}
      {showInvoice && <InvoiceModal order={order} customer={customer} onClose={() => { setShowInvoice(false); qc.invalidateQueries({ queryKey: ['entOrder', orderId] }); detailQ.refetch(); }} />}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EnterpriseSales() {
  const [showOrderWizard, setShowOrderWizard] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');

  const statsQ = useQuery({
    queryKey: ['entStats'],
    queryFn: () => enterpriseApi.getStats().then(r => r.data.data as Stats),
  });

  const ordersQ = useQuery({
    queryKey: ['entOrders', filterStatus],
    queryFn: () => enterpriseApi.getOrders(filterStatus ? { status: filterStatus } : undefined).then(r => r.data.data.orders as Order[]),
  });

  const stats = statsQ.data;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto', position: 'relative' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: '0 0 4px', letterSpacing: '0.5px' }}>Enterprise Sales</h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Order pipeline · approval workflow · invoicing</div>
        </div>
        <button onClick={() => setShowOrderWizard(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#f59e0b', border: 'none', borderRadius: 4, color: '#000', cursor: 'pointer', fontSize: 11, fontWeight: 800, letterSpacing: '0.5px' }}>
          <Plus size={13} /> NEW ORDER
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'PIPELINE', value: fmt(((stats?.revenue.pending || 0) + (stats?.revenue.approved || 0))), sub: `${(stats?.counts.submitted || 0) + (stats?.counts.pending_finance || 0) + (stats?.counts.approved || 0)} orders`, color: '#f59e0b' },
          { label: 'PENDING REVIEW', value: (stats?.counts.submitted || 0) + (stats?.counts.pending_finance || 0), sub: fmt(stats?.revenue.pending || 0), color: '#f97316' },
          { label: 'APPROVED', value: stats?.counts.approved || 0, sub: fmt(stats?.revenue.approved || 0), color: '#22c55e' },
          { label: 'INVOICED', value: stats?.counts.invoiced || 0, sub: fmt(stats?.revenue.invoiced || 0), color: '#0891b2' },
          { label: 'PAID', value: stats?.counts.paid || 0, sub: fmt(stats?.revenue.paid || 0), color: '#7c3aed' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', borderLeft: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 9, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: s.color, marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Pipeline stage bar */}
      <div style={{ display: 'flex', gap: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 20px', marginBottom: 20, alignItems: 'center', overflowX: 'auto' }}>
        {PIPELINE.map((p, i) => {
          const count = stats?.counts[p.status] || 0;
          const cfg = STATUS_CFG[p.status];
          return (
            <div key={p.status} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <button onClick={() => setFilterStatus(filterStatus === p.status ? '' : p.status)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 16px', borderRadius: 4, background: filterStatus === p.status ? cfg.bg : 'transparent', border: `1px solid ${filterStatus === p.status ? cfg.color : 'transparent'}`, cursor: 'pointer' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: count > 0 ? cfg.color : 'rgba(255,255,255,0.2)' }}>{count}</div>
                <div style={{ fontSize: 9, letterSpacing: '1px', color: filterStatus === p.status ? cfg.color : 'var(--text-muted)' }}>{p.label.toUpperCase()}</div>
              </button>
              {i < PIPELINE.length - 1 && <ChevronRight size={14} color="rgba(255,255,255,0.15)" />}
            </div>
          );
        })}
        {filterStatus && (
          <button onClick={() => setFilterStatus('')} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10 }}>
            <X size={10} /> Clear filter
          </button>
        )}
      </div>

      {/* Orders table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 140px 100px 100px', gap: 0, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
          {['ORDER #', 'CUSTOMER', 'PRODUCTS', 'TOTAL', 'STATUS', 'DATE'].map(h => (
            <div key={h} style={{ fontSize: 9, letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 700 }}>{h}</div>
          ))}
        </div>

        {ordersQ.isLoading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} />
          </div>
        ) : ordersQ.data?.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px 24px', color: 'var(--text-muted)' }}>
            <DollarSign size={32} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.3 }} />
            <div style={{ fontSize: 13, marginBottom: 4 }}>No orders yet</div>
            <div style={{ fontSize: 11 }}>Click NEW ORDER to create your first enterprise order.</div>
          </div>
        ) : (
          ordersQ.data?.map(order => (
            <div key={order.id} onClick={() => setSelectedOrderId(order.id)}
              style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 140px 100px 100px', gap: 0, padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', alignItems: 'center', transition: 'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', fontFamily: 'monospace' }}>{order.orderNumber}</div>
              <div>
                <div style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{order.customerName}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{order.salesPersonEmail}</div>
              </div>
              <div>
                {order.lineItems.map((item, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {item.product} × {item.seats.toLocaleString()} seats
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{fmt(order.grandTotal)}</div>
                {order.totalDiscount > 0 && <div style={{ fontSize: 10, color: '#22c55e' }}>−{fmt(order.totalDiscount)} disc</div>}
              </div>
              <StatusPill status={order.status} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(order.createdAt).toLocaleDateString()}</div>
            </div>
          ))
        )}
      </div>

      {/* Modals & panels */}
      {showOrderWizard && <OrderWizard onClose={() => setShowOrderWizard(false)} />}
      {selectedOrderId && <OrderPanel orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Shared UI primitives ──────────────────────────────────────────────────────
function Modal({ title, onClose, width, children }: { title: string; onClose: () => void; width: number; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 28, width, maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: '1.5px', color: '#fff', margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ step, total, onBack, onNext, nextLabel, disabled, onClose }: {
  step: number; total: number; onBack: () => void; onNext: () => void;
  nextLabel: string; disabled?: boolean; onClose: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'space-between', alignItems: 'center' }}>
      <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
      <div style={{ display: 'flex', gap: 8 }}>
        {step > 0 && (
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>
            <ChevronLeft size={13} /> Back
          </button>
        )}
        <button onClick={onNext} disabled={disabled}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 18px', borderRadius: 4, border: 'none', background: disabled ? '#374151' : '#f59e0b', color: disabled ? 'var(--text-muted)' : '#000', cursor: disabled ? 'default' : 'pointer', fontSize: 12, fontWeight: 700 }}>
          {nextLabel} {step < total - 1 && <ChevronRight size={13} />}
        </button>
      </div>
    </div>
  );
}

function MF({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 5 }}>{label}</div>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '7px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 4, color: '#fff', fontSize: 12, boxSizing: 'border-box' }} />
    </div>
  );
}

function SelectF({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 5 }}>{label}</div>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '7px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 4, color: '#fff', fontSize: 12 }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function Row2({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: '#fff', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 9, letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8 }}>{children}</div>;
}
