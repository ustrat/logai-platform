/**
 * ValuePilot Signal Engine — Tokenizer + Product Signal Mapping
 *
 * Pipeline:
 *   raw email text
 *     → tokenize()          — word tokens + type annotations
 *     → extractEntities()   — amounts, dates, domains, action verbs, commitment phrases
 *     → detectSignals()     — token-weighted product signal scoring
 *     → generateInsight()   — structured per-product insight objects
 */

import natural from 'natural';

const tokenizer  = new natural.WordTokenizer();
const stemmer    = natural.PorterStemmer;
const TfIdf      = natural.TfIdf;

// ── Types ─────────────────────────────────────────────────────────────────────
export type ProductKey =
  | 'renewalguard'
  | 'refundpilot'
  | 'followup'
  | 'leakageindex'
  | 'enterprisepilot'
  | 'drivepilot'
  | 'boarderpilot';

export interface Token {
  raw:    string;
  stem:   string;
  type:   'word' | 'amount' | 'date' | 'domain' | 'action_verb' | 'commitment' | 'deadline' | 'proper_noun';
  weight: number;   // 0–1 signal relevance weight
}

export interface EmailEntities {
  amounts:             { value: number; currency: string; raw: string; context: string }[];
  dates:               { raw: string; context: string }[];
  domains:             string[];
  actionVerbs:         string[];
  commitmentPhrases:   string[];
  deadlinePhrases:     string[];
  vendors:             string[];
}

export interface DetectedSignal {
  productKey:   ProductKey;
  productName:  string;
  signalType:   string;
  confidence:   number;
  tokenScore:   number;          // TF-IDF weighted score
  matchedTokens: string[];
  entities:     Partial<EmailEntities>;
  snippet:      string;
}

export interface ProductInsight {
  productKey:   ProductKey;
  productName:  string;
  accent:       string;
  signalCount:  number;
  avgConfidence: number;
  topSignalType: string;
  urgency:      'high' | 'medium' | 'low' | 'none';
  summary:      string;          // human-readable one-liner
  signals:      DetectedSignal[];
  entities:     Partial<EmailEntities>;
}

// ── Stop words ────────────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'is','are','was','were','be','been','being','have','has','had','do','does',
  'did','will','would','could','should','may','might','shall','can',
  'this','that','these','those','it','its','we','our','you','your','they',
  'their','i','my','he','his','she','her','just','also','so','if','as',
  'from','by','about','up','out','into','then','than','more','some','any',
  'all','been','not','no','us','me',
]);

// Action verbs highly weighted for commitment extraction
const ACTION_VERBS = new Set([
  'deliver','send','complete','provide','submit','finish','ensure','confirm',
  'approve','review','schedule','follow','update','resolve','respond',
  'commit','promise','guarantee','fulfill',
]);

// ── Tokenizer ─────────────────────────────────────────────────────────────────
export function tokenize(text: string): Token[] {
  const words  = tokenizer.tokenize(text.toLowerCase()) || [];
  const tokens: Token[] = [];

  // Amount regex
  const amountRe  = /\$[\d,]+(?:\.\d{2})?|\b[\d,]+(?:\.\d{2})?\s*(?:USD|EUR|GBP|CAD|AUD|usd|eur|gbp)/g;
  // Date regex
  const dateRe    = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,?\s*\d{4})?|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/gi;
  // Domain regex
  const domainRe  = /\b[a-zA-Z0-9\-]+\.(com|gov|org|edu|net|io|ai|co)\b/g;

  // Add typed tokens for special patterns
  for (const match of text.matchAll(amountRe)) {
    tokens.push({ raw: match[0], stem: 'amount', type: 'amount', weight: 0.9 });
  }
  for (const match of text.matchAll(dateRe)) {
    tokens.push({ raw: match[0], stem: 'date', type: 'date', weight: 0.85 });
  }
  for (const match of text.matchAll(domainRe)) {
    tokens.push({ raw: match[0].toLowerCase(), stem: match[0].toLowerCase(), type: 'domain', weight: 0.6 });
  }

  // Word tokens
  for (const word of words) {
    if (word.length < 2 || /^\d+$/.test(word)) continue;

    const stem   = stemmer.stem(word);
    const isStop = STOP_WORDS.has(word);
    const isVerb = ACTION_VERBS.has(word);

    let type: Token['type'] = 'word';
    let weight = isStop ? 0 : 0.3;

    if (isVerb)       { type = 'action_verb'; weight = 0.85; }
    else if (!isStop) { weight = 0.4; }

    // Proper noun heuristic (capitalised in original)
    if (text.includes(word.charAt(0).toUpperCase() + word.slice(1)) && !isStop) {
      type   = 'proper_noun';
      weight = Math.max(weight, 0.55);
    }

    tokens.push({ raw: word, stem, type, weight });
  }

  return tokens;
}

