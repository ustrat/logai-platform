import { converse, parseJSON, MODELS } from './bedrockClient.js';

// ── System prompt — cached across all email scans ────────────────────────────
// Long product definitions are ideal cache candidates: stable, reused per call.
const SYSTEM_PROMPT = `You are ValuePilot's email intelligence engine. Your job is to analyze email messages and extract product signals for all 7 ValuePilot products.

## ValuePilot Product Definitions

**RenewalGuard™** — Tracks SaaS/subscription renewal cycles. Signals: renewal notices, trial endings, contract renewals, cancellation warnings, auto-renew changes.

**RefundPilot™** — Monitors refund and dispute activity. Signals: refund processed/requested, chargebacks, payment failures, dispute notifications, credit memos.

**FollowUp™ / CommitmentIQ™** — Extracts commitments, promises, and follow-up obligations from email threads. Signals: explicit commitments ("I will", "we'll deliver"), deadlines, action items, missed obligations, follow-up requests.

**LeakageIndex™** — Detects spend leakage and shadow IT. Signals: unexpected recurring charges, underutilized subscriptions, price increases, new SaaS signups, duplicate tools, budget overruns.

**EnterprisePilot™** — Manages enterprise SaaS lifecycle. Signals: vendor invoices, procurement approvals, contract lifecycle events, compliance/audit notices, budget alerts, license renewals.

**DrivePilot™** — Fleet and vehicle expense intelligence. Signals: fleet alerts, insurance renewals, maintenance due, traffic violations/citations, fuel or mileage reports, vehicle registration.

**BoarderPilot™** — Cross-border payment and compliance intelligence. Signals: international wire transfers, currency conversion notices, VAT/tax compliance, jurisdictional risk alerts, foreign vendor payments.

## Response Format

You MUST respond with valid JSON only — no markdown, no explanation outside JSON.

{
  "signals": [
    {
      "productKey": "renewalguard" | "refundpilot" | "followup" | "leakageindex" | "enterprisepilot" | "drivepilot" | "boarderpilot",
      "productName": string,
      "signalType": string,
      "confidence": number (0.0–1.0),
      "urgency": "high" | "medium" | "low" | "none",
      "summary": string (one sentence, what this signal means for the user),
      "entities": {
        "amounts": [{ "value": number, "currency": string, "context": string }],
        "dates": [{ "raw": string, "context": string }],
        "vendors": string[],
        "commitments": string[],
        "deadlines": string[]
      }
    }
  ],
  "overallUrgency": "high" | "medium" | "low" | "none",
  "emailSummary": string (2-3 sentence plain English summary of what the email is about)
}

Rules:
- Only include signals with confidence >= 0.5
- confidence 0.9–1.0: explicit, unambiguous match
- confidence 0.7–0.89: strong contextual match
- confidence 0.5–0.69: probable but uncertain
- overallUrgency = highest urgency across all signals
- If no signals detected, return { "signals": [], "overallUrgency": "none", "emailSummary": "..." }`;

// ── Types ─────────────────────────────────────────────────────────────────────
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

// ── Main export ───────────────────────────────────────────────────────────────
export async function analyzeEmailSignals(
  subject: string,
  from: string,
  body: string,
  maxBodyChars = 3000,
): Promise<EmailSignalResult> {
  const truncatedBody = body.slice(0, maxBodyChars);

  const userPrompt = `Analyze this email for ValuePilot product signals:

FROM: ${from}
SUBJECT: ${subject}
BODY:
${truncatedBody}`;

  const result = await converse({
    modelId:      MODELS.SONNET,
    system:       SYSTEM_PROMPT,
    cacheSystem:  true,            // System prompt is stable — always cache it
    messages:     [{ role: 'user', content: userPrompt }],
    maxTokens:    1024,
    temperature:  0.1,             // Low temperature for consistent structured output
  });

  const parsed = parseJSON<EmailSignalResult>(result.text, {
    signals:        [],
    overallUrgency: 'none',
    emailSummary:   'Unable to analyze email.',
    inputTokens:    0,
    outputTokens:   0,
    cacheRead:      0,
  });

  return {
    ...parsed,
    inputTokens:  result.inputTokens,
    outputTokens: result.outputTokens,
    cacheRead:    result.cacheRead,
  };
}
