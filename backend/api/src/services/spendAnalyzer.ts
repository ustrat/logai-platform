import { converse, parseJSON, MODELS } from './bedrockClient.js';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// ── Store ─────────────────────────────────────────────────────────────────────
const STORE_FILE = path.join(__dirname, '../../.spend-analyzer-store.json');

export interface SpendRecord {
  vendor:      string;
  amount:      number;
  currency:    string;
  category?:   string;
  department?: string;
  date:        string;
  invoiceRef?: string;
}

export interface SpendCluster {
  id:             string;
  label:          string;
  category:       string;
  vendors:        string[];
  totalSpend:     number;
  avgMonthly:     number;
  recordCount:    number;
  analysisDate:   string;
}

export interface SpendReport {
  id:               string;
  analysisDate:     string;
  totalSpend:       number;
  currency:         string;
  clusters:         SpendCluster[];
  topVendors:       Array<{ vendor: string; total: number; pct: number }>;
  redundancies:     Array<{ category: string; vendors: string[]; potentialSaving: number; recommendation: string }>;
  budgetAnomalies:  Array<{ vendor: string; amount: number; reason: string; severity: 'high'|'medium'|'low' }>;
  insights:         string[];
  optimizationScore: number;
}

interface SpendStore { reports: SpendReport[] }

function loadStore(): SpendStore {
  try { if (fs.existsSync(STORE_FILE)) return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')); }
  catch { /* ignore */ }
  return { reports: [] };
}
function saveStore(s: SpendStore) { fs.writeFileSync(STORE_FILE, JSON.stringify(s, null, 2)); }

// ── Bedrock system prompt ─────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are SpendAnalyzer™ — ValuePilot's enterprise SaaS spend clustering and categorization intelligence engine, integrated with EnterprisePilot™.

You analyze enterprise procurement records and vendor invoices to:
1. Cluster spending into meaningful business categories (Software, Cloud Infrastructure, Professional Services, Compliance, Marketing Tech, etc.)
2. Identify vendor redundancies and consolidation opportunities
3. Surface budget anomalies and unexpected spend spikes
4. Calculate optimization potential and provide ranked recommendations
5. Score the organization's spend optimization maturity (0–100)

You MUST respond with valid JSON only — no markdown, no text outside the JSON object.

Response format:
{
  "clusters": [
    {
      "label": string (descriptive cluster name),
      "category": string (standardized category),
      "vendors": string[],
      "totalSpend": number,
      "avgMonthly": number,
      "insight": string
    }
  ],
  "topVendors": [
    { "vendor": string, "total": number, "pct": number }
  ],
  "redundancies": [
    {
      "category": string,
      "vendors": string[],
      "potentialSaving": number,
      "recommendation": string
    }
  ],
  "budgetAnomalies": [
    {
      "vendor": string,
      "amount": number,
      "reason": string,
      "severity": "high" | "medium" | "low"
    }
  ],
  "insights": string[] (4-6 executive-level bullets),
  "optimizationScore": number (0-100)
}`;

// ── Analyze spend ─────────────────────────────────────────────────────────────
export async function analyzeSpend(
  records: SpendRecord[],
  currency = 'USD',
): Promise<{ report: SpendReport; usage: object }> {
  const totalSpend = records.reduce((s, r) => s + r.amount, 0);

  const result = await converse({
    modelId:    MODELS.SONNET,
    system:     SYSTEM_PROMPT,
    cacheSystem: true,
    messages: [{
      role:    'user',
      content: `Analyze this enterprise spend data and produce clustering + optimization intelligence:\n\nTotal records: ${records.length}\nTotal spend: ${totalSpend.toFixed(2)} ${currency}\n\nRecords:\n${JSON.stringify(records, null, 2)}`,
    }],
    maxTokens:   3072,
    temperature: 0.1,
  });

  const parsed = parseJSON<{
    clusters: Array<{ label: string; category: string; vendors: string[]; totalSpend: number; avgMonthly: number; insight: string }>;
    topVendors: Array<{ vendor: string; total: number; pct: number }>;
    redundancies: Array<{ category: string; vendors: string[]; potentialSaving: number; recommendation: string }>;
    budgetAnomalies: Array<{ vendor: string; amount: number; reason: string; severity: 'high'|'medium'|'low' }>;
    insights: string[];
    optimizationScore: number;
  }>(result.text, {
    clusters: [], topVendors: [], redundancies: [],
    budgetAnomalies: [], insights: [], optimizationScore: 0,
  });

  const now    = new Date().toISOString();
  const report: SpendReport = {
    id:               randomUUID(),
    analysisDate:     now,
    totalSpend,
    currency,
    clusters:         parsed.clusters.map(c => ({ ...c, id: randomUUID(), recordCount: records.filter(r => c.vendors.includes(r.vendor)).length, analysisDate: now })),
    topVendors:       parsed.topVendors,
    redundancies:     parsed.redundancies,
    budgetAnomalies:  parsed.budgetAnomalies,
    insights:         parsed.insights,
    optimizationScore: parsed.optimizationScore,
  };

  const store = loadStore();
  store.reports.push(report);
  saveStore(store);

  return {
    report,
    usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens, cacheRead: result.cacheRead, cacheWrite: result.cacheWrite },
  };
}

export function listReports(): SpendReport[] {
  return loadStore().reports;
}

export function getReport(id: string): SpendReport | undefined {
  return loadStore().reports.find(r => r.id === id);
}