// ── Entity extractor ──────────────────────────────────────────────────────────
export function extractEntities(text: string, from: string): EmailEntities {
  const entities: EmailEntities = {
    amounts: [], dates: [], domains: [], actionVerbs: [],
    commitmentPhrases: [], deadlinePhrases: [], vendors: [],
  };

  // Amounts
  for (const m of text.matchAll(/(\$[\d,]+(?:\.\d{2})?|[\d,]+(?:\.\d{2})?\s*(?:USD|EUR|GBP|CAD))/gi)) {
    const raw   = m[0];
    const value = parseFloat(raw.replace(/[^0-9.]/g, ''));
    const currency = raw.match(/USD|EUR|GBP|CAD/i)?.[0]?.toUpperCase() || 'USD';
    const ctx   = text.slice(Math.max(0, m.index! - 40), m.index! + 60).trim();
    entities.amounts.push({ value, currency, raw, context: ctx });
  }

  // Dates
  for (const m of text.matchAll(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,?\s*\d{4})?|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/gi)) {
    const ctx = text.slice(Math.max(0, m.index! - 30), m.index! + 50).trim();
    entities.dates.push({ raw: m[0], context: ctx });
  }

  // Domains
  for (const m of text.matchAll(/\b([a-zA-Z0-9\-]+\.(com|gov|org|edu|net|io|ai|co))\b/g)) {
    if (!entities.domains.includes(m[1].toLowerCase())) entities.domains.push(m[1].toLowerCase());
  }

  // Sender domain as vendor
  const senderDomain = from.match(/@([\w\-]+\.\w+)/)?.[1];
  if (senderDomain) entities.vendors.push(senderDomain);

  // Action verbs in context
  for (const verb of ACTION_VERBS) {
    const re = new RegExp(`\\b(i|we|our team)\\s+(will\\s+)?${verb}\\b[^.!?]{5,80}`, 'i');
    const m  = text.match(re);
    if (m) entities.actionVerbs.push(m[0].trim());
  }

  // Commitment phrases
  const commitPatterns = [
    /\b(?:i|we|our team)\s+will\s+(?:deliver|send|complete|provide|submit|finish)[^.!?]{5,80}/gi,
    /committed\s+to\s+[^.!?]{5,60}/gi,
    /agreed\s+to\s+(?:provide|deliver|submit|send)[^.!?]{5,60}/gi,
  ];
  for (const pat of commitPatterns) {
    for (const m of text.matchAll(pat)) {
      entities.commitmentPhrases.push(m[0].trim());
    }
  }

  // Deadline phrases
  const deadlinePatterns = [
    /(?:due|respond|action required)\s+by\s+[^.!?\n]{5,40}/gi,
    /deadline[:\s]+[^.!?\n]{5,40}/gi,
    /(?:by|before)\s+(?:end of|close of|eod|cob)[^.!?\n]{0,30}/gi,
    /respond\s+within\s+\d+\s+(?:hours?|days?|business days?)/gi,
  ];
  for (const pat of deadlinePatterns) {
    for (const m of text.matchAll(pat)) {
      entities.deadlinePhrases.push(m[0].trim());
    }
  }

  return entities;
}

// ── Product definitions ───────────────────────────────────────────────────────
interface SignalDef {
  type:     string;
  stems:    string[];     // stemmed keywords
  phrases:  (string | RegExp)[];
  baseWeight: number;
}

interface ProductDef {
  key:    ProductKey;
  name:   string;
  accent: string;
  signals: SignalDef[];
}

