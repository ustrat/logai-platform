import { converse, parseJSON, MODELS } from './bedrockClient.js';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// ── Store ─────────────────────────────────────────────────────────────────────
const STORE_FILE = path.join(__dirname, '../../.currency-guard-store.json');

export interface FxTransaction {
  id?:             string;
  vendor:          string;
  sourceCurrency:  string;
  targetCurrency:  string;
  sourceAmount:    number;
  targetAmount:    number;
  appliedRate:     number;
  transactionDate: string;
  channel?:        string;
  invoiceRef?:     string;
}

export interface FxInefficiency {
  transactionId:    string;
  vendor:           string;
  currencyPair:     string;
  appliedRate:      number;
  marketRate:       number;
  spread:           number;
  spreadPct:        number;
  lossAmount:       number;
  lossAmountUSD:    number;
  severity:         'critical' | 'high' | 'medium' | 'low';
  recommendation:   string;
}

export interface CurrencyGuardReport {
  id:                  string;
  analysisDate:        string;
  transactionCount:    number;
  totalLossUSD:        number;
  avgSpreadPct:        number;
  currencyPairsAnalyzed: string[];
  inefficiencies:      FxInefficiency[];
  normalizationMap:    Record<string, number>;
  insights:            string[];
  optimizationActions: Array<{ action: string; potentialSavingUSD: number; priority: 'high'|'medium'|'low' }>;
}

interface FxStore { reports: CurrencyGuardReport[] }

function loadStore(): FxStore {
  try { if (fs.existsSync(STORE_FILE)) return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')); }
  catch { /* ignore */ }
  return { reports: [] };
}
function saveStore(s: FxStore) { fs.writeFileSync(STORE_FILE, JSON.stringify(s, null, 2)); }

// ── Bedrock system prompt ─────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are CurrencyGuard™ — ValuePilot's foreign exchange inefficiency detection and normalization intelligence engine, integrated with BoarderPilot™ and DrivePilot™.

You analyze cross-border payment transactions to:
1. Detect unfavorable exchange rate spreads vs. mid-market rates
2. Identify unnecessary double-conversion inefficiencies
3. Quantify FX losses in USD terms
4. Recommend optimal currency routing and payment timing strategies
5. Produce a normalization map (target currency → USD equivalent at fair rate)

Assume mid-market rates are the fair benchmark. Spreads above 1% are concerning, above 2.5% are high, above 4% are critical.

You MUST respond with valid JSON only — no markdown, no text outside the JSON object.

Response format:
{
  "inefficiencies": [
    {
      "transactionId": string,
      "vendor": string,
      "currencyPair": string (e.g. "GBP/USD"),
      "appliedRate": number,
      "marketRate": number (estimated mid-market),
      "spread": number (appliedRate - marketRate),
      "spreadPct": number (spread as % of marketRate),
      "lossAmount": number (in source currency),
      "lossAmountUSD": number,
      "severity": "critical" | "high" | "medium" | "low",
      "recommendation": string
    }
  ],
  "normalizationMap": { "CURRENCY_CODE": number_usd_rate },
  "insights": string[] (4-6 key FX observations),
  "optimizationActions": [
    {
      "action": string,
      "potentialSavingUSD": number,
      "priority": "high" | "medium" | "low"
    }
  ]
}`;

// ── Analyze FX transactions ───────────────────────────────────────────────────
export async function analyzeFxTransactions(
  transactions: FxTransaction[],
): Promise<{ report: CurrencyGuardReport; usage: object }> {
  const tagged = transactions.map(t => ({ ...t, id: t.id ?? randomUUID() }));

  const result = await converse({
    modelId:    MODELS.SONNET,
    system:     SYSTEM_PROMPT,
    cacheSystem: true,
    messages: [{
      role:    'user',
      content: `Analyze these cross-border transactions for FX inefficiencies:\n\nTransaction count: ${tagged.length}\n\n${JSON.stringify(tagged, null, 2)}\n\nAnalysis date: ${new Date().toISOString()}`,
    }],
    maxTokens:   2048,
    temperature: 0.1,
  });

  const parsed = parseJSON<{
    inefficiencies: FxInefficiency[];
    normalizationMap: Record<string, number>;
    insights: string[];
    optimizationActions: Array<{ action: string; potentialSavingUSD: number; priority: 'high'|'medium'|'low' }>;
  }>(result.text, { inefficiencies: [], normalizationMap: {}, insights: [], optimizationActions: [] });

  const totalLoss  = parsed.inefficiencies.reduce((s, i) => s + i.lossAmountUSD, 0);
  const avgSpread  = parsed.inefficiencies.length
    ? parsed.inefficiencies.reduce((s, i) => s + i.spreadPct, 0) / parsed.inefficiencies.length
    : 0;
  const pairs      = [...new Set(parsed.inefficiencies.map(i => i.currencyPair))];

  const report: CurrencyGuardReport = {
    id:                    randomUUID(),
    analysisDate:          new Date().toISOString(),
    transactionCount:      tagged.length,
    totalLossUSD:          totalLoss,
    avgSpreadPct:          avgSpread,
    currencyPairsAnalyzed: pairs,
    inefficiencies:        parsed.inefficiencies,
    normalizationMap:      parsed.normalizationMap,
    insights:              parsed.insights,
    optimizationActions:   parsed.optimizationActions,
  };

  const store = loadStore();
  store.reports.push(report);
  saveStore(store);

  return {
    report,
    usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens, cacheRead: result.cacheRead, cacheWrite: result.cacheWrite },
  };
}

export function listReports(): CurrencyGuardReport[] {
  return loadStore().reports;
}

export function getReport(id: string): CurrencyGuardReport | undefined {
  return loadStore().reports.find(r => r.id === id);
}
