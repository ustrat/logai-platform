import { converse, parseJSON, MODELS } from './bedrockClient.js';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// ── File-based store (consistent with existing pattern) ───────────────────────
const STORE_FILE = path.join(__dirname, '../../.smart-reminder-store.json');

type ReminderStatus = 'active' | 'snoozed' | 'dismissed' | 'completed';
type ReminderPriority = 'critical' | 'high' | 'medium' | 'low';
type EngagementChannel = 'email' | 'in_app' | 'sms';

export interface Commitment {
  text:        string;
  counterparty: string;
  dueDate?:    string;
  context?:    string;
}

export interface ReminderSchedule {
  id:               string;
  commitmentId:     string;
  commitment:       string;
  counterparty:     string;
  priority:         ReminderPriority;
  status:           ReminderStatus;
  nextReminderAt:   string;
  cadence:          string;
  channel:          EngagementChannel;
  snoozeUntil?:     string;
  rationale:        string;
  suggestedMessage: string;
  createdAt:        string;
  updatedAt:        string;
}

interface ReminderStore {
  reminders: ReminderSchedule[];
}

function loadStore(): ReminderStore {
  try {
    if (fs.existsSync(STORE_FILE)) {
      return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    }
  } catch { /* ignore */ }
  return { reminders: [] };
}

function saveStore(store: ReminderStore): void {
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

// ── Bedrock system prompt ─────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are SmartReminder™ — ValuePilot's AI-prioritized reminder calibration engine integrated with FollowUp™ and CommitmentIQ™.

Your role is to analyze extracted commitments and obligations from business communications, then determine the optimal follow-up timing, engagement cadence, and channel strategy to maximize response rates and commitment fulfillment.

You consider:
- Commitment urgency and financial impact
- Counterparty relationship tier (executive, peer, vendor, client)
- Historical engagement patterns and typical response windows
- Business day calendars and optimal outreach windows
- Escalation triggers (e.g. if no response within X days)

You MUST respond with valid JSON only — no markdown, no text outside the JSON object.

Response format:
{
  "reminders": [
    {
      "commitmentId": string,
      "priority": "critical" | "high" | "medium" | "low",
      "rationale": string (why this priority),
      "nextReminderAt": string (ISO 8601 datetime),
      "cadence": string (e.g. "Every 2 business days for 10 days, then weekly"),
      "channel": "email" | "in_app" | "sms",
      "suggestedMessage": string (ready-to-send follow-up message, professional tone),
      "escalationTrigger": string (e.g. "Escalate to manager if no response in 5 days")
    }
  ],
  "overallInsight": string (summary of commitment landscape and follow-up strategy)
}`;

// ── Types ─────────────────────────────────────────────────────────────────────
interface ReminderAnalysis {
  reminders: Array<{
    commitmentId:       string;
    priority:           ReminderPriority;
    rationale:          string;
    nextReminderAt:     string;
    cadence:            string;
    channel:            EngagementChannel;
    suggestedMessage:   string;
    escalationTrigger:  string;
  }>;
  overallInsight: string;
}

export interface SmartReminderResult {
  schedules:      ReminderSchedule[];
  overallInsight: string;
  usage:          { inputTokens: number; outputTokens: number; cacheRead: number; cacheWrite: number };
}

// ── Core analysis function ────────────────────────────────────────────────────
export async function analyzeCommitments(
  commitments: Commitment[],
  userId: string,
): Promise<SmartReminderResult> {
  const payload = commitments.map((c, i) => ({
    commitmentId: `c-${i + 1}`,
    ...c,
  }));

  const result = await converse({
    modelId:    MODELS.SONNET,
    system:     SYSTEM_PROMPT,
    cacheSystem: true,
    messages: [{
      role:    'user',
      content: `Analyze these commitments and generate optimized reminder schedules:\n\n${JSON.stringify(payload, null, 2)}\n\nToday's date: ${new Date().toISOString()}`,
    }],
    maxTokens:   2048,
    temperature: 0.2,
  });

  const analysis = parseJSON<ReminderAnalysis>(result.text, {
    reminders:      [],
    overallInsight: 'Unable to analyze commitments at this time.',
  });

  const store = loadStore();
  const now   = new Date().toISOString();

  const schedules: ReminderSchedule[] = analysis.reminders.map((r, i) => {
    const schedule: ReminderSchedule = {
      id:               randomUUID(),
      commitmentId:     r.commitmentId,
      commitment:       commitments[i]?.text ?? '',
      counterparty:     commitments[i]?.counterparty ?? '',
      priority:         r.priority,
      status:           'active',
      nextReminderAt:   r.nextReminderAt,
      cadence:          r.cadence,
      channel:          r.channel,
      rationale:        r.rationale,
      suggestedMessage: r.suggestedMessage,
      createdAt:        now,
      updatedAt:        now,
    };
    store.reminders.push(schedule);
    return schedule;
  });

  saveStore(store);

  return {
    schedules,
    overallInsight: analysis.overallInsight,
    usage: {
      inputTokens:  result.inputTokens,
      outputTokens: result.outputTokens,
      cacheRead:    result.cacheRead,
      cacheWrite:   result.cacheWrite,
    },
  };
}

export function listReminders(): ReminderSchedule[] {
  return loadStore().reminders;
}

export function dismissReminder(id: string): boolean {
  const store = loadStore();
  const idx   = store.reminders.findIndex(r => r.id === id);
  if (idx === -1) return false;
  store.reminders[idx].status    = 'dismissed';
  store.reminders[idx].updatedAt = new Date().toISOString();
  saveStore(store);
  return true;
}

export function snoozeReminder(id: string, until: string): boolean {
  const store = loadStore();
  const idx   = store.reminders.findIndex(r => r.id === id);
  if (idx === -1) return false;
  store.reminders[idx].status      = 'snoozed';
  store.reminders[idx].snoozeUntil = until;
  store.reminders[idx].updatedAt   = new Date().toISOString();
  saveStore(store);
  return true;
}
