/**
 * ValuePilot Enterprise Entitlement System
 *
 * Order lifecycle: draft → submitted → pending_finance → approved → invoiced → paid
 * Sales person creates order → Sales Manager approves → Finance approves → Invoice sent
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import nodemailer from 'nodemailer';
import { getSecrets } from '../lib/secretsManager';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const router = Router();
router.use(authenticate);

// ── Store ─────────────────────────────────────────────────────────────────────
const STORE_FILE = path.join(__dirname, '../../.enterprise-store.json');

type OrgType      = 'federal' | 'commercial';
type OrderStatus  = 'draft' | 'submitted' | 'pending_finance' | 'approved' | 'rejected' | 'invoiced' | 'paid';
type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue';
type ApprovalStage = 'sales_review' | 'finance_review';

interface Customer {
  id:             string;
  name:           string;
  orgType:        OrgType;
  domain:         string;
  billingEmail:   string;
  billingContact: string;
  phone?:         string;
  address?:       string;
  city?:          string;
  state?:         string;
  country:        string;
  // Federal fields
  contractNumber?: string;
  agencyName?:     string;
  dunsNumber?:     string;
  // Commercial fields
  industry?:       string;
  website?:        string;
  createdAt:      string;
  createdBy:      string;
}

interface LineItem {
  product:     string;   // e.g. 'RenewalGuard'
  description: string;
  seats:       number;
  unitPrice:   number;   // USD per seat per year
  term:        number;   // years
  discount:    number;   // percentage 0-100
  total:       number;   // computed: seats * unitPrice * term * (1 - discount/100)
}

interface ApprovalEntry {
  stage:      ApprovalStage;
  actorEmail: string;
  actorId:    string;
  action:     'approved' | 'rejected' | 'comment';
  comment:    string;
  timestamp:  string;
}

interface Order {
  id:            string;
  orderNumber:   string;  // VP-2025-0001
  customerId:    string;
  customerName:  string;
  lineItems:     LineItem[];
  subtotal:      number;
  totalDiscount: number;
  grandTotal:    number;
  currency:      string;
  paymentTerms:  string;   // e.g. 'Net 30'
  status:        OrderStatus;
  salesPersonId: string;
  salesPersonEmail: string;
  salesPersonName:  string;
  notes:         string;
  internalNotes: string;
  approvalHistory: ApprovalEntry[];
  invoiceId?:    string;
  createdAt:     string;
  updatedAt:     string;
  submittedAt?:  string;
  approvedAt?:   string;
  invoicedAt?:   string;
}

interface Invoice {
  id:          string;
  invoiceNumber: string;  // INV-2025-0001
  orderId:     string;
  customerId:  string;
  lineItems:   LineItem[];
  subtotal:    number;
  grandTotal:  number;
  currency:    string;
  paymentTerms: string;
  dueDate:     string;
  status:      InvoiceStatus;
  sentTo:      string;
  sentAt?:     string;
  paidAt?:     string;
  createdAt:   string;
  createdBy:   string;
  notes:       string;
}

interface Store {
  customers: Customer[];
  orders:    Order[];
  invoices:  Invoice[];
  sequences: { order: number; invoice: number };
}

function loadStore(): Store {
  try {
    if (fs.existsSync(STORE_FILE)) return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch {}
  return { customers: [], orders: [], invoices: [], sequences: { order: 0, invoice: 0 } };
}

function saveStore(s: Store) {
  try { fs.writeFileSync(STORE_FILE, JSON.stringify(s, null, 2)); } catch {}
}

function nextOrderNumber(s: Store): string {
  s.sequences.order++;
  const year = new Date().getFullYear();
  return `VP-${year}-${String(s.sequences.order).padStart(4, '0')}`;
}

function nextInvoiceNumber(s: Store): string {
  s.sequences.invoice++;
  const year = new Date().getFullYear();
  return `INV-${year}-${String(s.sequences.invoice).padStart(4, '0')}`;
}

function computeOrder(lineItems: LineItem[]): { subtotal: number; totalDiscount: number; grandTotal: number } {
  let subtotal = 0, totalDiscount = 0;
  for (const item of lineItems) {
    const base     = item.seats * item.unitPrice * item.term;
    const disc     = base * (item.discount / 100);
    item.total     = base - disc;
    subtotal      += base;
    totalDiscount += disc;
  }
  return { subtotal, totalDiscount, grandTotal: subtotal - totalDiscount };
}

// ── Email ─────────────────────────────────────────────────────────────────────
function getMailer() {
  const smtp = getSecrets().smtp;
  if (!smtp.host) return null;
  return nodemailer.createTransport({
    host: smtp.host,
    port: parseInt(smtp.port),
    secure: smtp.port === '465',
    auth: { user: smtp.user, pass: smtp.pass },
  });
}

function buildInvoiceHtml(invoice: Invoice, customer: Customer, order: Order): string {
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(n);
  const rows = invoice.lineItems.map(item => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
        <strong style="color:#111;">${item.product}</strong><br/>
        <span style="font-size:13px;color:#6b7280;">${item.description}</span>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;color:#374151;">${item.seats.toLocaleString()}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;color:#374151;">${item.term} yr</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151;">${fmt(item.unitPrice)}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;color:#374151;">${item.discount > 0 ? `${item.discount}%` : '—'}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;color:#111;">${fmt(item.total)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Invoice ${invoice.invoiceNumber}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
<tr><td align="center">
<table width="700" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr><td style="background:#0f172a;padding:32px 40px;">
    <table width="100%"><tr>
      <td><span style="font-size:22px;font-weight:900;color:#f59e0b;letter-spacing:-0.5px;">⬡ VALUEPILOT</span><br/>
      <span style="font-size:11px;color:#94a3b8;letter-spacing:2px;">ENTERPRISE INVOICE</span></td>
      <td align="right">
        <div style="font-size:24px;font-weight:800;color:#fff;">${invoice.invoiceNumber}</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Issued: ${new Date(invoice.createdAt).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div>
        <div style="font-size:12px;color:#f59e0b;margin-top:2px;">Due: ${new Date(invoice.dueDate).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- Bill To / From -->
  <tr><td style="padding:32px 40px;border-bottom:1px solid #e5e7eb;">
    <table width="100%"><tr>
      <td width="50%" style="vertical-align:top;">
        <div style="font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:2px;margin-bottom:8px;">BILL TO</div>
        <div style="font-size:16px;font-weight:700;color:#111;">${customer.name}</div>
        <div style="font-size:13px;color:#6b7280;margin-top:4px;">${customer.billingContact}</div>
        <div style="font-size:13px;color:#6b7280;">${customer.billingEmail}</div>
        ${customer.address ? `<div style="font-size:13px;color:#6b7280;margin-top:4px;">${customer.address}</div>` : ''}
        ${customer.city ? `<div style="font-size:13px;color:#6b7280;">${customer.city}${customer.state ? `, ${customer.state}` : ''}</div>` : ''}
        <div style="font-size:13px;color:#6b7280;">${customer.country}</div>
        ${customer.contractNumber ? `<div style="font-size:12px;color:#7c3aed;margin-top:6px;">Contract: ${customer.contractNumber}</div>` : ''}
      </td>
      <td width="50%" style="vertical-align:top;text-align:right;">
        <div style="font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:2px;margin-bottom:8px;">FROM</div>
        <div style="font-size:16px;font-weight:700;color:#111;">ValuePilot, Inc.</div>
        <div style="font-size:13px;color:#6b7280;margin-top:4px;">billing@valuepilot.com</div>
        <div style="font-size:13px;color:#6b7280;">EIN: 88-XXXXXXX</div>
        <div style="font-size:12px;color:#6b7280;margin-top:6px;">Sales Order: ${order.orderNumber}</div>
        <div style="font-size:12px;color:#6b7280;">Sales Rep: ${order.salesPersonName}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px;">Payment Terms: ${invoice.paymentTerms}</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- Line items table -->
  <tr><td style="padding:0 40px 0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:10px 16px;text-align:left;font-size:11px;color:#6b7280;letter-spacing:1px;font-weight:600;border-bottom:2px solid #e5e7eb;">PRODUCT / DESCRIPTION</th>
          <th style="padding:10px 16px;text-align:center;font-size:11px;color:#6b7280;letter-spacing:1px;font-weight:600;border-bottom:2px solid #e5e7eb;">SEATS</th>
          <th style="padding:10px 16px;text-align:center;font-size:11px;color:#6b7280;letter-spacing:1px;font-weight:600;border-bottom:2px solid #e5e7eb;">TERM</th>
          <th style="padding:10px 16px;text-align:right;font-size:11px;color:#6b7280;letter-spacing:1px;font-weight:600;border-bottom:2px solid #e5e7eb;">UNIT PRICE</th>
          <th style="padding:10px 16px;text-align:center;font-size:11px;color:#6b7280;letter-spacing:1px;font-weight:600;border-bottom:2px solid #e5e7eb;">DISCOUNT</th>
          <th style="padding:10px 16px;text-align:right;font-size:11px;color:#6b7280;letter-spacing:1px;font-weight:600;border-bottom:2px solid #e5e7eb;">TOTAL</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </td></tr>

  <!-- Totals -->
  <tr><td style="padding:16px 40px 32px;">
    <table width="100%"><tr><td></td>
      <td width="280" style="text-align:right;">
        <table width="100%">
          <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;">Subtotal</td><td style="padding:4px 0;font-size:13px;color:#374151;text-align:right;">${fmt(invoice.subtotal)}</td></tr>
          <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;">Volume Discount</td><td style="padding:4px 0;font-size:13px;color:#22c55e;text-align:right;">− ${fmt(invoice.subtotal - invoice.grandTotal)}</td></tr>
          <tr><td colspan="2" style="border-top:2px solid #111;padding-top:8px;"></td></tr>
          <tr><td style="padding:6px 0;font-size:18px;font-weight:800;color:#111;">TOTAL DUE</td>
              <td style="padding:6px 0;font-size:18px;font-weight:800;color:#111;text-align:right;">${fmt(invoice.grandTotal)}</td></tr>
          <tr><td colspan="2" style="font-size:11px;color:#9ca3af;text-align:right;padding-top:4px;">${invoice.currency.toUpperCase()} · ${invoice.paymentTerms}</td></tr>
        </table>
      </td>
    </tr></table>
  </td></tr>

  ${order.notes ? `<tr><td style="padding:0 40px 24px;">
    <div style="background:#f8fafc;border-radius:6px;padding:14px 16px;font-size:13px;color:#6b7280;border-left:3px solid #e5e7eb;">
      <strong style="color:#374151;display:block;margin-bottom:4px;">Notes</strong>${order.notes}
    </div>
  </td></tr>` : ''}

  <!-- Footer -->
  <tr><td style="background:#0f172a;padding:20px 40px;">
    <div style="font-size:11px;color:#64748b;text-align:center;">
      Questions? Contact us at <a href="mailto:billing@valuepilot.com" style="color:#f59e0b;text-decoration:none;">billing@valuepilot.com</a>
      &nbsp;·&nbsp; valuepilot.com &nbsp;·&nbsp; This is a legally binding invoice
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

async function sendInvoiceEmail(invoice: Invoice, customer: Customer, order: Order): Promise<{ sent: boolean; preview?: string }> {
  const html = buildInvoiceHtml(invoice, customer, order);
  const mailer = getMailer();

  if (!mailer) {
    // Dev mode: log HTML, return a data URL for preview
    console.log('\n[INVOICE EMAIL — no SMTP configured, set SMTP_HOST to send]\n');
    console.log(`  To:      ${invoice.sentTo}`);
    console.log(`  Subject: Invoice ${invoice.invoiceNumber} from ValuePilot`);
    console.log(`  Amount:  $${invoice.grandTotal.toLocaleString()}\n`);
    return { sent: false, preview: html };
  }

  await mailer.sendMail({
    from: `"ValuePilot Billing" <${getSecrets().smtp.user || 'billing@valuepilot.com'}>`,
    to:   invoice.sentTo,
    cc:   order.salesPersonEmail,
    subject: `Invoice ${invoice.invoiceNumber} — ${customer.name} ($${invoice.grandTotal.toLocaleString()})`,
    html,
  });

  return { sent: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMERS
// ─────────────────────────────────────────────────────────────────────────────

// GET /customers
router.get('/customers', (_req: Request, res: Response) => {
  const store = loadStore();
  res.json({ success: true, data: { customers: store.customers } });
});

// POST /customers
router.post('/customers', (req: Request, res: Response) => {
  const user  = req.user!;
  const store = loadStore();
  const { name, orgType, domain, billingEmail, billingContact, phone,
    address, city, state, country, contractNumber, agencyName, dunsNumber,
    industry, website } = req.body;

  if (!name || !billingEmail || !billingContact)
    return res.status(400).json({ success: false, error: 'name, billingEmail, and billingContact are required' });

  const customer: Customer = {
    id: randomUUID(), name, orgType: orgType || 'commercial', domain: domain || '',
    billingEmail, billingContact, phone, address, city, state, country: country || 'US',
    contractNumber, agencyName, dunsNumber, industry, website,
    createdAt: new Date().toISOString(), createdBy: user.email,
  };
  store.customers.push(customer);
  saveStore(store);
  res.status(201).json({ success: true, data: { customer } });
});

// PUT /customers/:id
router.put('/customers/:id', (req: Request, res: Response) => {
  const store = loadStore();
  const idx   = store.customers.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Customer not found' });
  const editable = ['name','orgType','domain','billingEmail','billingContact','phone','address','city','state','country','contractNumber','agencyName','dunsNumber','industry','website'];
  for (const k of editable) {
    if (req.body[k] !== undefined) (store.customers[idx] as any)[k] = req.body[k];
  }
  saveStore(store);
  res.json({ success: true, data: { customer: store.customers[idx] } });
});

// ─────────────────────────────────────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────────────────────────────────────

// GET /orders
router.get('/orders', (req: Request, res: Response) => {
  const store  = loadStore();
  let orders   = store.orders;
  const { status, customerId } = req.query as Record<string, string>;
  if (status)     orders = orders.filter(o => o.status === status);
  if (customerId) orders = orders.filter(o => o.customerId === customerId);
  // Enrich with customer name
  const enriched = orders.map(o => {
    const customer = store.customers.find(c => c.id === o.customerId);
    return { ...o, customerName: customer?.name || o.customerName };
  });
  res.json({ success: true, data: { orders: enriched.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) } });
});

// GET /orders/:id
router.get('/orders/:id', (req: Request, res: Response) => {
  const store  = loadStore();
  const order  = store.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
  const customer = store.customers.find(c => c.id === order.customerId);
  const invoice  = order.invoiceId ? store.invoices.find(i => i.id === order.invoiceId) : null;
  res.json({ success: true, data: { order, customer, invoice } });
});

// POST /orders — create draft
router.post('/orders', (req: Request, res: Response) => {
  const user  = req.user!;
  const store = loadStore();
  const { customerId, lineItems, paymentTerms, notes, internalNotes, currency } = req.body;

  if (!customerId || !Array.isArray(lineItems) || lineItems.length === 0)
    return res.status(400).json({ success: false, error: 'customerId and lineItems are required' });

  const customer = store.customers.find(c => c.id === customerId);
  if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

  const items: LineItem[] = lineItems.map((i: any) => ({
    product:     i.product     || '',
    description: i.description || '',
    seats:       Number(i.seats)     || 0,
    unitPrice:   Number(i.unitPrice) || 0,
    term:        Number(i.term)      || 1,
    discount:    Number(i.discount)  || 0,
    total:       0,
  }));

  const { subtotal, totalDiscount, grandTotal } = computeOrder(items);

  const orderNumber = nextOrderNumber(store);
  const order: Order = {
    id: randomUUID(), orderNumber, customerId, customerName: customer.name,
    lineItems: items, subtotal, totalDiscount, grandTotal,
    currency: currency || 'usd', paymentTerms: paymentTerms || 'Net 30',
    status: 'draft', salesPersonId: user.userId, salesPersonEmail: user.email,
    salesPersonName: (user as any).name || user.email,
    notes: notes || '', internalNotes: internalNotes || '',
    approvalHistory: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  store.orders.push(order);
  saveStore(store);
  res.status(201).json({ success: true, data: { order } });
});

// PUT /orders/:id — update draft
router.put('/orders/:id', (req: Request, res: Response) => {
  const store = loadStore();
  const idx   = store.orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Order not found' });
  const order = store.orders[idx];
  if (!['draft'].includes(order.status))
    return res.status(400).json({ success: false, error: 'Only draft orders can be edited' });

  const { lineItems, paymentTerms, notes, internalNotes } = req.body;
  if (Array.isArray(lineItems)) {
    const items: LineItem[] = lineItems.map((i: any) => ({
      product: i.product || '', description: i.description || '',
      seats: Number(i.seats) || 0, unitPrice: Number(i.unitPrice) || 0,
      term: Number(i.term) || 1, discount: Number(i.discount) || 0, total: 0,
    }));
    const totals = computeOrder(items);
    order.lineItems     = items;
    order.subtotal      = totals.subtotal;
    order.totalDiscount = totals.totalDiscount;
    order.grandTotal    = totals.grandTotal;
  }
  if (paymentTerms)  order.paymentTerms  = paymentTerms;
  if (notes !== undefined)         order.notes         = notes;
  if (internalNotes !== undefined) order.internalNotes = internalNotes;
  order.updatedAt = new Date().toISOString();
  saveStore(store);
  res.json({ success: true, data: { order } });
});

// POST /orders/:id/submit — submit for approval
router.post('/orders/:id/submit', (req: Request, res: Response) => {
  const user  = req.user!;
  const store = loadStore();
  const idx   = store.orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Order not found' });
  const order = store.orders[idx];
  if (order.status !== 'draft')
    return res.status(400).json({ success: false, error: 'Only draft orders can be submitted' });

  order.status      = 'submitted';
  order.submittedAt = new Date().toISOString();
  order.updatedAt   = new Date().toISOString();
  order.approvalHistory.push({
    stage: 'sales_review', actorId: user.userId, actorEmail: user.email,
    action: 'comment', comment: 'Order submitted for approval', timestamp: new Date().toISOString(),
  });
  saveStore(store);
  res.json({ success: true, data: { order } });
});

// POST /orders/:id/approve — sales manager approves (moves to pending_finance)
router.post('/orders/:id/approve', (req: Request, res: Response) => {
  const user    = req.user!;
  const store   = loadStore();
  const idx     = store.orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Order not found' });
  const order   = store.orders[idx];
  const { comment = '', stage } = req.body;

  const allowedStatuses: Record<string, OrderStatus> = {
    submitted:       'pending_finance',
    pending_finance: 'approved',
  };
  const nextStatus = allowedStatuses[order.status];
  if (!nextStatus)
    return res.status(400).json({ success: false, error: `Cannot approve an order in '${order.status}' status` });

  const approvalStage: ApprovalStage = order.status === 'submitted' ? 'sales_review' : 'finance_review';

  order.approvalHistory.push({
    stage: approvalStage, actorId: user.userId, actorEmail: user.email,
    action: 'approved', comment: comment || 'Approved', timestamp: new Date().toISOString(),
  });
  order.status    = nextStatus;
  order.updatedAt = new Date().toISOString();
  if (nextStatus === 'approved') order.approvedAt = new Date().toISOString();
  saveStore(store);
  res.json({ success: true, data: { order } });
});

// POST /orders/:id/reject
router.post('/orders/:id/reject', (req: Request, res: Response) => {
  const user  = req.user!;
  const store = loadStore();
  const idx   = store.orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Order not found' });
  const order = store.orders[idx];
  if (!['submitted','pending_finance'].includes(order.status))
    return res.status(400).json({ success: false, error: `Cannot reject an order in '${order.status}' status` });

  const approvalStage: ApprovalStage = order.status === 'submitted' ? 'sales_review' : 'finance_review';
  order.approvalHistory.push({
    stage: approvalStage, actorId: user.userId, actorEmail: user.email,
    action: 'rejected', comment: req.body.comment || 'Rejected', timestamp: new Date().toISOString(),
  });
  order.status    = 'rejected';
  order.updatedAt = new Date().toISOString();
  saveStore(store);
  res.json({ success: true, data: { order } });
});

// ─────────────────────────────────────────────────────────────────────────────
// INVOICES
// ─────────────────────────────────────────────────────────────────────────────

// POST /orders/:id/invoice — generate & send invoice
router.post('/orders/:id/invoice', async (req: Request, res: Response) => {
  const user  = req.user!;
  const store = loadStore();
  const idx   = store.orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Order not found' });
  const order = store.orders[idx];

  if (order.status !== 'approved')
    return res.status(400).json({ success: false, error: 'Order must be approved before invoicing' });

  const customer = store.customers.find(c => c.id === order.customerId);
  if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

  const { dueDate, sentTo, notes } = req.body;
  const netDays  = parseInt((order.paymentTerms.match(/\d+/) || ['30'])[0]);
  const due      = dueDate || new Date(Date.now() + netDays * 86400000).toISOString().split('T')[0];
  const emailTo  = sentTo || customer.billingEmail;

  const invoiceNumber = nextInvoiceNumber(store);
  const invoice: Invoice = {
    id: randomUUID(), invoiceNumber, orderId: order.id, customerId: customer.id,
    lineItems: order.lineItems, subtotal: order.subtotal, grandTotal: order.grandTotal,
    currency: order.currency, paymentTerms: order.paymentTerms,
    dueDate: due, status: 'draft', sentTo: emailTo,
    createdAt: new Date().toISOString(), createdBy: user.email,
    notes: notes || order.notes,
  };

  store.invoices.push(invoice);
  order.invoiceId   = invoice.id;
  order.status      = 'invoiced';
  order.invoicedAt  = new Date().toISOString();
  order.updatedAt   = new Date().toISOString();
  saveStore(store);

  // Send email
  try {
    const result = await sendInvoiceEmail(invoice, customer, order);
    const idx2   = store.invoices.findIndex(i => i.id === invoice.id);
    if (idx2 !== -1) {
      store.invoices[idx2].status = result.sent ? 'sent' : 'draft';
      if (result.sent) store.invoices[idx2].sentAt = new Date().toISOString();
      saveStore(store);
    }
    res.json({ success: true, data: { invoice: store.invoices[idx2 === -1 ? 0 : idx2], emailSent: result.sent, preview: result.preview } });
  } catch (err: any) {
    console.error('Invoice email error:', err.message);
    res.json({ success: true, data: { invoice, emailSent: false, emailError: err.message } });
  }
});

// GET /invoices/:id/preview — return invoice HTML
router.get('/invoices/:id/preview', (req: Request, res: Response) => {
  const store   = loadStore();
  const invoice = store.invoices.find(i => i.id === req.params.id);
  if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
  const order    = store.orders.find(o => o.id === invoice.orderId);
  const customer = store.customers.find(c => c.id === invoice.customerId);
  if (!order || !customer) return res.status(404).json({ success: false, error: 'Associated order/customer not found' });
  const html = buildInvoiceHtml(invoice, customer, order);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// POST /invoices/:id/mark-paid
router.post('/invoices/:id/mark-paid', (req: Request, res: Response) => {
  const store = loadStore();
  const iIdx  = store.invoices.findIndex(i => i.id === req.params.id);
  if (iIdx === -1) return res.status(404).json({ success: false, error: 'Invoice not found' });
  store.invoices[iIdx].status = 'paid';
  store.invoices[iIdx].paidAt = new Date().toISOString();
  const oIdx = store.orders.findIndex(o => o.id === store.invoices[iIdx].orderId);
  if (oIdx !== -1) { store.orders[oIdx].status = 'paid'; store.orders[oIdx].updatedAt = new Date().toISOString(); }
  saveStore(store);
  res.json({ success: true, data: { invoice: store.invoices[iIdx] } });
});

// GET /stats — pipeline metrics
router.get('/stats', (_req: Request, res: Response) => {
  const store  = loadStore();
  const counts = store.orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const revenue = {
    draft:          store.orders.filter(o => o.status === 'draft').reduce((s, o) => s + o.grandTotal, 0),
    pending:        store.orders.filter(o => ['submitted','pending_finance'].includes(o.status)).reduce((s, o) => s + o.grandTotal, 0),
    approved:       store.orders.filter(o => o.status === 'approved').reduce((s, o) => s + o.grandTotal, 0),
    invoiced:       store.orders.filter(o => o.status === 'invoiced').reduce((s, o) => s + o.grandTotal, 0),
    paid:           store.orders.filter(o => o.status === 'paid').reduce((s, o) => s + o.grandTotal, 0),
  };
  res.json({ success: true, data: { counts, revenue, totalCustomers: store.customers.length, totalOrders: store.orders.length } });
});

export default router;
