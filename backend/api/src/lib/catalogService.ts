import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import Stripe from 'stripe';
import { getSecrets } from './secretsManager';

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const TABLE  = process.env.CATALOG_TABLE || 'vp-catalog-production';

// PK for all product records — enables a single query to list everything
const PRODUCTS_PK = 'CATALOG#PRODUCTS';

// ── Types ──────────────────────────────────────────────────────────────────

export type BillingCategory = 'plan' | 'addon';

export interface ProductPrices {
  monthly?: number;  // cents USD
  annual?:  number;  // cents USD, billed annually
}

export interface CatalogProduct {
  productKey:     string;
  name:           string;
  description:    string;
  tagline?:       string;
  category:       BillingCategory;
  sortOrder:      number;
  active:         boolean;
  featureKeys:    string[];
  prices:         ProductPrices;
  // Populated after Stripe sync
  stripeProductId?:  string;
  stripePriceIds?: { monthly?: string; annual?: string };
  // Stripe-compatible feature bullet points (stored as metadata)
  features?:      string[];
  updatedAt:      string;
}

// ── Default price book ─────────────────────────────────────────────────────
// Single source of truth — edit here and run /api/v1/catalog/seed

// Prices in cents USD. Annual = 1-yr monthly-equivalent × 12.
// Source: vp_pricebook_v1 — edit here, then POST /api/v1/catalog/seed
export const DEFAULT_PRODUCTS: Omit<CatalogProduct, 'updatedAt' | 'stripeProductId' | 'stripePriceIds'>[] = [

  // ── Core products (VP-CORE-*) ─────────────────────────────────────────────

  {
    productKey:  'plan_renewal_guard',      // VP-CORE-RG-001
    name:        'RenewalGuard™',
    description: 'Subscription-renewal detection, prevention, cancellation routing, negotiation, and auditable renewal decisions.',
    tagline:     'Most popular',
    category:    'plan',
    sortOrder:   1,
    active:      true,
    featureKeys: [
      'renewals_full', 'risk_queue', 'case_feed', 'watchlist',
      'event_normalization', 'eligibility_review', 'probability_workbench', 'strategy_selector',
    ],
    prices:   { monthly: 1299, annual: 11988 },   // $12.99/mo · $9.99/mo eq annual
    features: [
      'Renewal detection & prevention',
      'Cancellation routing',
      'Renewal negotiation assistant',
      'Auditable renewal decisions',
      'Risk queue & case feed',
      'Probability workbench',
    ],
  },

  {
    productKey:  'plan_refund_pilot',       // VP-CORE-RP-002
    name:        'RefundPilot™',
    description: 'Refund and recovery case creation, evidence bundling, claim qualification, drafting, and recovery analytics.',
    category:    'plan',
    sortOrder:   2,
    active:      true,
    featureKeys: ['refund_pilot', 'case_feed'],
    prices:   { monthly: 1499, annual: 14388 },   // $14.99/mo · $11.99/mo eq annual
    features: [
      'Refund & recovery case creation',
      'Evidence bundling & qualification',
      'Claim drafting assistant',
      'Recovery analytics dashboard',
      'Multi-channel submission',
      'Outcome tracking & reporting',
    ],
  },

  {
    productKey:  'plan_follow_up',          // VP-CORE-FU-003
    name:        'FollowUp™',
    description: 'Commitment extraction, reminder orchestration, accountability enforcement, and escalation-based reliability scoring.',
    category:    'plan',
    sortOrder:   3,
    active:      true,
    featureKeys: ['follow_up', 'smart_reminder'],
    prices:   { monthly: 999, annual: 9588 },     // $9.99/mo · $7.99/mo eq annual
    features: [
      'Commitment extraction & tracking',
      'Reminder orchestration',
      'Accountability enforcement',
      'Escalation-based scoring',
      'Multi-channel follow-up',
      'Reliability scoring dashboard',
    ],
  },

  {
    productKey:  'plan_leakage_index',      // VP-CORE-LI-004
    name:        'LeakageIndex™',
    description: 'Enterprise financial leakage analytics, redundancy detection, dormant subscription detection, and spend-risk scoring.',
    tagline:     'B2B',
    category:    'plan',
    sortOrder:   4,
    active:      true,
    featureKeys: ['leakage_index', 'spend_analyzer', 'subscriptions'],
    prices:   { monthly: 2999, annual: 29988 },   // $29.99/mo · $24.99/mo eq annual
    features: [
      'Financial leakage analytics',
      'Redundant subscription detection',
      'Dormant account identification',
      'Spend-risk scoring',
      'Cross-team visibility',
      'Cost recapture recommendations',
    ],
  },

  {
    productKey:  'plan_enterprise_pilot',   // VP-CORE-EP-005
    name:        'EnterprisePilot™',
    description: 'Enterprise policy analytics, compliance monitoring, routing, governance dashboards, and cross-product policy control.',
    tagline:     'B2B · Enterprise',
    category:    'plan',
    sortOrder:   5,
    active:      true,
    featureKeys: ['enterprise_pilot', 'enterprise_assist', 'partner_portal'],
    prices:   { monthly: 4999, annual: 50388 },   // $49.99/mo · $41.99/mo eq annual
    features: [
      'Enterprise policy analytics',
      'Compliance monitoring & routing',
      'Governance dashboards',
      'Cross-product policy control',
      'Partner portal & licence mgmt',
      'Audit-ready reporting',
    ],
  },

  {
    productKey:  'plan_drive_pilot',        // VP-CORE-DP-006
    name:        'DrivePilot™',
    description: 'Driver/fleet telemetry, risk scoring, behavioral coaching, safety governance, and fleet analytics.',
    tagline:     'B2B',
    category:    'plan',
    sortOrder:   6,
    active:      true,
    featureKeys: ['drive_pilot'],
    prices:   { monthly: 3499, annual: 34788 },   // $34.99/mo · $28.99/mo eq annual
    features: [
      'Driver & fleet telemetry',
      'Risk scoring & behavioral coaching',
      'Safety governance dashboards',
      'Fleet analytics & reporting',
      'Real-time monitoring',
      'Incident tracking',
    ],
  },

  {
    productKey:  'plan_boarder_pilot',      // VP-CORE-BP-007
    name:        'BoarderPilot™',
    description: 'Geo-jurisdiction intelligence, travel risk, cross-border policy enforcement, data/zone controls, and global governance normalization.',
    tagline:     'B2B',
    category:    'plan',
    sortOrder:   7,
    active:      true,
    featureKeys: ['boarder_pilot'],
    prices:   { monthly: 4499, annual: 45588 },   // $44.99/mo · $37.99/mo eq annual
    features: [
      'Geo-jurisdiction intelligence',
      'Travel risk assessment',
      'Cross-border policy enforcement',
      'Data zone controls',
      'Global governance normalization',
      'Compliance routing',
    ],
  },

  // ── Add-ons (VP-ADDON-*) ──────────────────────────────────────────────────

  {
    productKey:  'addon_smart_reminder',    // VP-ADDON-SR-101
    name:        'SmartReminder™',
    description: 'AI-calibrated reminder timing and behavior-adaptive follow-up intervals.',
    category:    'addon',
    sortOrder:   10,
    active:      true,
    featureKeys: ['smart_reminder'],
    prices:   { monthly: 399, annual: 3588 },     // $3.99/mo · $2.99/mo eq annual
    features: ['AI-calibrated reminder timing', 'Behavior-adaptive intervals', 'Multi-channel delivery'],
  },

  {
    productKey:  'addon_auto_draft',        // VP-ADDON-AD-102
    name:        'AutoDraft™',
    description: 'Context-aware drafting and governed one-click execution support.',
    category:    'addon',
    sortOrder:   11,
    active:      true,
    featureKeys: ['auto_draft'],
    prices:   { monthly: 499, annual: 4788 },     // $4.99/mo · $3.99/mo eq annual
    features: ['Context-aware AI drafting', 'One-click execution', 'Governed template library'],
  },

  {
    productKey:  'addon_spend_analyzer',    // VP-ADDON-SA-103
    name:        'SpendAnalyzer™',
    description: 'Spending clustering, vendor concentration, and redundancy intelligence.',
    category:    'addon',
    sortOrder:   12,
    active:      true,
    featureKeys: ['spend_analyzer'],
    prices:   { monthly: 599, annual: 5988 },     // $5.99/mo · $4.99/mo eq annual
    features: ['Spending clustering', 'Vendor concentration scoring', 'Redundancy intelligence'],
  },

  {
    productKey:  'addon_contract_watch',    // VP-ADDON-CW-104
    name:        'ContractWatch™',
    description: 'Contract lifecycle monitoring, renewal clause detection, escalator tracking, and obligation mapping.',
    tagline:     'B2B',
    category:    'addon',
    sortOrder:   13,
    active:      true,
    featureKeys: ['contract_watch'],
    prices:   { monthly: 799, annual: 7788 },     // $7.99/mo · $6.49/mo eq annual
    features: ['Contract lifecycle monitoring', 'Renewal clause detection', 'Obligation mapping'],
  },

  {
    productKey:  'addon_currency_guard',    // VP-ADDON-CG-105
    name:        'CurrencyGuard™',
    description: 'FX inefficiency detection, variance scoring, and cross-border conversion intelligence.',
    tagline:     'B2B',
    category:    'addon',
    sortOrder:   14,
    active:      true,
    featureKeys: ['currency_guard'],
    prices:   { monthly: 699, annual: 6588 },     // $6.99/mo · $5.49/mo eq annual
    features: ['FX inefficiency detection', 'Variance scoring', 'Cross-border conversion intel'],
  },

  {
    productKey:  'addon_tax_normalizer',    // VP-ADDON-TN-106
    name:        'TaxNormalizer™',
    description: 'Jurisdiction-aware tax, VAT, duty, and digital-service-tax normalization.',
    tagline:     'B2B',
    category:    'addon',
    sortOrder:   15,
    active:      true,
    featureKeys: ['tax_normalizer'],
    prices:   { monthly: 899, annual: 8988 },     // $8.99/mo · $7.49/mo eq annual
    features: ['Jurisdiction-aware tax normalization', 'VAT & duty handling', 'Digital-service-tax support'],
  },

  {
    productKey:  'addon_escalate_ai',       // VP-ADDON-EA-107
    name:        'EscalateAI™',
    description: 'Structured escalation routing and multi-step enforcement workflows.',
    category:    'addon',
    sortOrder:   16,
    active:      true,
    featureKeys: ['escalate_ai'],
    prices:   { monthly: 599, annual: 5988 },     // $5.99/mo · $4.99/mo eq annual
    features: ['Structured escalation routing', 'Multi-step enforcement', 'Configurable thresholds'],
  },
];

