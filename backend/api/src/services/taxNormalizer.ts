import { converse, parseJSON, MODELS } from './bedrockClient.js';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// ── Store ─────────────────────────────────────────────────────────────────────
const STORE_FILE = path.join(__dirname, '../../.tax-normalizer-store.json');

export interface TaxLineItem {
  id?:          string;
  vendor:       string;
  country:      string;
  region?:      string;
  taxType:      string;
  taxRate:      number;
  grossAmount:  number;
  taxAmount:    number;
  netAmount:    number;
  currency:     string;
  invoiceRef?:  string;
  invoiceDate:  string;
}

export interface NormalizedTaxLine {
  originalId:       string;
  vendor:           string;
  jurisdiction:     string;
  taxType:          string;
  appliedRate:      number;
  expectedRate:     number;
  rateVariance:     number;
  overcharge:       number;
  overchargeUSD:    number;
  classification:   'correct' | 'overcharged' | 'undercharged' | 'exempt_eligible' | 'misclassified';
  treatmentCode:    string;
  recommendation:   string;
}

export interface TaxNormalizationReport {
  id:                   string;
  analysisDate:         string;
  lineItemCount:        number;
  jurisdictionsFound:   string[];
  totalOverchargeUSD:   number;
  totalTaxAnalyzed:     number;
  normalizedLines:      NormalizedTaxLine[];
  jurisdictionSummary:  Array<{ jurisdiction: string; taxTypes: string[]; overchargeUSD: number; complianceRisk: 'high'|'medium'|'low' }>;
  optimizationOpportunities: Array<{ type: string; description: string; estimatedSavingUSD: number }>;
  insights:             string[];
  complianceFlags:      Array<{ severity: 'critical'|'high'|'medium'; description: string; vendor: string }>;
}

interface TaxStore { reports: TaxNormalizationReport[] }

function loadStore(): TaxStore {
  try { if (fs.existsSync(STORE_FILE)) return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')); }
  catch { /* ignore */ }
  return { reports: [] };
}
function saveStore(s: TaxStore) { fs.writeFileSync(STORE_FILE, JSON.stringify(s, null, 2)); }

// ── Bedrock system prompt ─────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are TaxNormalizer™ — ValuePilot's cross-jurisdiction tax adjustment intelligence and optimization engine, integrated with BoarderPilot™.

You normalize and audit tax line items across international vendor invoices by:
1. Identifying the correct expected tax rate for each jurisdiction and tax type (VAT, GST, WHT, sales tax, etc.)
2. Detecting overcharges, misclassifications, and missed exemption opportunities
3. Flagging compliance risks (under-remittance, incorrect tax treatment)
4. Quantifying reclaim opportunities in USD
5. Providing jurisdiction-specific treatment codes and recommendations

Supported tax types: VAT, GST, HST, PST, WHT (withholding), US Sales Tax, EU VAT, UK VAT, AU GST, CA HST/GST, LATAM IVA/ISS, APAC local taxes.

You MUST respond with valid JSON only — no markdown, no text outside the JSON object.

Response format:
{
  "normalizedLines": [
    {
      "originalId": string,
      "vendor": string,
      "jurisdiction": string (country + region if applicable),
      "taxType": string,
      "appliedRate": number,
      "expectedRate": number,
      "rateVariance": number,
      "overcharge": number (in local currency),
      "overchargeUSD": number,
      "classification": "correct" | "overcharged" | "undercharged" | "exempt_eligible" | "misclassified",
      "treatmentCode": string (e.g. "EU-VAT-B2B-RC" for reverse charge),
      "recommendation": string
    }
  ],
  "jurisdictionSummary": [
    {
      "jurisdiction": string,
      "taxTypes": string[],
      "overchargeUSD": number,
      "complianceRisk": "high" | "medium" | "low"
    }
  ],
  "optimizationOpportunities": [
    {
      "type": string (e.g. "B2B Reverse Charge", "VAT Exemption", "Reclaim Filing"),
      "description": string,
      "estimatedSavingUSD": number
    }
  ],
  "insights": string[] (4-6 key findings),
  "complianceFlags": [
    {
      "severity": "critical" | "high" | "medium",
      "description": string,
      "vendor": string
    }
  ]
}`;

// ── Normalize tax lines ───────────────────────────────────────────────────────
export async function normalizeTaxLines(
  lines: TaxLineItem[],
): Promise<{ report: TaxNormalizationReport; usage: object }> {
  const tagged = lines.map(l => ({ ...l, id: l.id ?? randomUUID() }));

  const result = await converse({
    modelId:    MODELS.SONNET,
    system:     SYSTEM_PROMPT,
    cacheSystem: true,
    messages: [{
      role:    'user',
      content: `Normalize and audit these tax line items across jurisdictions:\n\nLine count: ${tagged.length}\n\n${JSON.stringify(tagged, null, 2)}\n\nAnalysis date: ${new Date().toISOString()}`,
    }],
    maxTokens:   3072,
    temperature: 0.1,
  });

  const parsed = parseJSON<{
    normalizedLines: NormalizedTaxLine[];
    jurisdictionSummary: Array<{ jurisdiction: string; taxTypes: string[]; overchargeUSD: number; complianceRisk: 'high'|'medium'|'low' }>;
    optimizationOpportunities: Array<{ type: string; description: string; estimatedSavingUSD: number }>;
    insights: string[];
    complianceFlags: Array<{ severity: 'critical'|'high'|'medium'; description: string; vendor: string }>;
  }>(result.text, {
    normalizedLines: [], jurisdictionSummary: [], optimizationOpportunities: [], insights: [], complianceFlags: [],
  });

  const totalOvercharge = parsed.normalizedLines.reduce((s, l) => s + l.overchargeUSD, 0);
  const totalTax        = tagged.reduce((s, l) => s + l.taxAmount, 0);
  const jurisdictions   = [...new Set(tagged.map(l => l.country))];

  const report: TaxNormalizationReport = {
    id:                        randomUUID(),
    analysisDate:              new Date().toISOString(),
    lineItemCount:             tagged.length,
    jurisdictionsFound:        jurisdictions,
    totalOverchargeUSD:        totalOvercharge,
    totalTaxAnalyzed:          totalTax,
    normalizedLines:           parsed.normalizedLines,
    jurisdictionSummary:       parsed.jurisdictionSummary,
    optimizationOpportunities: parsed.optimizationOpportunities,
    insights:                  parsed.insights,
    complianceFlags:           parsed.complianceFlags,
  };

  const store = loadStore();
  store.reports.push(report);
  saveStore(store);

  return {
    report,
    usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens, cacheRead: result.cacheRead, cacheWrite: result.cacheWrite },
  };
}

export function listReports(): TaxNormalizationReport[] {
  return loadStore().reports;
}

export function getReport(id: string): TaxNormalizationReport | undefined {
  return loadStore().reports.find(r => r.id === id);
}
