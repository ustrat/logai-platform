/**
 * One-shot Stripe sync — reads products from DynamoDB, creates/updates
 * Stripe products + prices, then writes Stripe IDs back to DynamoDB.
 * Run: node sync-stripe.mjs
 */

import Stripe from 'stripe';
import {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ||
  'REDACTED_USE_ENV_VAR';

const TABLE  = process.env.CATALOG_TABLE || 'vp-catalog-production';
const PK     = 'CATALOG#PRODUCTS';
const region = process.env.AWS_REGION    || 'us-east-1';

const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2024-06-20' });
const dynamo = new DynamoDBClient({ region });

// ── Read all products from DynamoDB ────────────────────────────────────────

async function getProducts() {
  const res = await dynamo.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: marshall({ ':pk': PK, ':prefix': 'PRODUCT#' }),
  }));
  return (res.Items || [])
    .map(i => unmarshall(i))
    .filter(p => p.active)
    .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
}

// ── Write Stripe IDs back to DynamoDB ──────────────────────────────────────

async function writeStripeIds(productKey, stripeProductId, stripePriceIds) {
  await dynamo.send(new UpdateItemCommand({
    TableName: TABLE,
    Key: marshall({ PK, SK: `PRODUCT#${productKey}` }),
    UpdateExpression: 'SET stripeProductId = :pid, stripePriceIds = :prices, updatedAt = :now',
    ExpressionAttributeValues: marshall({
      ':pid':    stripeProductId,
      ':prices': stripePriceIds,
      ':now':    new Date().toISOString(),
    }, { removeUndefinedValues: true }),
  }));
}

// ── Main sync ──────────────────────────────────────────────────────────────

async function sync() {
  const products = await getProducts();
  console.log(`Found ${products.length} products in DynamoDB\n`);

  let synced = 0;
  const errors = [];

  for (const product of products) {
    process.stdout.write(`  ${product.productKey} … `);
    try {
      // Build feature metadata for Stripe
      const featureMeta = {};
      (product.features || []).forEach((f, i) => {
        featureMeta[`feature_${String(i + 1).padStart(2, '0')}`] = f;
      });
      const metadata = {
        productKey:  product.productKey,
        category:    product.category,
        featureKeys: (product.featureKeys || []).join(','),
        ...featureMeta,
      };

      // Create or update Stripe product
      let stripeProductId = product.stripeProductId;
      if (!stripeProductId) {
        const sp = await stripe.products.create({
          name:        product.name,
          description: product.description || undefined,
          metadata,
          active:      true,
        });
        stripeProductId = sp.id;
      } else {
        await stripe.products.update(stripeProductId, {
          name:        product.name,
          description: product.description || undefined,
          metadata,
        });
      }

      const existingPriceIds = product.stripePriceIds ?? {};
      const newPriceIds = { ...existingPriceIds };

      // Monthly price
      if (product.prices?.monthly && !existingPriceIds.monthly) {
        const mp = await stripe.prices.create({
          product:     stripeProductId,
          unit_amount: product.prices.monthly,
          currency:    'usd',
          recurring:   { interval: 'month' },
          metadata:    { productKey: product.productKey, period: 'monthly' },
        });
        newPriceIds.monthly = mp.id;
      }

      // Annual price
      if (product.prices?.annual && !existingPriceIds.annual) {
        const ap = await stripe.prices.create({
          product:     stripeProductId,
          unit_amount: product.prices.annual,
          currency:    'usd',
          recurring:   { interval: 'year' },
          metadata:    { productKey: product.productKey, period: 'annual' },
        });
        newPriceIds.annual = ap.id;
      }

      await writeStripeIds(product.productKey, stripeProductId, newPriceIds);

      const tags = [stripeProductId];
      if (newPriceIds.monthly && !existingPriceIds.monthly) tags.push(`monthly: ${newPriceIds.monthly}`);
      if (newPriceIds.annual  && !existingPriceIds.annual)  tags.push(`annual: ${newPriceIds.annual}`);
      console.log(`✓  (${tags.join(' · ')})`);
      synced++;
    } catch (err) {
      console.log(`✗  ${err.message}`);
      errors.push(`${product.productKey}: ${err.message}`);
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Synced ${synced}/${products.length} products to Stripe`);
  if (errors.length) {
    console.error(`\nErrors (${errors.length}):`);
    errors.forEach(e => console.error(`  • ${e}`));
    process.exit(1);
  }
}

sync();
