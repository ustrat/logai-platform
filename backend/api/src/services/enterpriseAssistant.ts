import { converse, converseStream, parseJSON, MODELS } from './bedrockClient.js';

// ── System prompt — cached ────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are ValuePilot's enterprise sales assistant. You help sales personnel with:
1. Order and pipeline summaries
2. Pricing strategy and discount guidance
3. Customer communication drafting
4. Competitive positioning
5. Renewal risk assessment

## ValuePilot Product Catalog

| Product | Focus | Typical Seat Price (annual) |
|---|---|---|
| RenewalGuard™ | SaaS renewal tracking | $120–$180/seat |
| RefundPilot™ | Refund & dispute management | $100–$150/seat |
| FollowUp™ / CommitmentIQ™ | Commitment extraction & tracking | $90–$130/seat |
| LeakageIndex™ | Spend leakage & shadow IT | $110–$160/seat |
| EnterprisePilot™ | Enterprise SaaS lifecycle | $150–$220/seat |
| DrivePilot™ | Fleet & vehicle expense intelligence | $80–$120/seat |
| BoarderPilot™ | Cross-border payment intelligence | $130–$200/seat |

## Pricing Guidelines
- 1–499 seats: list price
- 500–1999 seats: up to 15% discount
- 2000–4999 seats: up to 25% discount
- 5000+ seats: up to 35% discount (requires finance approval)
- Multi-product bundle (3+ products): additional 10% off
- Federal government: standard GS-schedule pricing applies, max 20% off list
- Annual commitment: standard; multi-year (2-3yr): additional 5-8% off

## Approval Thresholds
- Up to $50K: sales rep can approve
- $50K–$250K: sales manager approval required
- $250K+: finance approval required

## Order Status Definitions
- draft → submitted → pending_finance → approved → invoiced → paid

Be professional, concise, and specific. When drafting emails, match the tone to the customer type (federal = formal, commercial = professional-friendly).`;

// ── Types ─────────────────────────────────────────────────────────────────────
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
  task:        AssistantTask;
  context:     Record<string, any>;   // order, customer, pipeline data etc.
  instruction?: string;               // additional freeform instruction
}

export interface AssistantResponse {
  content:      string;
  inputTokens:  number;
  outputTokens: number;
  cacheRead:    number;
}

// ── Task-specific prompt builders ─────────────────────────────────────────────
function buildPrompt(req: AssistantRequest): string {
  const { task, context, instruction } = req;

  switch (task) {
    case 'summarize_order':
      return `Summarize this enterprise order for an internal sales review. Be concise — cover customer, products, total value, status, and any risk flags.

ORDER DATA:
${JSON.stringify(context, null, 2)}

${instruction ?? ''}`;

    case 'pricing_guidance':
      return `Provide pricing guidance for this opportunity. Recommend the optimal discount strategy, flag if approval thresholds are triggered, and suggest any bundle opportunities.

OPPORTUNITY:
${JSON.stringify(context, null, 2)}

${instruction ?? ''}`;

    case 'draft_proposal_email':
      return `Draft a professional proposal email to send to this customer introducing our solution and the proposed deal terms.

CUSTOMER & ORDER CONTEXT:
${JSON.stringify(context, null, 2)}

${instruction ?? 'Keep the email under 300 words. Include subject line.'}`;

    case 'draft_follow_up_email':
      return `Draft a follow-up email for this customer. The tone should be warm but professional — move the deal forward without being pushy.

CONTEXT:
${JSON.stringify(context, null, 2)}

${instruction ?? 'Keep the email under 200 words. Include subject line.'}`;

    case 'draft_invoice_cover_email':
      return `Draft the email to accompany this invoice. Professional tone, include payment terms and instructions, and a friendly next-steps note.

INVOICE & CUSTOMER CONTEXT:
${JSON.stringify(context, null, 2)}

${instruction ?? 'Keep the email under 150 words. Include subject line.'}`;

    case 'renewal_risk':
      return `Assess the renewal risk for this customer based on order history and account data. Provide a risk score (high/medium/low), reasoning, and recommended retention actions.

ACCOUNT DATA:
${JSON.stringify(context, null, 2)}

${instruction ?? ''}`;

    case 'pipeline_summary':
      return `Summarize this sales pipeline. Highlight total pipeline value, deals at risk, deals needing immediate action, and this week's priorities.

PIPELINE DATA:
${JSON.stringify(context, null, 2)}

${instruction ?? ''}`;

    case 'freeform':
    default:
      return `${instruction ?? 'Assist with the following context:'}

CONTEXT:
${JSON.stringify(context, null, 2)}`;
  }
}

// ── Non-streaming response ────────────────────────────────────────────────────
export async function assist(req: AssistantRequest): Promise<AssistantResponse> {
  const result = await converse({
    modelId:     MODELS.SONNET,
    system:      SYSTEM_PROMPT,
    cacheSystem: true,
    messages:    [{ role: 'user', content: buildPrompt(req) }],
    maxTokens:   2048,
    temperature: 0.4,
  });

  return {
    content:      result.text,
    inputTokens:  result.inputTokens,
    outputTokens: result.outputTokens,
    cacheRead:    result.cacheRead,
  };
}

// ── Streaming response — for real-time UI (Server-Sent Events) ────────────────
export async function* assistStream(req: AssistantRequest): AsyncGenerator<string> {
  yield* converseStream({
    modelId:     MODELS.SONNET,
    system:      SYSTEM_PROMPT,
    cacheSystem: true,
    messages:    [{ role: 'user', content: buildPrompt(req) }],
    maxTokens:   2048,
    temperature: 0.4,
  });
}
