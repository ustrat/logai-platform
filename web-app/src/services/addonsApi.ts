import { useAuthStore } from '../store/authStore';

const BASE = '/api/v1/addons';

function authHeaders(): HeadersInit {
  const token = useAuthStore.getState().token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, headers: { ...authHeaders(), ...(init.headers ?? {}) } });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? 'Request failed');
  return json.data as T;
}

// ── SmartReminder™ ────────────────────────────────────────────────────────────
export interface Commitment {
  text:         string;
  counterparty: string;
  dueDate?:     string;
  context?:     string;
}

export const smartReminderApi = {
  analyze: (commitments: Commitment[]) =>
    request(`${BASE}/smart-reminder/analyze`, {
      method: 'POST',
      body: JSON.stringify({ commitments }),
    }),

  listReminders: () =>
    request(`${BASE}/smart-reminder/reminders`),

  dismiss: (id: string) =>
    request(`${BASE}/smart-reminder/reminders/${id}/dismiss`, { method: 'PUT', body: '{}' }),

  snooze: (id: string, until: string) =>
    request(`${BASE}/smart-reminder/reminders/${id}/snooze`, {
      method: 'POST',
      body: JSON.stringify({ until }),
    }),
};

// ── AutoDraft™ ────────────────────────────────────────────────────────────────
export type DraftTone = 'professional' | 'assertive' | 'conciliatory' | 'urgent' | 'friendly';
export type DraftType = 'follow_up' | 'commitment_reminder' | 'escalation' | 'acknowledgement' | 'proposal';

export interface DraftRequest {
  type?:            DraftType;
  tone?:            DraftTone;
  context:          string;
  recipient:        string;
  recipientRole?:   string;
  senderName:       string;
  commitmentText?:  string;
  deadline?:        string;
  previousResponse?: string;
}

export const autoDraftApi = {
  generate: (req: DraftRequest) =>
    request(`${BASE}/auto-draft/generate`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  refine: (id: string, feedback: string) =>
    request(`${BASE}/auto-draft/refine/${id}`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    }),

  history: () =>
    request(`${BASE}/auto-draft/history`),
};

// ── SpendAnalyzer™ ────────────────────────────────────────────────────────────
export interface SpendRecord {
  vendor:      string;
  amount:      number;
  currency:    string;
  category?:   string;
  department?: string;
  date:        string;
  invoiceRef?: string;
}

export const spendAnalyzerApi = {
  analyze: (records: SpendRecord[], currency?: string) =>
    request(`${BASE}/spend-analyzer/analyze`, {
      method: 'POST',
      body: JSON.stringify({ records, currency }),
    }),

  listReports: () =>
    request(`${BASE}/spend-analyzer/reports`),

  getReport: (id: string) =>
    request(`${BASE}/spend-analyzer/reports/${id}`),
};

// ── ContractWatch™ ────────────────────────────────────────────────────────────
export interface ContractInput {
  vendor:           string;
  description:      string;
  value:            number;
  currency?:        string;
  startDate:        string;
  endDate:          string;
  autoRenew:        boolean;
  noticePeriodDays: number;
}

export const contractWatchApi = {
  monitor: (input: ContractInput) =>
    request(`${BASE}/contract-watch/monitor`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listContracts: () =>
    request(`${BASE}/contract-watch/contracts`),

  getContract: (id: string) =>
    request(`${BASE}/contract-watch/contracts/${id}`),

  refresh: () =>
    request(`${BASE}/contract-watch/refresh`, { method: 'POST', body: '{}' }),
};

// ── CurrencyGuard™ ────────────────────────────────────────────────────────────
export interface FxTransaction {
  vendor:          string;
  sourceCurrency:  string;
  targetCurrency:  string;
  sourceAmount:    number;
  targetAmount:    number;
  appliedRate:     number;
  transactionDate: string;
  channel?:        string;
  invoiceRef?:     string;
}

export const currencyGuardApi = {
  analyze: (transactions: FxTransaction[]) =>
    request(`${BASE}/currency-guard/analyze`, {
      method: 'POST',
      body: JSON.stringify({ transactions }),
    }),

  listReports: () =>
    request(`${BASE}/currency-guard/reports`),

  getReport: (id: string) =>
    request(`${BASE}/currency-guard/reports/${id}`),
};

// ── TaxNormalizer™ ────────────────────────────────────────────────────────────
export interface TaxLineItem {
  vendor:      string;
  country:     string;
  region?:     string;
  taxType:     string;
  taxRate:     number;
  grossAmount: number;
  taxAmount:   number;
  netAmount:   number;
  currency:    string;
  invoiceRef?: string;
  invoiceDate: string;
}

export const taxNormalizerApi = {
  normalize: (lines: TaxLineItem[]) =>
    request(`${BASE}/tax-normalizer/normalize`, {
      method: 'POST',
      body: JSON.stringify({ lines }),
    }),

  listReports: () =>
    request(`${BASE}/tax-normalizer/reports`),

  getReport: (id: string) =>
    request(`${BASE}/tax-normalizer/reports/${id}`),
};

// ── EscalateAI™ ───────────────────────────────────────────────────────────────
export type EscalationType = 'refund_dispute' | 'renewal_dispute' | 'billing_error' | 'service_failure' | 'contract_breach';
export type EscalationOutcome = 'full_refund' | 'partial_refund' | 'credit' | 'contract_amendment' | 'renewal_waiver' | 'no_resolution';

export interface EscalationInput {
  type?:          EscalationType;
  vendor:         string;
  description:    string;
  amountAtStake:  number;
  currency?:      string;
  triggeredBy?:   'refundpilot' | 'renewalguard' | 'manual';
}

export const escalateAIApi = {
  initiate: (input: EscalationInput) =>
    request(`${BASE}/escalate-ai/initiate`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listEscalations: () =>
    request(`${BASE}/escalate-ai/escalations`),

  getEscalation: (id: string) =>
    request(`${BASE}/escalate-ai/escalations/${id}`),

  advance: (id: string, note?: string) =>
    request(`${BASE}/escalate-ai/escalations/${id}/advance`, {
      method: 'PUT',
      body: JSON.stringify({ note }),
    }),

  draft: (id: string) =>
    request(`${BASE}/escalate-ai/escalations/${id}/draft`, {
      method: 'POST',
      body: '{}',
    }),

  resolve: (id: string, outcome: EscalationOutcome, note: string) =>
    request(`${BASE}/escalate-ai/escalations/${id}/resolve`, {
      method: 'PUT',
      body: JSON.stringify({ outcome, note }),
    }),
};