// ── DynamoDB read/write ────────────────────────────────────────────────────

export async function getAllProducts(): Promise<CatalogProduct[]> {
  const res = await dynamo.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: marshall({ ':pk': PRODUCTS_PK, ':prefix': 'PRODUCT#' }),
  }));
  return (res.Items || [])
    .map(i => unmarshall(i) as CatalogProduct)
    .filter(p => p.active)
    .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
}

export async function getProduct(productKey: string): Promise<CatalogProduct | null> {
  const res = await dynamo.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND SK = :sk',
    ExpressionAttributeValues: marshall({ ':pk': PRODUCTS_PK, ':sk': `PRODUCT#${productKey}` }),
  }));
  if (!res.Items?.length) return null;
  return unmarshall(res.Items[0]) as CatalogProduct;
}

async function saveProduct(product: CatalogProduct): Promise<void> {
  await dynamo.send(new PutItemCommand({
    TableName: TABLE,
    Item: marshall({
      PK:        PRODUCTS_PK,
      SK:        `PRODUCT#${product.productKey}`,
      ...product,
      updatedAt: new Date().toISOString(),
    }, { removeUndefinedValues: true }),
  }));
}

// Write Stripe IDs back into DynamoDB without overwriting the whole item
async function writeStripeIds(
  productKey: string,
  stripeProductId: string,
  stripePriceIds: { monthly?: string; annual?: string },
): Promise<void> {
  await dynamo.send(new UpdateItemCommand({
    TableName: TABLE,
    Key: marshall({ PK: PRODUCTS_PK, SK: `PRODUCT#${productKey}` }),
    UpdateExpression: 'SET stripeProductId = :pid, stripePriceIds = :prices, updatedAt = :now',
    ExpressionAttributeValues: marshall({
      ':pid':    stripeProductId,
      ':prices': stripePriceIds,
      ':now':    new Date().toISOString(),
    }, { removeUndefinedValues: true }),
  }));
}

