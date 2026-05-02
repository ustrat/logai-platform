import { converse, converseStream, parseJSON, MODELS } from './bedrockClient.js';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// ── Store ─────────────────────────────────────────────────────────────────────
const STORE_FILE = path.join(__dirname, '../../.escalate-ai-store.json');

type EscalationType = 'refund_dispute' | 'renewal_dispute' | 'billing_error' | 'service_failure' | 'contract_breach';
type EscalationStatus = 'open' | 'tier_1' | 'tier_2' | 'tier_3' | 'executive' | 'resolved' | 'withdrawn';
type EscalationOutcome = 'full_refund' | 'partial_refund' | 'credit' | 'contract_amendment' | 'renewal_waiver' | 'no_resolution';

const TIER_ORDER: EscalationStatus[] = ['open', 'tier_1', 'tier_2', 'tier_3', 'executive'];

export interface EscalationRecord {
  id:             string;
  type:           EscalationType;
  vendor:         string;
  description:    string;
  amountAtStake:  number;
  currency:       string;
  status:         EscalationStatus;
  currentTier:    number;
  triggeredBy:    'refundpilot' | 'renewalguard' | 'manual';
  history:        EscalationEvent[];
  drafts:         EscalationDraft[];
  outcome?:       EscalationOutcome;
  resolutionNote?: string;
  createdAt:      string;
  updatedAt:      string;
}

export interface EscalationEvent {
  timestamp:    string;
  fromStatus:   EscalationStatus;
  toStatus:     EscalationStatus;
  actor:        string;
  note:         string;
}

export interface EscalationDraft {
  id:        string;
  tier:      number;
  recipient: string;
  subject:   string;
  body:      string;
  generatedAt: string;
}

interface EscalationStore { escalations: EscalationRecord[] }

function loadStore(): EscalationStore {
  try { if (fs.existsSync(STORE_FILE)) return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')); }
  catch { /* ignore */ }
  return { escalations: [] };
}
function saveStore(s: EscalationStore) { fs.writeFileSync(STORE_FILE, JSON.stringify(s, null, 2)); }

// ── Bedrock system prompt — initiation ───────────────────────────────────────
const TRIAGE_PROMPT = `You are EscalateAI™ — ValuePilot's structured escalation workflow automation engine for refund and renewal disputes, integrated with RefundPilot™, RefundIQ™, and RenewalGuard™.

On intake, you assess the dispute and produce a structured escalation plan including:
1. Recommended starting escalation tier (1–3 or executive for critical cases)
2. Escalation rationale and success probability estimate
3. Key leverage points (contractual terms, SLA violations, regulatory obligations, vendor dependency)
4. Recommended timeline (how long to wait per tier before advancing)
5. The first escalation draft communication

You MUST respond with valid JSON only — no markdown, no text outside the JSON object.

Response format:
{
  "recommendedStartTier": number (1-3),
  "successProbability": number (0-100),
  "rationale": string,
  "leveragePoints": string[],
  "timelinePerTier": string (e.g. "Tier 1: 3 business days → Tier 2: 5 business days → Tier 3: executive"),
  "initialDraft": {
    "recipient": string (e.g. "Customer Support Team"),
    "subject": string,
    "body": string
  }
}`;

// ── Bedrock system prompt — tier draft ────────────────────────────────────────
const DRAFT_PROMPT = `You are EscalateAI™ — ValuePilot's structured escalation workflow automation engine.

You draft escalation communications calibrated to the current tier level:
- Tier 1: Customer support — polite, factual, solution-focused
- Tier 2: Manager/supervisor — firm, references prior unresolved contact, requests timeline
- Tier 3: Senior leadership/legal — formal, references contractual obligations, states consequences
- Executive: C-suite/CEO — concise, high-stakes, mutual business impact framing

You MUST respond with valid JSON only — no markdown, no text outside the JSON object.

Response format:
{
  "recipient": string,
  "subject": string,
  "body": string,
  "toneNote": string (brief note on tone/strategy used)
}`;

// ── Initiate escalation ───────────────────────────────────────────────────────
export interface EscalationInput {
  type:          EscalationType;
  vendor:        string;
  description:   string;
  amountAtStake: number;
  currency?:     string;
  triggeredBy:   'refundpilot' | 'renewalguard' | 'manual';
  actor:         string;
}

export async function initiateEscalation(
  input: EscalationInput,
): Promise<{ escalation: EscalationRecord; usage: object }> {
  const result = await converse({
    modelId:    MODELS.SONNET,
    system:     TRIAGE_PROMPT,
    cacheSystem: true,
    messages: [{
      role:    'user',
      content: `Initiate escalation for:\n\nType: ${input.type.replace(/_/g, ' ')}\nVendor: ${input.vendor}\nDescription: ${input.description}\nAmount at stake: ${input.amountAtStake} ${input.currency ?? 'USD'}\nTriggered by: ${input.triggeredBy}\nDate: ${new Date().toISOString()}`,
    }],
    maxTokens:   2048,
    temperature: 0.2,
  });

  const parsed = parseJSON<{
    recommendedStartTier: number;
    successProbability: number;
    rationale: string;
    leveragePoints: string[];
    timelinePerTier: string;
    initialDraft: { recipient: string; subject: string; body: string };
  }>(result.text, {
    recommendedStartTier: 1, successProbability: 50, rationale: '',
    leveragePoints: [], timelinePerTier: '', initialDraft: { recipient: 'Support', subject: 'Dispute', body: '' },
  });

  const now      = new Date().toISOString();
  const tierIdx  = Math.min(Math.max(parsed.recommendedStartTier - 1, 0), TIER_ORDER.length - 2);
  const status   = TIER_ORDER[tierIdx + 1] as EscalationStatus;

  const escalation: EscalationRecord = {
    id:            randomUUID(),
    type:          input.type,
    vendor:        input.vendor,
    description:   input.description,
    amountAtStake: input.amountAtStake,
    currency:      input.currency ?? 'USD',
    status,
    currentTier:   parsed.recommendedStartTier,
    triggeredBy:   input.triggeredBy,
    history: [{
      timestamp:  now,
      fromStatus: 'open',
      toStatus:   status,
      actor:      input.actor,
      note:       `Escalation initiated. ${parsed.rationale}`,
    }],
    drafts: [{
      id:          randomUUID(),
      tier:        parsed.recommendedStartTier,
      recipient:   parsed.initialDraft.recipient,
      subject:     parsed.initialDraft.subject,
      body:        parsed.initialDraft.body,
      generatedAt: now,
    }],
    createdAt: now,
    updatedAt: now,
  };

  const store = loadStore();
  store.escalations.push(escalation);
  saveStore(store);

  return {
    escalation,
    usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens, cacheRead: result.cacheRead, cacheWrite: result.cacheWrite },
  };
}

