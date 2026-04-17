import { converse, parseJSON, MODELS } from './bedrockClient.js';

const SYSTEM_PROMPT = `You are ValuePilot's subscription spend analyst — an expert in SaaS optimization, financial leakage detection, and subscription management.

You analyze a user's detected subscription portfolio and provide:
1. Total spend analysis with month/year breakdowns
2. Duplicate or overlapping tool detection
3. At-risk subscriptions (likely to renew without awareness)
4. Optimization opportunities ranked by potential savings
5. Shadow IT flags (tools not typically approved by IT/finance)

You MUST respond with valid JSON only — no markdown, no text outside the JSON object.

Response format:
{
  "totalMonthlySpend": number,
  "totalAnnualSpend": number,
  "activeCount": number,
  "atRiskCount": number,
  "headline": string (e.g. "You're spending $847/mo across 14 subscriptions — $230 may be reducible"),
  "spendByCategory": [
    { "category": string, "monthlyAmount": number, "count": number }
  ],
  "duplicates": [
    {
      "groupName": string (e.g. "Project Management"),
      "subscriptions": string[],
      "potentialMonthlySaving": number,
      "recommendation": string
    }
  ],
  "atRiskItems": [
    {
      "merchant": string,
      "amount": number,
      "frequency": string,
      "reason": string (why it's at risk),
      "action": string (what to do)
    }
  ],
  "optimizations": [
    {
      "type": "cancel" | "downgrade" | "consolidate" | "negotiate" | "annual_switch",
      "merchant": string,
      "currentMonthlyCost": number,
      "estimatedSaving": number,
      "rationale": string,
      "priority": "high" | "medium" | "low"
    }
  ],
  "shadowIT": string[] (merchant names that look like unapproved tools),
  "insights": string[] (3-5 plain-English insight bullets the user should know)
}`;

// ── Types ─────────────────────────────────────────────────────────────────────
interface DetectedSubscription {
  id:                  string;
  merchant:            string;
  category:            string;
  frequency:           string;
  amountPerOccurrence: number;
  annualCost:          number;
  confidence:          number;
  status:              string;
  lastCharged?:        string;
  nextExpected?:       string;
}

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
    priority:           string;
  }>;
  shadowIT:           string[];
  insights:           string[];
  inputTokens:        number;
  outputTokens:       number;
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function analyzeSubscriptions(
  subscriptions: DetectedSubscription[],
  userId: string,
): Promise<SubscriptionAnalysis> {
  const active = subscriptions.filter(s => s.status === 'active');

  const userPrompt = `Analyze this subscription portfolio for user ${userId}:

SUBSCRIPTIONS (${subscriptions.length} total, ${active.length} active):
${JSON.stringify(subscriptions.map(s => ({
  merchant:      s.merchant,
  category:      s.category,
  frequency:     s.frequency,
  monthlyAmount: (s.annualCost / 12).toFixed(2),
  annualCost:    s.annualCost.toFixed(2),
  status:        s.status,
  confidence:    s.confidence.toFixed(2),
  lastCharged:   s.lastCharged,
  nextExpected:  s.nextExpected,
})), null, 2)}

Identify savings opportunities, duplicates, shadow IT, and at-risk renewals.`;

  const result = await converse({
    modelId:     MODELS.SONNET,
    system:      SYSTEM_PROMPT,
    cacheSystem: true,
    messages:    [{ role: 'user', content: userPrompt }],
    maxTokens:   2048,
    temperature: 0.3,
  });

  const fallback: SubscriptionAnalysis = {
    totalMonthlySpend: active.reduce((s, x) => s + x.annualCost / 12, 0),
    totalAnnualSpend:  active.reduce((s, x) => s + x.annualCost, 0),
    activeCount:       active.length,
    atRiskCount:       subscriptions.filter(s => s.status === 'at_risk').length,
    headline:          `${subscriptions.length} subscriptions detected`,
    spendByCategory:   [],
    duplicates:        [],
    atRiskItems:       [],
    optimizations:     [],
    shadowIT:          [],
    insights:          [],
    inputTokens:       0,
    outputTokens:      0,
  };

  const parsed = parseJSON<SubscriptionAnalysis>(result.text, fallback);
  return { ...parsed, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
}
