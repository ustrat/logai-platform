import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const TABLE  = process.env.USER_PROFILES_TABLE ?? 'vp-user-profiles-production';

export interface UserProfile {
  userId:    string;
  firstName: string;
  lastName:  string;
  email:     string;
  updatedAt: string;
}

const NOTIFICATION_DEFAULTS: Record<string, boolean> = {
  renewals:              true,
  risk_queue:            true,
  case_feed:             true,
  watchlist:             true,
  event_normalization:   true,
  eligibility_review:    true,
  probability_workbench: true,
  strategy_selector:     true,
  subscriptions:         true,
  smart_reminder:        true,
  auto_draft:            true,
  spend_analyzer:        true,
  contract_watch:        true,
  currency_guard:        true,
  tax_normalizer:        true,
  escalate_ai:           true,
  email_intel:           true,
  plaid:                 true,
  ai_intelligence:       true,
};

export { NOTIFICATION_DEFAULTS };

async function safeGet(key: Record<string, unknown>) {
  try {
    const res = await client.send(new GetItemCommand({
      TableName: TABLE,
      Key: marshall(key),
    }));
    return res.Item ? unmarshall(res.Item) : null;
  } catch (err: any) {
    if (err.name === 'ResourceNotFoundException') return null;
    throw err;
  }
}

async function safePut(item: Record<string, unknown>) {
  try {
    await client.send(new PutItemCommand({
      TableName: TABLE,
      Item: marshall(item, { removeUndefinedValues: true }),
    }));
  } catch (err: any) {
    if (err.name === 'ResourceNotFoundException') return; // table not yet deployed
    throw err;
  }
}

export const profileStore = {
  async getProfile(userId: string): Promise<UserProfile | null> {
    const item = await safeGet({ PK: `USER#${userId}`, SK: 'PROFILE' });
    if (!item) return null;
    return {
      userId,
      firstName: item.firstName || '',
      lastName:  item.lastName  || '',
      email:     item.email     || '',
      updatedAt: item.updatedAt || '',
    };
  },

  async saveProfile(profile: UserProfile): Promise<void> {
    await safePut({
      PK:        `USER#${profile.userId}`,
      SK:        'PROFILE',
      userId:    profile.userId,
      firstName: profile.firstName,
      lastName:  profile.lastName,
      email:     profile.email,
      updatedAt: new Date().toISOString(),
    });
  },

  async getNotifications(userId: string): Promise<Record<string, boolean> | null> {
    const item = await safeGet({ PK: `USER#${userId}`, SK: 'NOTIFICATIONS' });
    return item?.preferences ?? null;
  },

  async saveNotifications(userId: string, preferences: Record<string, boolean>): Promise<void> {
    await safePut({
      PK:          `USER#${userId}`,
      SK:          'NOTIFICATIONS',
      userId,
      preferences,
      updatedAt:   new Date().toISOString(),
    });
  },
};