// ── Advance to next tier ──────────────────────────────────────────────────────
export function advanceTier(id: string, actor: string, note: string): EscalationRecord | null {
  const store = loadStore();
  const e     = store.escalations.find(x => x.id === id);
  if (!e || e.status === 'resolved' || e.status === 'executive') return null;

  const currentIdx = TIER_ORDER.indexOf(e.status);
  const nextStatus = TIER_ORDER[currentIdx + 1] as EscalationStatus;

  e.history.push({
    timestamp: new Date().toISOString(),
    fromStatus: e.status,
    toStatus: nextStatus,
    actor,
    note,
  });
  e.status      = nextStatus;
  e.currentTier = e.currentTier + 1;
  e.updatedAt   = new Date().toISOString();
  saveStore(store);
  return e;
}

// ── Draft communication for current tier ──────────────────────────────────────
export async function draftEscalationCommunication(
  id: string,
): Promise<{ draft: EscalationDraft; usage: object } | null> {
  const store = loadStore();
  const e     = store.escalations.find(x => x.id === id);
  if (!e) return null;

  const tierLabel = e.status.replace('_', ' ').toUpperCase();

  const result = await converse({
    modelId:    MODELS.SONNET,
    system:     DRAFT_PROMPT,
    cacheSystem: true,
    messages: [{
      role:    'user',
      content: `Draft a ${tierLabel} escalation communication:\n\nVendor: ${e.vendor}\nType: ${e.type.replace(/_/g, ' ')}\nAmount at stake: ${e.amountAtStake} ${e.currency}\nDescription: ${e.description}\nCurrent tier: ${e.currentTier}\nEscalation history:\n${e.history.map(h => `- ${h.toStatus}: ${h.note}`).join('\n')}`,
    }],
    maxTokens:   1536,
    temperature: 0.3,
  });

  const parsed = parseJSON<{ recipient: string; subject: string; body: string; toneNote: string }>(
    result.text,
    { recipient: 'Vendor', subject: 'Escalation', body: '', toneNote: '' },
  );

  const draft: EscalationDraft = {
    id:          randomUUID(),
    tier:        e.currentTier,
    recipient:   parsed.recipient,
    subject:     parsed.subject,
    body:        parsed.body,
    generatedAt: new Date().toISOString(),
  };

  e.drafts.push(draft);
  e.updatedAt = new Date().toISOString();
  saveStore(store);

  return {
    draft,
    usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens, cacheRead: result.cacheRead, cacheWrite: result.cacheWrite },
  };
}

// ── Resolve escalation ────────────────────────────────────────────────────────
export function resolveEscalation(id: string, outcome: EscalationOutcome, note: string, actor: string): EscalationRecord | null {
  const store = loadStore();
  const e     = store.escalations.find(x => x.id === id);
  if (!e) return null;
  e.history.push({ timestamp: new Date().toISOString(), fromStatus: e.status, toStatus: 'resolved', actor, note });
  e.status         = 'resolved';
  e.outcome        = outcome;
  e.resolutionNote = note;
  e.updatedAt      = new Date().toISOString();
  saveStore(store);
  return e;
}

export function listEscalations(): EscalationRecord[] {
  return loadStore().escalations;
}

export function getEscalation(id: string): EscalationRecord | undefined {
  return loadStore().escalations.find(e => e.id === id);
}
