import { converse, parseJSON, MODELS } from './bedrockClient.js';

const SYSTEM_PROMPT = `You are ValuePilot's financial intelligence analyst. You receive ML anomaly detection results for bank transactions and produce clear, actionable explanations for end users.

Your explanations must be:
- Written in plain English for a non-technical audience
- Specific to the actual transaction data provided
- Actionable — always include a recommended next step
- Concise — no jargon, no filler

You MUST respond with valid JSON only — no markdown, no text outside the JSON object.

Response format:
{
  "headline": string (8-12 words, what happened),
  "explanation": string (2-3 sentences explaining the anomaly in plain English),
  "riskLevel": "critical" | "high" | "medium" | "low",
  "recommendedActions": string[] (2-4 specific actions the user should take),
  "anomalyBreakdown": [
    {
      "transactionId": string,
      "merchant": string,
      "amount": number,
      "currency": string,
      "finding": string (one sentence about this specific transaction),
      "category": "fraud" | "unusual_pattern" | "high_value" | "velocity" | "other"
    }
  ],
  "patternSummary": string | null (if patterns were detected, summarize them in 1-2 sentences)
}`;

// ── Types ─────────────────────────────────────────────────────────────────────
interface AnomalyResult {
  transaction_id: string;
  is_anomaly:     boolean;
  anomaly_score:  number;
  reasons:        string[];
}

interface Recommendation {
  severity:           string;
  category:           string;
  message:            string;
  transaction_ids:    string[];
  recommended_action: string;
  confidence:         number;
}

interface Transaction {
  transaction_id:    string;
  amount:            number;
  currency:          string;
  merchant_name?:    string;
  merchant_category?: string;
  timestamp:         string;
  status:            string;
}

export interface AnomalyExplanation {
  headline:            string;
  explanation:         string;
  riskLevel:           'critical' | 'high' | 'medium' | 'low';
  recommendedActions:  string[];
  anomalyBreakdown:    Array<{
    transactionId: string;
    merchant:      string;
    amount:        number;
    currency:      string;
    finding:       string;
    category:      string;
  }>;
  patternSummary:      string | null;
  inputTokens:         number;
  outputTokens:        number;
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function explainAnomalies(
  anomalies:       AnomalyResult[],
  recommendations: Recommendation[],
  transactions:    Transaction[],
  accountId:       string,
): Promise<AnomalyExplanation> {
  const txnMap = new Map(transactions.map(t => [t.transaction_id, t]));

  const anomalyDetails = anomalies
    .filter(a => a.is_anomaly)
    .map(a => {
      const txn = txnMap.get(a.transaction_id);
      return {
        id:       a.transaction_id,
        score:    a.anomaly_score.toFixed(2),
        reasons:  a.reasons,
        merchant: txn?.merchant_name ?? 'Unknown',
        amount:   txn?.amount,
        currency: txn?.currency ?? 'USD',
        date:     txn?.timestamp,
      };
    });

  const userPrompt = `Explain these transaction anomalies detected for account ${accountId}:

ANOMALIES DETECTED (${anomalyDetails.length}):
${JSON.stringify(anomalyDetails, null, 2)}

ML RECOMMENDATIONS:
${JSON.stringify(recommendations, null, 2)}

Provide a clear explanation and action plan.`;

  const result = await converse({
    modelId:     MODELS.SONNET,
    system:      SYSTEM_PROMPT,
    cacheSystem: true,
    messages:    [{ role: 'user', content: userPrompt }],
    maxTokens:   1500,
    temperature: 0.2,
  });

  const parsed = parseJSON<AnomalyExplanation>(result.text, {
    headline:           'Unusual activity detected on your account',
    explanation:        'Our system detected unusual transaction patterns. Please review the transactions below.',
    riskLevel:          'medium',
    recommendedActions: ['Review flagged transactions', 'Contact your bank if you do not recognize any charges'],
    anomalyBreakdown:   [],
    patternSummary:     null,
    inputTokens:        0,
    outputTokens:       0,
  });

  return { ...parsed, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
}
