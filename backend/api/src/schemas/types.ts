// ── Auth ──────────────────────────────────────────────────────
export interface JwtPayload {
  userId: string;
  email: string;
  role: 'admin' | 'analyst' | 'viewer';
}

export interface AuthUser extends JwtPayload {
  iat: number;
  exp: number;
}

// ── API responses ─────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ── Transactions ──────────────────────────────────────────────
export interface Transaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  currency: string;
  transaction_type: 'debit' | 'credit' | 'transfer' | 'withdrawal';
  merchant_category?: string;
  merchant_name?: string;
  location?: string;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed' | 'reversed';
}

// ── ML Service types ──────────────────────────────────────────
export interface AnomalyResult {
  transaction_id: string;
  is_anomaly: boolean;
  anomaly_score: number;
  reasons: string[];
}

export interface PatternResult {
  account_id: string;
  patterns: Record<string, unknown>[];
  analysis_window_days: number;
  total_transactions: number;
}

export interface Recommendation {
  account_id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  message: string;
  transaction_ids: string[];
  recommended_action: string;
  confidence: number;
}

export interface InferenceResponse {
  account_id: string | null;
  anomalies: AnomalyResult[];
  patterns: PatternResult | null;
  recommendations: Recommendation[];
  transactions_analyzed: number;
  model_version: string;
}