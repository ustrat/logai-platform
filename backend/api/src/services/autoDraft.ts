import { converse, converseStream, parseJSON, MODELS } from './bedrockClient.js';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// ── Store ─────────────────────────────────────────────────────────────────────
const STORE_FILE = path.join(__dirname, '../../.auto-draft-store.json');

type DraftTone = 'professional' | 'assertive' | 'conciliatory' | 'urgent' | 'friendly';
type DraftType = 'follow_up' | 'commitment_reminder' | 'escalation' | 'acknowledgement' | 'proposal';

export interface DraftRecord {
  id:          string;
  type:        DraftType;
  tone:        DraftTone;
  context:     string;
  recipient:   string;
  subject:     string;
  body:        string;
  refinements: number;
  createdAt:   string;
  updatedAt:   string;
}

interface DraftStore {
  drafts: DraftRecord[];
}

function loadStore(): DraftStore {
  try {
    if (fs.existsSync(STORE_FILE)) return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch { /* ignore */ }
  return { drafts: [] };
}

function saveStore(s: DraftStore): void {
  fs.writeFileSync(STORE_FILE, JSON.stringify(s, null, 2));
}

// ── Bedrock system prompt ─────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are AutoDraft™ — ValuePilot's automated response drafting module, integrated with FollowUp™ and CommitmentIQ™.

You produce polished, professional business communications for follow-ups, commitment reminders, and structured correspondence. Your drafts are:
- Concise and action-oriented (never verbose)
- Calibrated to the specified tone and recipient relationship
- Rooted in the specific commitment or context provided
- Formatted as a complete, ready-to-send email

You MUST respond with valid JSON only — no markdown, no text outside the JSON object.

Response format:
{
  "subject": string (email subject line),
  "body": string (complete email body, use \\n for line breaks),
  "toneJustification": string (brief explanation of tone choices made),
  "keyPoints": string[] (2-4 main points the email communicates),
  "callToAction": string (the specific action requested of the recipient),
  "alternativePhrasing": string (1 alternative opening sentence if current feels too direct)
}`;

export interface DraftRequest {
  type:           DraftType;
  tone:           DraftTone;
  context:        string;
  recipient:      string;
  recipientRole?: string;
  senderName:     string;
  commitmentText?: string;
  deadline?:      string;
  previousResponse?: string;
}

export interface DraftResult {
  draft: DraftRecord;
  keyPoints:           string[];
  callToAction:        string;
  toneJustification:   string;
  alternativePhrasing: string;
  usage: { inputTokens: number; outputTokens: number; cacheRead: number; cacheWrite: number };
}

// ── Generate draft ────────────────────────────────────────────────────────────
export async function generateDraft(req: DraftRequest): Promise<DraftResult> {
  const userMsg = [
    `Draft Type: ${req.type.replace(/_/g, ' ')}`,
    `Tone: ${req.tone}`,
    `Recipient: ${req.recipient}${req.recipientRole ? ` (${req.recipientRole})` : ''}`,
    `Sender: ${req.senderName}`,
    `Context: ${req.context}`,
    req.commitmentText ? `Commitment to follow up on: ${req.commitmentText}` : '',
    req.deadline       ? `Deadline: ${req.deadline}` : '',
    req.previousResponse ? `Previous response from recipient: ${req.previousResponse}` : '',
  ].filter(Boolean).join('\n');

  const result = await converse({
    modelId:    MODELS.SONNET,
    system:     SYSTEM_PROMPT,
    cacheSystem: true,
    messages:   [{ role: 'user', content: userMsg }],
    maxTokens:  1536,
    temperature: 0.4,
  });

  const parsed = parseJSON<{
    subject: string; body: string; toneJustification: string;
    keyPoints: string[]; callToAction: string; alternativePhrasing: string;
  }>(result.text, {
    subject: 'Follow-Up', body: 'Unable to generate draft at this time.',
    toneJustification: '', keyPoints: [], callToAction: '', alternativePhrasing: '',
  });

  const store = loadStore();
  const now   = new Date().toISOString();
  const draft: DraftRecord = {
    id:         randomUUID(),
    type:       req.type,
    tone:       req.tone,
    context:    req.context,
    recipient:  req.recipient,
    subject:    parsed.subject,
    body:       parsed.body,
    refinements: 0,
    createdAt:  now,
    updatedAt:  now,
  };
  store.drafts.push(draft);
  saveStore(store);

  return {
    draft,
    keyPoints:           parsed.keyPoints,
    callToAction:        parsed.callToAction,
    toneJustification:   parsed.toneJustification,
    alternativePhrasing: parsed.alternativePhrasing,
    usage: {
      inputTokens:  result.inputTokens,
      outputTokens: result.outputTokens,
      cacheRead:    result.cacheRead,
      cacheWrite:   result.cacheWrite,
    },
  };
}

// ── Refine existing draft ─────────────────────────────────────────────────────
export async function refineDraft(draftId: string, feedback: string): Promise<DraftResult> {
  const store = loadStore();
  const existing = store.drafts.find(d => d.id === draftId);
  if (!existing) throw new Error(`Draft ${draftId} not found`);

  const result = await converse({
    modelId:    MODELS.SONNET,
    system:     SYSTEM_PROMPT,
    cacheSystem: true,
    messages: [
      {
        role:    'user',
        content: `Refine this draft based on the feedback provided.\n\nOriginal draft:\nSubject: ${existing.subject}\n\n${existing.body}\n\nFeedback: ${feedback}`,
      },
    ],
    maxTokens:   1536,
    temperature: 0.4,
  });

  const parsed = parseJSON<{
    subject: string; body: string; toneJustification: string;
    keyPoints: string[]; callToAction: string; alternativePhrasing: string;
  }>(result.text, {
    subject: existing.subject, body: existing.body,
    toneJustification: '', keyPoints: [], callToAction: '', alternativePhrasing: '',
  });

  const now  = new Date().toISOString();
  existing.subject    = parsed.subject;
  existing.body       = parsed.body;
  existing.refinements += 1;
  existing.updatedAt  = now;
  saveStore(store);

  return {
    draft: existing,
    keyPoints:           parsed.keyPoints,
    callToAction:        parsed.callToAction,
    toneJustification:   parsed.toneJustification,
    alternativePhrasing: parsed.alternativePhrasing,
    usage: {
      inputTokens:  result.inputTokens,
      outputTokens: result.outputTokens,
      cacheRead:    result.cacheRead,
      cacheWrite:   result.cacheWrite,
    },
  };
}

export function listDrafts(): DraftRecord[] {
  return loadStore().drafts;
}