// ── Seeding ────────────────────────────────────────────────────────────────

export async function seedPriceBook(): Promise<number> {
  const now = new Date().toISOString();
  for (const product of DEFAULT_PRODUCTS) {
    await saveProduct({ ...product, updatedAt: now });
  }
  return DEFAULT_PRODUCTS.length;
}

// ── Stripe sync ────────────────────────────────────────────────────────────

export async function syncAllToStripe(): Promise<{ synced: number; errors: string[] }> {
  const stripeKey = getSecrets().stripe?.secretKey;
  if (!stripeKey) throw new Error('Stripe secret key not configured in Secrets Manager');

  const stripe  = new Stripe(stripeKey, { apiVersion: '2024-06-20' } as any);
  const products = await getAllProducts();
  const errors: string[] = [];
  let synced = 0;

  for (const product of products) {
    try {
      // Build Stripe metadata from feature bullets
      const featureMetadata: Record<string, string> = {};
      (product.features || []).forEach((f, i) => {
        featureMetadata[`feature_${String(i + 1).padStart(2, '0')}`] = f;
      });

      // Create or retrieve Stripe product
      let stripeProductId = product.stripeProductId;
      if (!stripeProductId) {
        const sp = await stripe.products.create({
          name:        product.name,
          description: product.description || undefined,
          metadata: {
            productKey: product.productKey,
            category:   product.category,
            featureKeys: product.featureKeys.join(','),
            ...featureMetadata,
          },
          active: product.active,
        });
        stripeProductId = sp.id;
      } else {
        await stripe.products.update(stripeProductId, {
          name:        product.name,
          description: product.description || undefined,
          metadata: {
            productKey: product.productKey,
            category:   product.category,
            featureKeys: product.featureKeys.join(','),
            ...featureMetadata,
          },
          active: product.active,
        });
      }

      const existingPriceIds = product.stripePriceIds ?? {};
      const newPriceIds: { monthly?: string; annual?: string } = { ...existingPriceIds };

      // Monthly price
      if (product.prices.monthly && !existingPriceIds.monthly) {
        const mp = await stripe.prices.create({
          product:    stripeProductId,
          unit_amount: product.prices.monthly,
          currency:   'usd',
          recurring:  { interval: 'month' },
          metadata:   { productKey: product.productKey, period: 'monthly' },
        });
        newPriceIds.monthly = mp.id;
      }

      // Annual price
      if (product.prices.annual && !existingPriceIds.annual) {
        const ap = await stripe.prices.create({
          product:    stripeProductId,
          unit_amount: product.prices.annual,
          currency:   'usd',
          recurring:  { interval: 'year' },
          metadata:   { productKey: product.productKey, period: 'annual' },
        });
        newPriceIds.annual = ap.id;
      }

      await writeStripeIds(product.productKey, stripeProductId, newPriceIds);
      synced++;
    } catch (err: any) {
      errors.push(`${product.productKey}: ${err.message}`);
    }
  }

  return { synced, errors };
}

// ── Price ID resolution (used by checkout) ────────────────────────────────

export async function resolveStripePriceId(
  productKey: string,
  period: 'monthly' | 'annual',
): Promise<string | null> {
  const product = await getProduct(productKey);
  if (!product) return null;
  return product.stripePriceIds?.[period] ?? null;
}
