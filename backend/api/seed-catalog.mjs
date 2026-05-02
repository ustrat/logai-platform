/**
 * One-shot DynamoDB catalog seeder — vp_pricebook_v1
 * Run: node seed-catalog.mjs
 */

import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

const dynamo = new DynamoDBClient({ region: 'us-east-1' });
const TABLE  = process.env.CATALOG_TABLE || 'vp-catalog-production';
const PK     = 'CATALOG#PRODUCTS';

// Prices in cents USD. Annual = 1-yr monthly-equivalent × 12.
const PRODUCTS = [
  // ── Core products ─────────────────────────────────────────────────────────
  {
    productKey:  'plan_renewal_guard',
    name:        'RenewalGuard™',
    description: 'Subscription-renewal detection, prevention, cancellation routing, negotiation, and auditable renewal decisions.',
    tagline:     'Most popular',
    category:    'plan',
    sortOrder:   1,
    active:      true,
    featureKeys: ['renewals_full','risk_queue','case_feed','watchlist','event_normalization','eligibility_review','probability_workbench','strategy_selector'],
    prices:      { monthly: 1299, annual: 11988 },
    features:    ['Renewal detection & prevention','Cancellation routing','Renewal negotiation assistant','Auditable renewal decisions','Risk queue & case feed','Probability workbench'],
  },
  {
    productKey:  'plan_refund_pilot',
    name:        'RefundPilot™',
    description: 'Refund and recovery case creation, evidence bundling, claim qualification, drafting, and recovery analytics.',
    category:    'plan',
    sortOrder:   2,
    active:      true,
    featureKeys: ['refund_pilot','case_feed'],
    prices:      { monthly: 1499, annual: 14388 },
    features:    ['Refund & recovery case creation','Evidence bundling & qualification','Claim drafting assistant','Recovery analytics dashboard','Multi-channel submission','Outcome tracking & reporting'],
  },
  {
    productKey:  'plan_follow_up',
    name:        'FollowUp™',
    description: 'Commitment extraction, reminder orchestration, accountability enforcement, and escalation-based reliability scoring.',
    category:    'plan',
    sortOrder:   3,
    active:      true,
    featureKeys: ['follow_up','smart_reminder'],
    prices:      { monthly: 999, annual: 9588 },
    features:    ['Commitment extraction & tracking','Reminder orchestration','Accountability enforcement','Escalation-based scoring','Multi-channel follow-up','Reliability scoring dashboard'],
  },
  {
    productKey:  'plan_leakage_index',
    name:        'LeakageIndex™',
    description: 'Enterprise financial leakage analytics, redundancy detection, dormant subscription detection, and spend-risk scoring.',
    tagline:     'B2B',
    category:    'plan',
    sortOrder:   4,
    active:      true,
    featureKeys: ['leakage_index','spend_analyzer','subscriptions'],
    prices:      { monthly: 2999, annual: 29988 },
    features:    ['Financial leakage analytics','Redundant subscription detection','Dormant account identification','Spend-risk scoring','Cross-team visibility','Cost recapture recommendations'],
  },
  {
    productKey:  'plan_enterprise_pilot',
    name:        'EnterprisePilot™',
    description: 'Enterprise policy analytics, compliance monitoring, routing, governance dashboards, and cross-product policy control.',
    tagline:     'B2B · Enterprise',
    category:    'plan',
    sortOrder:   5,
    active:      true,
    featureKeys: ['enterprise_pilot','enterprise_assist','partner_portal'],
    prices:      { monthly: 4999, annual: 50388 },
    features:    ['Enterprise policy analytics','Compliance monitoring & routing','Governance dashboards','Cross-product policy control','Partner portal & licence mgmt','Audit-ready reporting'],
  },
  {
    productKey:  'plan_drive_pilot',
    name:        'DrivePilot™',
    description: 'Driver/fleet telemetry, risk scoring, behavioral coaching, safety governance, and fleet analytics.',
    tagline:     'B2B',
    category:    'plan',
    sortOrder:   6,
    active:      true,
    featureKeys: ['drive_pilot'],
    prices:      { monthly: 3499, annual: 34788 },
    features:    ['Driver & fleet telemetry','Risk scoring & behavioral coaching','Safety governance dashboards','Fleet analytics & reporting','Real-time monitoring','Incident tracking'],
  },
  {
    productKey:  'plan_boarder_pilot',
    name:        'BoarderPilot™',
    description: 'Geo-jurisdiction intelligence, travel risk, cross-border policy enforcement, data/zone controls, and global governance normalization.',
    tagline:     'B2B',
    category:    'plan',
    sortOrder:   7,
    active:      true,
    featureKeys: ['boarder_pilot'],
    prices:      { monthly: 4499, annual: 45588 },
    features:    ['Geo-jurisdiction intelligence','Travel risk assessment','Cross-border policy enforcement','Data zone controls','Global governance normalization','Compliance routing'],
  },

  // ── Add-ons ───────────────────────────────────────────────────────────────
  {
    productKey:  'addon_smart_reminder',
    name:        'SmartReminder™',
    description: 'AI-calibrated reminder timing and behavior-adaptive follow-up intervals.',
    category:    'addon',
    sortOrder:   10,
    active:      true,
    featureKeys: ['smart_reminder'],
    prices:      { monthly: 399, annual: 3588 },
    features:    ['AI-calibrated reminder timing','Behavior-adaptive intervals','Multi-channel delivery'],
  },
  {
    productKey:  'addon_auto_draft',
    name:        'AutoDraft™',
    description: 'Context-aware drafting and governed one-click execution support.',
    category:    'addon',
    sortOrder:   11,
    active:      true,
    featureKeys: ['auto_draft'],
    prices:      { monthly: 499, annual: 4788 },
    features:    ['Context-aware AI drafting','One-click execution','Governed template library'],
  },
  {
    productKey:  'addon_spend_analyzer',
    name:        'SpendAnalyzer™',
    description: 'Spending clustering, vendor concentration, and redundancy intelligence.',
    category:    'addon',
    sortOrder:   12,
    active:      true,
    featureKeys: ['spend_analyzer'],
    prices:      { monthly: 599, annual: 5988 },
    features:    ['Spending clustering','Vendor concentration scoring','Redundancy intelligence'],
  },
  {
    productKey:  'addon_contract_watch',
    name:        'ContractWatch™',
    description: 'Contract lifecycle monitoring, renewal clause detection, escalator tracking, and obligation mapping.',
    tagline:     'B2B',
    category:    'addon',
    sortOrder:   13,
    active:      true,
    featureKeys: ['contract_watch'],
    prices:      { monthly: 799, annual: 7788 },
    features:    ['Contract lifecycle monitoring','Renewal clause detection','Obligation mapping'],
  },
  {
    productKey:  'addon_currency_guard',
    name:        'CurrencyGuard™',
    description: 'FX inefficiency detection, variance scoring, and cross-border conversion intelligence.',
    tagline:     'B2B',
    category:    'addon',
    sortOrder:   14,
    active:      true,
    featureKeys: ['currency_guard'],
    prices:      { monthly: 699, annual: 6588 },
    features:    ['FX inefficiency detection','Variance scoring','Cross-border conversion intel'],
  },
  {
    productKey:  'addon_tax_normalizer',
    name:        'TaxNormalizer™',
    description: 'Jurisdiction-aware tax, VAT, duty, and digital-service-tax normalization.',
    tagline:     'B2B',
    category:    'addon',
    sortOrder:   15,
    active:      true,
    featureKeys: ['tax_normalizer'],
    prices:      { monthly: 899, annual: 8988 },
    features:    ['Jurisdiction-aware tax normalization','VAT & duty handling','Digital-service-tax support'],
  },
  {
    productKey:  'addon_escalate_ai',
    name:        'EscalateAI™',
    description: 'Structured escalation routing and multi-step enforcement workflows.',
    category:    'addon',
    sortOrder:   16,
    active:      true,
    featureKeys: ['escalate_ai'],
    prices:      { monthly: 599, annual: 5988 },
    features:    ['Structured escalation routing','Multi-step enforcement','Configurable thresholds'],
  },
];

async function seed() {
  const now = new Date().toISOString();
  let ok = 0, fail = 0;

  for (const product of PRODUCTS) {
    try {
      await dynamo.send(new PutItemCommand({
        TableName: TABLE,
        Item: marshall({
          PK:        PK,
          SK:        `PRODUCT#${product.productKey}`,
          ...product,
          updatedAt: now,
        }, { removeUndefinedValues: true }),
      }));
      console.log(`  ✓  ${product.productKey}`);
      ok++;
    } catch (err) {
      console.error(`  ✗  ${product.productKey}: ${err.message}`);
      fail++;
    }
  }

  console.log(`\nDone — ${ok} seeded, ${fail} failed  (table: ${TABLE})`);
  if (fail > 0) process.exit(1);
}

seed();
