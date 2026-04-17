import api from './api';

// ── Email Signals ─────────────────────────────────────────────────────────────
export interface EmailSignalRequest {
  subject: string;
  from:    string;
  body:    string;
}

export interface EmailSignalEntity {
  amounts:     Array<{ value: number; currency: string; context: string }>;
  dates:       Array<{ raw: string; context: string }>;
  vendors:     string[];
  commitments: string[];
  deadlines:   string[];
}

export interface EmailSignal {
  productKey:  string;
  productName: string;
  signalType:  string;
  confidence:  number;
  urgency:     'high' | 'medium' | 'low' | 'none';
  summary:     string;
  entities:    Partial<EmailSignalEntity>;
}

export interface EmailSignalResult {
  signals:        EmailSignal[];
  overallUrgency: 'high' | 'medium' | 'low' | 'none';
  emailSummary:   string;
  inputTokens:    number;
  outputTokens:   number;
  cacheRead:      number;
}

// ── Anomaly Explainer ─────────────────────────────────────────────────────────
export interface AnomalyExplainRequest {
  accountId:       string;
  anomalies:       any[];
  recommendations: any[];
  transactions?:   any[];
}

export interface AnomalyExplanation {
  headline:           string;
  explanation:        string;
  riskLevel:          'critical' | 'high' | 'medium' | 'low';
  recommendedActions: string[];
  anomalyBreakdown:   Array<{
    transactionId: string;
    merchant:      string;
    amount:        number;
    currency:      string;
    finding:       string;
    category:      string;
  }>;
  patternSummary: string | null;
  inputTokens:    number;
  outputTokens:   number;
}

// ── Subscription Analyzer ─────────────────────────────────────────────────────
export interface SubscriptionAnalysis {
  totalMonthlySpend:  number;
  totalAnnualSpend:   number;
  activeCount:        number;
  atRiskCount:        number;
  headline:           string;
  spendByCategory:    Array<{ category: string; monthlyAmount: number; count: number }>;
  duplicates:         Array<{
    groupName:              string;
    subscriptions:          string[];
    potentialMonthlySaving: number;
    recommendation:         string;
  }>;
  atRiskItems:        Array<{
    merchant:  string;
    amount:    number;
    frequency: string;
    reason:    string;
    action:    string;
  }>;
  optimizations:      Array<{
    type:               string;
    merchant:           string;
    currentMonthlyCost: number;
    estimatedSaving:    number;
    rationale:          string;
    priority:           'high' | 'medium' | 'low';
  }>;
  shadowIT:    string[];
  insights:    string[];
  inputTokens: number;
  outputTokens: number;
}

// ── Enterprise Assistant ──────────────────────────────────────────────────────
export type AssistantTask =
  | 'summarize_order'
  | 'pricing_guidance'
  | 'draft_proposal_email'
  | 'draft_follow_up_email'
  | 'draft_invoice_cover_email'
  | 'renewal_risk'
  | 'pipeline_summary'
  | 'freeform';

export interface AssistantRequest {
  task:         AssistantTask;
  context:      Record<string, any>;
  instruction?: string;
}

export interface AssistantResponse {
  content:      string;
  inputTokens:  number;
  outputTokens: number;
  cacheRead:    number;
}

// ── API calls ─────────────────────────────────────────────────────────────────
export const bedrockApi = {
  status: () =>
    api.get('/bedrock/status'),

  analyzeEmailSignals: (req: EmailSignalRequest) =>
    api.post<EmailSignalResult>('/bedrock/email-signals', req),

  explainAnomalies: (req: AnomalyExplainRequest) =>
    api.post<AnomalyExplanation>('/bedrock/anomaly-explain', req),

  analyzeSubscriptions: (userId: string, subscriptions: any[]) =>
    api.post<SubscriptionAnalysis>('/bedrock/subscription-analyze', { userId, subscriptions }),

  assist: (req: AssistantRequest) =>
    api.post<AssistantResponse>('/bedrock/enterprise/assist', req),

  // Streaming — raw fetch for SSE (axios doesn't support streaming)
  assistStream: async (req: AssistantRequest): Promise<ReadableStream<Uint8Array>> => {
    const token = localStorage.getItem('token');
    const base  = (api.defaults.baseURL ?? '/api/v1').replace(/\/$/, '');
    const res   = await fetch(`${base}/bedrock/enterprise/assist/stream`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify(req),
    });
    if (!res.body) throw new Error('No stream body');
    return res.body;
  },
};