const PRODUCTS: ProductDef[] = [
  {
    key: 'renewalguard', name: 'RenewalGuard™', accent: '#7c3aed',
    signals: [
      {
        type: 'RENEWAL_NOTICE', baseWeight: 0.92,
        stems: ['renew', 'renewal', 'auto-renew', 'subscript'],
        phrases: [/your\s+(subscription|plan|membership)\s+(renews|will renew)/i, /auto[\s-]?renew/i, 'renewal date', 'renewal reminder'],
      },
      {
        type: 'TRIAL_ENDING', baseWeight: 0.88,
        stems: ['trial', 'expir', 'upgrad'],
        phrases: [/trial\s+(ends?|expir)/i, 'days left in your trial', 'free trial expires'],
      },
      {
        type: 'CONTRACT_RENEWAL', baseWeight: 0.85,
        stems: ['contract', 'agreement', 'renew'],
        phrases: [/contract\s+(renewal|expir)/i, /agreement\s+renewal/i, 'renewal window'],
      },
      {
        type: 'CANCELLATION', baseWeight: 0.95,
        stems: ['cancel', 'terminat', 'discontinu'],
        phrases: [/subscription\s+(cancel|terminat)/i, 'cancellation confirmed', 'you have cancelled'],
      },
    ],
  },
  {
    key: 'refundpilot', name: 'RefundPilot™', accent: '#0891b2',
    signals: [
      {
        type: 'REFUND_PROCESSED', baseWeight: 0.95,
        stems: ['refund', 'credit', 'reimburse'],
        phrases: [/refund\s+(processed|issued|approved)/i, 'refund confirmation', 'credit issued'],
      },
      {
        type: 'DISPUTE_CHARGEBACK', baseWeight: 0.93,
        stems: ['disput', 'chargeback', 'claim'],
        phrases: [/chargeback/i, /dispute\s+(filed|opened|initiated)/i, 'claim opened'],
      },
      {
        type: 'PAYMENT_FAILURE', baseWeight: 0.95,
        stems: ['fail', 'declin', 'unsuccess'],
        phrases: [/payment\s+(failed|declined|unsuccessful)/i, /card\s+declined/i, 'transaction failed'],
      },
      {
        type: 'RETURN_REQUEST', baseWeight: 0.88,
        stems: ['return', 'refund'],
        phrases: [/return\s+(request|initiated)/i, 'requesting a refund', 'return confirmed'],
      },
    ],
  },
  {
    key: 'followup', name: 'FollowUp™ / CommitmentIQ™', accent: '#f59e0b',
    signals: [
      {
        type: 'COMMITMENT_EXTRACTED', baseWeight: 0.82,
        stems: ['commit', 'promis', 'deliveri', 'guarante'],
        phrases: [/\b(?:i|we)\s+will\s+(?:deliver|send|complete|provide)/i, /committed\s+to/i, /agreed\s+to\s+provide/i],
      },
      {
        type: 'FOLLOW_UP_REQUEST', baseWeight: 0.87,
        stems: ['follow', 'await', 'circl', 'check'],
        phrases: [/following\s+up\s+on/i, /per\s+our\s+(conversation|call|meeting)/i, 'circling back', 'checking in', 'awaiting your response'],
      },
      {
        type: 'DEADLINE_DETECTED', baseWeight: 0.90,
        stems: ['deadlin', 'due', 'urgent', 'overdu'],
        phrases: [/action\s+required\s+by/i, /due\s+by/i, /respond\s+within\s+\d+/i, 'by end of day', 'by close of business'],
      },
      {
        type: 'OBLIGATION_MISSED', baseWeight: 0.88,
        stems: ['overdu', 'escalat', 'miss'],
        phrases: [/still\s+waiting/i, /missed\s+(the\s+)?deadline/i, /no\s+response\s+received/i, 'overdue', 'escalation'],
      },
    ],
  },
  {
    key: 'leakageindex', name: 'LeakageIndex™', accent: '#ef4444',
    signals: [
      {
        type: 'RECURRING_CHARGE', baseWeight: 0.78,
        stems: ['receipt', 'charg', 'billed', 'invoic'],
        phrases: [/monthly\s+(charge|billing|invoice)/i, /annual\s+(charge|billing)/i, /recurring\s+(charge|payment)/i, 'your receipt'],
      },
      {
        type: 'UNDERUTILIZATION', baseWeight: 0.85,
        stems: ['unused', 'inactiv', 'low usag'],
        phrases: [/you\s+haven't\s+used/i, /low\s+usage/i, /unused\s+(credits?|seats?|licenses?)/i, 'make the most of'],
      },
      {
        type: 'PRICE_INCREASE', baseWeight: 0.95,
        stems: ['price', 'rate', 'increas', 'adjust'],
        phrases: [/price\s+(increase|change|update)/i, /new\s+pricing/i, /rate\s+(change|increase)/i, 'pricing update'],
      },
      {
        type: 'NEW_SUBSCRIPTION', baseWeight: 0.72,
        stems: ['subscript', 'join', 'signup', 'activ'],
        phrases: [/welcome\s+to/i, /thank you for (subscribing|signing up)/i, 'new subscription', 'account activated'],
      },
    ],
  },
  {
    key: 'enterprisepilot', name: 'EnterprisePilot™', accent: '#1e3a5f',
    signals: [
      {
        type: 'SAAS_INVOICE', baseWeight: 0.85,
        stems: ['enterpris', 'licens', 'invoic', 'saas'],
        phrases: [/enterprise\s+(license|invoice|subscription)/i, /software\s+license/i, 'volume license', 'enterprise plan'],
      },
      {
        type: 'PROCUREMENT', baseWeight: 0.88,
        stems: ['purchas', 'order', 'procur', 'vendor'],
        phrases: [/purchase\s+order/i, /\bP\.?O\.?\s*(number|#)/i, /procurement\s+(request|approval)/i, 'requisition'],
      },
      {
        type: 'AUDIT_COMPLIANCE', baseWeight: 0.92,
        stems: ['audit', 'complianc', 'review', 'govern'],
        phrases: [/audit\s+(request|required)/i, /compliance\s+(review|audit)/i, /access\s+review/i, 'SOC 2', 'ISO 27001'],
      },
      {
        type: 'CONTRACT_LIFECYCLE', baseWeight: 0.87,
        stems: ['contract', 'msa', 'sow', 'agreement'],
        phrases: [/contract\s+(expir|renewal|lifecycle)/i, /master\s+service\s+agreement/i, /\bMSA\b/, /\bSOW\b/],
      },
      {
        type: 'BUDGET_ALERT', baseWeight: 0.82,
        stems: ['budget', 'spend', 'approv', 'threshold'],
        phrases: [/budget\s+(alert|exceeded|warning)/i, /spend\s+(limit|threshold)/i, 'finance approval required'],
      },
    ],
  },
  {
    key: 'drivepilot', name: 'DrivePilot™', accent: '#15803d',
    signals: [
      {
        type: 'FLEET_ALERT', baseWeight: 0.92,
        stems: ['fleet', 'vehicl', 'driver', 'telematic'],
        phrases: [/fleet\s+(alert|report|update)/i, /vehicle\s+(alert|notification)/i, /driver\s+(behavior|report)/i],
      },
      {
        type: 'INSURANCE_RENEWAL', baseWeight: 0.90,
        stems: ['insur', 'polic', 'coverag', 'renew'],
        phrases: [/auto\s+insurance\s+(renewal|expir)/i, /policy\s+(renewal|expir)/i, 'coverage expires'],
      },
      {
        type: 'MAINTENANCE_DUE', baseWeight: 0.88,
        stems: ['mainten', 'servic', 'inspect', 'repair'],
        phrases: [/maintenance\s+(due|reminder)/i, /service\s+(reminder|due)/i, /oil\s+change\s+due/i],
      },
      {
        type: 'VIOLATION_CITATION', baseWeight: 0.96,
        stems: ['violat', 'citat', 'ticket', 'fine'],
        phrases: [/traffic\s+violation/i, /speeding\s+(ticket|citation)/i, /parking\s+(ticket|violation)/i, /toll\s+violation/i],
      },
      {
        type: 'FUEL_MILEAGE', baseWeight: 0.78,
        stems: ['fuel', 'mileag', 'gas', 'reimburse'],
        phrases: [/fuel\s+(card|statement|report)/i, /mileage\s+(report|reimbursement)/i, 'gas reimbursement'],
      },
    ],
  },
  {
    key: 'boarderpilot', name: 'BoarderPilot™', accent: '#b45309',
    signals: [
      {
        type: 'CROSS_BORDER_PAYMENT', baseWeight: 0.88,
        stems: ['intern', 'wire', 'transfer', 'foreign'],
        phrases: [/international\s+(wire|transfer|payment)/i, /cross[\s-]?border\s+payment/i, /foreign\s+(currency|payment)/i],
      },
      {
        type: 'CURRENCY_CONVERSION', baseWeight: 0.85,
        stems: ['exchang', 'forex', 'convert', 'currenc'],
        phrases: [/exchange\s+rate/i, /currency\s+(conversion|converted)/i, /forex\s+(fee|rate)/i, 'FX fee'],
      },
      {
        type: 'TAX_COMPLIANCE', baseWeight: 0.93,
        stems: ['vat', 'gst', 'customs', 'withhol'],
        phrases: [/\bVAT\b/, /\bGST\b/, /import\s+(duty|tax)/i, /customs\s+(notice|charge)/i, /withholding\s+tax/i],
      },
      {
        type: 'JURISDICTION_RISK', baseWeight: 0.82,
        stems: ['jurisdict', 'multination', 'cross-border', 'regulatori'],
        phrases: [/cross[\s-]?jurisdiction/i, /multinational\s+(contract|compliance)/i, 'GDPR', 'data residency'],
      },
      {
        type: 'RENEWAL_DISTORTION', baseWeight: 0.80,
        stems: ['renew', 'currenc', 'local'],
        phrases: [/renewal.*(?:currency|exchange)/i, /local\s+currency\s+billing/i, 'currency-adjusted renewal'],
      },
    ],
  },
];

export { PRODUCTS };

// ── TF-IDF helper ─────────────────────────────────────────────────────────────
function buildTfIdf(tokens: Token[], signalStems: string[]): number {
  if (tokens.length === 0) return 0;
  const tfidf   = new TfIdf();
  tfidf.addDocument(tokens.map(t => t.stem).join(' '));
  let score = 0;
  for (const stem of signalStems) {
    score += tfidf.tfidf(stem, 0);
  }
  return Math.min(score / (signalStems.length * 3), 1); // normalise
}

// ── Core detection ────────────────────────────────────────────────────────────
export function detectSignals(
  subject: string,
  from: string,
  body: string,
): { signals: DetectedSignal[]; entities: EmailEntities; tokens: Token[] } {
  const fullText = `${subject} ${body}`;
  const tokens   = tokenize(fullText);
  const entities = extractEntities(fullText, from);
  const signals: DetectedSignal[] = [];

  for (const product of PRODUCTS) {
    for (const sigDef of product.signals) {
      const matchedTokens: string[] = [];

      // Phrase matching
      for (const phrase of sigDef.phrases) {
        if (typeof phrase === 'string') {
          if (fullText.toLowerCase().includes(phrase.toLowerCase())) matchedTokens.push(phrase as string);
        } else {
          if (phrase.test(fullText)) matchedTokens.push(phrase.source);
        }
      }

      // Stem matching against token list
      const stemHits = tokens.filter(t => sigDef.stems.some(s => t.stem.startsWith(s) || s.startsWith(t.stem)));
      for (const t of stemHits) {
        if (!matchedTokens.includes(t.raw)) matchedTokens.push(t.raw);
      }

      if (matchedTokens.length === 0) continue;

      const phraseScore = matchedTokens.length / (sigDef.phrases.length + sigDef.stems.length);
      const tokenScore  = buildTfIdf(tokens, sigDef.stems);
      const confidence  = Math.min(sigDef.baseWeight * (0.5 + 0.3 * phraseScore + 0.2 * tokenScore), 0.99);

      // Build relevant entity slice
      const relevantEntities: Partial<EmailEntities> = {};
      if (entities.amounts.length)           relevantEntities.amounts           = entities.amounts;
      if (entities.dates.length)             relevantEntities.dates             = entities.dates;
      if (entities.commitmentPhrases.length) relevantEntities.commitmentPhrases = entities.commitmentPhrases;
      if (entities.deadlinePhrases.length)   relevantEntities.deadlinePhrases   = entities.deadlinePhrases;
      if (entities.vendors.length)           relevantEntities.vendors           = entities.vendors;

      // Snippet: first 180 chars of body near a match
      const firstMatch = typeof sigDef.phrases[0] === 'string'
        ? body.toLowerCase().indexOf((sigDef.phrases[0] as string).toLowerCase())
        : body.search(sigDef.phrases[0] as RegExp);
      const snipStart = Math.max(0, firstMatch === -1 ? 0 : firstMatch - 40);
      const snippet   = body.slice(snipStart, snipStart + 180).trim() + (body.length > snipStart + 180 ? '…' : '');

      signals.push({
        productKey:   product.key,
        productName:  product.name,
        signalType:   sigDef.type,
        confidence,
        tokenScore,
        matchedTokens,
        entities: relevantEntities,
        snippet: snippet || subject,
      });
    }
  }

  return {
    signals: signals.sort((a, b) => b.confidence - a.confidence),
    entities,
    tokens,
  };
}

// ── Insight generator ─────────────────────────────────────────────────────────
export function generateInsights(allSignals: DetectedSignal[], allEntities: EmailEntities[]): ProductInsight[] {
  const insights: ProductInsight[] = [];

  for (const product of PRODUCTS) {
    const productSignals = allSignals.filter(s => s.productKey === product.key);
    if (productSignals.length === 0) {
      insights.push({ productKey: product.key, productName: product.name, accent: product.accent, signalCount: 0, avgConfidence: 0, topSignalType: '', urgency: 'none', summary: 'No signals detected', signals: [], entities: {} });
      continue;
    }

    const avgConf    = productSignals.reduce((s, x) => s + x.confidence, 0) / productSignals.length;
    const typeCounts = productSignals.reduce((acc, s) => { acc[s.signalType] = (acc[s.signalType] || 0) + 1; return acc; }, {} as Record<string, number>);
    const topType    = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    // Merge all entities for this product
    const mergedEntities: EmailEntities = { amounts: [], dates: [], domains: [], actionVerbs: [], commitmentPhrases: [], deadlinePhrases: [], vendors: [] };
    for (const e of allEntities) {
      mergedEntities.amounts.push(...(e.amounts || []));
      mergedEntities.dates.push(...(e.dates || []));
      mergedEntities.commitmentPhrases.push(...(e.commitmentPhrases || []));
      mergedEntities.deadlinePhrases.push(...(e.deadlinePhrases || []));
      mergedEntities.vendors.push(...(e.vendors || []));
    }

    // Urgency
    const hasHighConf   = productSignals.some(s => s.confidence >= 0.9);
    const hasDeadlines  = mergedEntities.deadlinePhrases.length > 0;
    const urgency: ProductInsight['urgency'] =
      (hasHighConf && hasDeadlines) ? 'high'
      : hasHighConf ? 'medium'
      : productSignals.length > 2 ? 'medium'
      : 'low';

    // Summary
    const totalAmount  = mergedEntities.amounts.reduce((s, a) => s + a.value, 0);
    const vendorList   = [...new Set(mergedEntities.vendors)].slice(0, 3).join(', ');
    let summary = '';
    switch (product.key) {
      case 'renewalguard':    summary = `${productSignals.length} renewal signal${productSignals.length !== 1 ? 's' : ''}${totalAmount > 0 ? `, $${totalAmount.toLocaleString()} at risk` : ''}${vendorList ? ` from ${vendorList}` : ''}`; break;
      case 'refundpilot':     summary = `${productSignals.length} refund/dispute signal${productSignals.length !== 1 ? 's' : ''}${totalAmount > 0 ? `, $${totalAmount.toLocaleString()} in dispute` : ''}`; break;
      case 'followup':        summary = `${mergedEntities.commitmentPhrases.length} commitment${mergedEntities.commitmentPhrases.length !== 1 ? 's' : ''} extracted, ${mergedEntities.deadlinePhrases.length} deadline${mergedEntities.deadlinePhrases.length !== 1 ? 's' : ''} detected`; break;
      case 'leakageindex':    summary = `${productSignals.length} leakage signal${productSignals.length !== 1 ? 's' : ''}${totalAmount > 0 ? ` — $${totalAmount.toLocaleString()} recurring spend identified` : ''}`; break;
      case 'enterprisepilot': summary = `${productSignals.length} enterprise signal${productSignals.length !== 1 ? 's' : ''}: ${Object.entries(typeCounts).map(([t, c]) => `${c} ${t.replace(/_/g,' ').toLowerCase()}`).join(', ')}`; break;
      case 'drivepilot':      summary = `${productSignals.length} mobility signal${productSignals.length !== 1 ? 's' : ''}${totalAmount > 0 ? `, $${totalAmount.toLocaleString()} in fines/fees` : ''}`; break;
      case 'boarderpilot':    summary = `${productSignals.length} cross-border signal${productSignals.length !== 1 ? 's' : ''}${totalAmount > 0 ? `, $${totalAmount.toLocaleString()} in cross-border flows` : ''}`; break;
      default:                summary = `${productSignals.length} signals detected`;
    }

    insights.push({
      productKey:    product.key,
      productName:   product.name,
      accent:        product.accent,
      signalCount:   productSignals.length,
      avgConfidence: Math.round(avgConf * 100) / 100,
      topSignalType: topType,
      urgency,
      summary,
      signals:       productSignals,
      entities:      mergedEntities,
    });
  }

  return insights.sort((a, b) => {
    const urgencyOrder = { high: 0, medium: 1, low: 2, none: 3 };
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  });
}
