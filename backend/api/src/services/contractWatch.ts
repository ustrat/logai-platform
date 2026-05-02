import { converse, parseJSON, MODELS } from './bedrockClient.js';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// ── Store ─────────────────────────────────────────────────────────────────────
const STORE_FILE = path.join(__dirname, '../../.contract-watch-store.json');

type ContractStatus  = 'active' | 'expiring_soon' | 'expired' | 'in_renewal' | 'terminated';
type ContractRisk    = 'critical' | 'high' | 'medium' | 'low';

export interface MonitoredContract {
  id:                 string;
  vendor:             string;
  description:        string;
  value:              number;
  currency:           string;
  startDate:          string;
  endDate:            string;
  autoRenew:          boolean;
  noticePeriodDays:   number;
  status:             ContractStatus;
  riskLevel:          ContractRisk;
  daysUntilExpiry:    number;
  renewalDeadline:    string;
  triggers:           ContractTrigger[];
  recommendation:     string;
  createdAt:          string;
  updatedAt:          string;
}

export interface ContractTrigger {
  type:        'renewal_deadline' | 'notice_period' | 'expiry' | 'auto_renew' | 'price_escalation' | 'milestone';
  description: string;
  triggerDate: string;
  urgency:     'immediate' | 'soon' | 'upcoming';
  action:      string;
}

interface ContractStore { contracts: MonitoredContract[] }

function loadStore(): ContractStore {
  try { if (fs.existsSync(STORE_FILE)) return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')); }
  catch { /* ignore */ }
  return { contracts: [] };
}
function saveStore(s: ContractStore) { fs.writeFileSync(STORE_FILE, JSON.stringify(s, null, 2)); }

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}
function renewalDeadline(endDate: string, noticeDays: number): string {
  const d = new Date(endDate);
  d.setDate(d.getDate() - noticeDays);
  return d.toISOString();
}

// ── Bedrock system prompt ─────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are ContractWatch™ — ValuePilot's contract lifecycle monitoring and renewal trigger detection engine, integrated with EnterprisePilot™.

You analyze enterprise contracts and produce:
1. Risk-stratified contract assessments (considering notice periods, auto-renewal clauses, value at stake)
2. Lifecycle trigger events with precise action windows
3. Renewal strategy recommendations (renegotiate, consolidate, terminate, continue)
4. Price escalation and compliance milestone detection

You MUST respond with valid JSON only — no markdown, no text outside the JSON object.

Response format:
{
  "riskLevel": "critical" | "high" | "medium" | "low",
  "status": "active" | "expiring_soon" | "expired" | "in_renewal" | "terminated",
  "triggers": [
    {
      "type": "renewal_deadline" | "notice_period" | "expiry" | "auto_renew" | "price_escalation" | "milestone",
      "description": string,
      "triggerDate": string (ISO 8601),
      "urgency": "immediate" | "soon" | "upcoming",
      "action": string (specific recommended action)
    }
  ],
  "recommendation": string (strategic recommendation for this contract)
}`;

// ── Monitor contract ──────────────────────────────────────────────────────────
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

export async function monitorContract(
  input: ContractInput,
): Promise<{ contract: MonitoredContract; usage: object }> {
  const days   = daysUntil(input.endDate);
  const rdl    = renewalDeadline(input.endDate, input.noticePeriodDays);
  const daysToRdl = daysUntil(rdl);

  const result = await converse({
    modelId:    MODELS.SONNET,
    system:     SYSTEM_PROMPT,
    cacheSystem: true,
    messages: [{
      role:    'user',
      content: `Analyze this contract and generate lifecycle triggers:\n\nVendor: ${input.vendor}\nDescription: ${input.description}\nValue: ${input.value} ${input.currency ?? 'USD'}\nStart: ${input.startDate}\nEnd: ${input.endDate}\nAuto-renew: ${input.autoRenew}\nNotice period: ${input.noticePeriodDays} days\nDays until expiry: ${days}\nRenewal action deadline: ${rdl} (${daysToRdl} days away)\nToday: ${new Date().toISOString()}`,
    }],
    maxTokens:   1024,
    temperature: 0.1,
  });

  const parsed = parseJSON<{
    riskLevel: ContractRisk; status: ContractStatus;
    triggers: ContractTrigger[]; recommendation: string;
  }>(result.text, {
    riskLevel: 'medium', status: 'active', triggers: [], recommendation: 'Monitor contract for upcoming renewal.',
  });

  const now = new Date().toISOString();
  const contract: MonitoredContract = {
    id:               randomUUID(),
    vendor:           input.vendor,
    description:      input.description,
    value:            input.value,
    currency:         input.currency ?? 'USD',
    startDate:        input.startDate,
    endDate:          input.endDate,
    autoRenew:        input.autoRenew,
    noticePeriodDays: input.noticePeriodDays,
    status:           parsed.status,
    riskLevel:        parsed.riskLevel,
    daysUntilExpiry:  days,
    renewalDeadline:  rdl,
    triggers:         parsed.triggers,
    recommendation:   parsed.recommendation,
    createdAt:        now,
    updatedAt:        now,
  };

  const store = loadStore();
  store.contracts.push(contract);
  saveStore(store);

  return {
    contract,
    usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens, cacheRead: result.cacheRead, cacheWrite: result.cacheWrite },
  };
}

export function listContracts(): MonitoredContract[] {
  return loadStore().contracts.map(c => ({
    ...c,
    daysUntilExpiry: daysUntil(c.endDate),
  }));
}

export function getContract(id: string): MonitoredContract | undefined {
  const c = loadStore().contracts.find(c => c.id === id);
  return c ? { ...c, daysUntilExpiry: daysUntil(c.endDate) } : undefined;
}

// ── Re-analyze all contracts for fresh triggers ───────────────────────────────
export async function refreshAllContracts(): Promise<MonitoredContract[]> {
  const store = loadStore();
  const updated: MonitoredContract[] = [];

  for (const c of store.contracts) {
    if (c.status === 'terminated' || c.status === 'expired') { updated.push(c); continue; }
    const { contract } = await monitorContract({
      vendor: c.vendor, description: c.description, value: c.value,
      currency: c.currency, startDate: c.startDate, endDate: c.endDate,
      autoRenew: c.autoRenew, noticePeriodDays: c.noticePeriodDays,
    });
    // Replace with refreshed version
    const idx = store.contracts.findIndex(x => x.id === c.id);
    if (idx !== -1) store.contracts[idx] = { ...contract, id: c.id, createdAt: c.createdAt };
    updated.push(store.contracts[idx]);
  }

  saveStore(store);
  return updated;
}
