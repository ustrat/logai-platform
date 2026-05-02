import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  QueryCommand,
  BatchWriteItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { randomUUID } from 'crypto';

const region  = process.env.AWS_REGION || 'us-east-1';
const dynamo  = new DynamoDBClient({ region });
const eb      = new EventBridgeClient({ region });

const ENTITLEMENTS_TABLE  = process.env.ENTITLEMENTS_TABLE  || `vp-entitlements-production`;
const SUBSCRIPTIONS_TABLE = process.env.SUBSCRIPTIONS_TABLE || `vp-ent-subscriptions-production`;
const CATALOG_TABLE       = process.env.CATALOG_TABLE       || `vp-catalog-production`;
const EVENT_BUS_NAME      = process.env.ENTITLEMENT_EVENT_BUS || `valuepilot-entitlement-events-production`;

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'paused';
export type EntitlementStatus  = 'active' | 'suspended' | 'revoked';
export type EntitlementSource  = 'subscription' | 'grant' | 'trial';

export interface Entitlement {
  userId:        string;
  tenantId:      string;
  featureKey:    string;
  status:        EntitlementStatus;
  limit?:        number;
  used?:         number;
  source:        EntitlementSource;
  sourceId?:     string;
  expiresAt?:    string;
  updatedAt:     string;
}

export interface Subscription {
  tenantId:     string;
  planId:       string;
  status:       SubscriptionStatus;
  stripeSubId?: string;
  currentPeriodEnd?: string;
  createdAt:    string;
  updatedAt:    string;
}

// ── Entitlement reads ─────────────────────────────────────────────────────

export async function getEntitlement(userId: string, featureKey: string): Promise<Entitlement | null> {
  const res = await dynamo.send(new GetItemCommand({
    TableName: ENTITLEMENTS_TABLE,
    Key: marshall({ PK: `USER#${userId}`, SK: `FEATURE#${featureKey}` }),
  }));
  if (!res.Item) return null;
  const item = unmarshall(res.Item);
  return {
    userId:     item.userId,
    tenantId:   item.tenantId,
    featureKey: item.featureKey,
    status:     item.status,
    limit:      item.limit,
    used:       item.used,
    source:     item.source,
    sourceId:   item.sourceId,
    expiresAt:  item.expiresAt,
    updatedAt:  item.updatedAt,
  };
}

export async function getUserEntitlements(userId: string): Promise<Entitlement[]> {
  const res = await dynamo.send(new QueryCommand({
    TableName: ENTITLEMENTS_TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: marshall({
      ':pk':     `USER#${userId}`,
      ':prefix': 'FEATURE#',
    }),
  }));
  return (res.Items || []).map(i => {
    const item = unmarshall(i);
    return {
      userId: item.userId, tenantId: item.tenantId, featureKey: item.featureKey,
      status: item.status, limit: item.limit, used: item.used,
      source: item.source, sourceId: item.sourceId, expiresAt: item.expiresAt,
      updatedAt: item.updatedAt,
    };
  });
}

export async function checkEntitlement(userId: string, featureKey: string): Promise<boolean> {
  const ent = await getEntitlement(userId, featureKey);
  if (!ent) return false;
  if (ent.status !== 'active') return false;
  if (ent.expiresAt && new Date(ent.expiresAt) < new Date()) return false;
  if (ent.limit !== undefined && ent.used !== undefined && ent.used >= ent.limit) return false;
  return true;
}

// ── Entitlement writes ────────────────────────────────────────────────────

export async function grantEntitlement(ent: Omit<Entitlement, 'updatedAt'>): Promise<void> {
  const now = new Date().toISOString();
  await dynamo.send(new PutItemCommand({
    TableName: ENTITLEMENTS_TABLE,
    Item: marshall({
      PK:         `USER#${ent.userId}`,
      SK:         `FEATURE#${ent.featureKey}`,
      userId:     ent.userId,
      tenantId:   ent.tenantId,
      featureKey: ent.featureKey,
      status:     ent.status,
      limit:      ent.limit ?? null,
      used:       ent.used ?? 0,
      source:     ent.source,
      sourceId:   ent.sourceId ?? null,
      expiresAt:  ent.expiresAt ?? null,
      updatedAt:  now,
    }, { removeUndefinedValues: true }),
  }));
  await incrementEntitlementVersion(ent.userId);
  await publishEvent('EntitlementGranted', ent.tenantId, { userId: ent.userId, featureKey: ent.featureKey, source: ent.source });
}

export async function revokeEntitlement(userId: string, featureKey: string, tenantId: string): Promise<void> {
  await dynamo.send(new UpdateItemCommand({
    TableName: ENTITLEMENTS_TABLE,
    Key: marshall({ PK: `USER#${userId}`, SK: `FEATURE#${featureKey}` }),
    UpdateExpression: 'SET #s = :revoked, updatedAt = :now',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: marshall({ ':revoked': 'revoked', ':now': new Date().toISOString() }),
  }));
  await incrementEntitlementVersion(userId);
  await publishEvent('EntitlementRevoked', tenantId, { userId, featureKey });
}

export async function incrementEntitlementVersion(userId: string): Promise<string> {
  const now = new Date().toISOString();
  const version = `v${Date.now()}`;
  await dynamo.send(new PutItemCommand({
    TableName: ENTITLEMENTS_TABLE,
    Item: marshall({ PK: `USER#${userId}`, SK: 'META#version', version, updatedAt: now }),
  }));
  return version;
}

export async function getEntitlementVersion(userId: string): Promise<string> {
  const res = await dynamo.send(new GetItemCommand({
    TableName: ENTITLEMENTS_TABLE,
    Key: marshall({ PK: `USER#${userId}`, SK: 'META#version' }),
  }));
  if (!res.Item) return 'v1';
  return unmarshall(res.Item).version || 'v1';
}

// ── Subscription reads/writes ─────────────────────────────────────────────

export async function getActiveSubscription(tenantId: string): Promise<Subscription | null> {
  const res = await dynamo.send(new QueryCommand({
    TableName: SUBSCRIPTIONS_TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    FilterExpression: '#s = :active',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: marshall({
      ':pk':     `TENANT#${tenantId}`,
      ':prefix': 'SUB#',
      ':active': 'active',
    }),
    Limit: 1,
  }));
  if (!res.Items || res.Items.length === 0) return null;
  const item = unmarshall(res.Items[0]);
  return {
    tenantId: item.tenantId, planId: item.planId, status: item.status,
    stripeSubId: item.stripeSubId, currentPeriodEnd: item.currentPeriodEnd,
    createdAt: item.createdAt, updatedAt: item.updatedAt,
  };
}

export async function upsertSubscription(sub: Subscription): Promise<void> {
  const now = new Date().toISOString();
  const isNew = !sub.createdAt;
  await dynamo.send(new PutItemCommand({
    TableName: SUBSCRIPTIONS_TABLE,
    Item: marshall({
      PK:                `TENANT#${sub.tenantId}`,
      SK:                `SUB#${sub.stripeSubId || randomUUID()}`,
      tenantId:          sub.tenantId,
      planId:            sub.planId,
      status:            sub.status,
      stripeSubId:       sub.stripeSubId ?? null,
      currentPeriodEnd:  sub.currentPeriodEnd ?? null,
      createdAt:         sub.createdAt || now,
      updatedAt:         now,
    }, { removeUndefinedValues: true }),
  }));
  const eventType = isNew ? 'SubscriptionCreated'
    : sub.status === 'canceled' ? 'SubscriptionCanceled'
    : 'SubscriptionUpdated';
  await publishEvent(eventType, sub.tenantId, { planId: sub.planId, status: sub.status });
}

// ── Catalog reads ─────────────────────────────────────────────────────────

export async function getPlanFeatures(planId: string): Promise<string[]> {
  const res = await dynamo.send(new QueryCommand({
    TableName: CATALOG_TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: marshall({
      ':pk':     `PLAN#${planId}`,
      ':prefix': 'FEATURE#',
    }),
  }));
  return (res.Items || []).map(i => unmarshall(i).featureKey);
}

export async function seedCatalog(): Promise<void> {
  const plans = [
    { planId: 'free',       features: ['dashboard', 'plaid_basic', 'renewals_basic'] },
    { planId: 'pro',        features: ['dashboard', 'plaid_full', 'renewals_full', 'ai_intelligence', 'subscription_ai', 'email_intel', 'anomaly_explain', 'spend_analyzer'] },
    { planId: 'enterprise', features: ['dashboard', 'plaid_full', 'renewals_full', 'ai_intelligence', 'subscription_ai', 'email_intel', 'anomaly_explain', 'spend_analyzer', 'contract_watch', 'currency_guard', 'tax_normalizer', 'escalate_ai', 'smart_reminder', 'auto_draft', 'enterprise_assist', 'partner_portal'] },
  ];

  const writes = plans.flatMap(({ planId, features }) =>
    features.map(f => ({
      PutRequest: {
        Item: marshall({
          PK:         `PLAN#${planId}`,
          SK:         `FEATURE#${f}`,
          planId,
          featureKey: f,
          updatedAt:  new Date().toISOString(),
        }),
      },
    }))
  );

  for (let i = 0; i < writes.length; i += 25) {
    await dynamo.send(new BatchWriteItemCommand({
      RequestItems: { [CATALOG_TABLE]: writes.slice(i, i + 25) },
    }));
  }
}

// ── EventBridge publishing ─────────────────────────────────────────────────

async function publishEvent(eventType: string, tenantId: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await eb.send(new PutEventsCommand({
      Entries: [{
        EventBusName: EVENT_BUS_NAME,
        Source:       'valuepilot.entitlements',
        DetailType:   eventType,
        Detail: JSON.stringify({
          eventId:      randomUUID(),
          eventVersion: '1.0',
          occurredAt:   new Date().toISOString(),
          tenantId,
          correlationId: randomUUID(),
          actor: { type: 'api', id: 'entitlement-service', impersonating: null },
          payload,
        }),
        Time: new Date(),
      }],
    }));
  } catch (err: any) {
    // Non-fatal — event publishing failure must not block the write
    console.error('[entitlement] EventBridge publish failed:', err.message);
  }
}
