import { DynamoDBClient, PutItemCommand, GetItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const TABLE  = 'vp-plaid-log-production';

export interface PlaidEntry {
  accessToken:  string;
  itemId:       string;
  connectedAt:  string;
}

export async function savePlaidToken(userId: string, entry: PlaidEntry): Promise<void> {
  await client.send(new PutItemCommand({
    TableName: TABLE,
    Item: marshall({
      PK:          `USER#${userId}`,
      SK:          'TOKEN#plaid',
      itemId:      entry.itemId,
      accessToken: entry.accessToken,
      connectedAt: entry.connectedAt,
      timestamp_ms: Date.now(),
    }),
  }));
}

export async function getPlaidToken(userId: string): Promise<PlaidEntry | null> {
  try {
    const res = await client.send(new GetItemCommand({
      TableName: TABLE,
      Key: marshall({ PK: `USER#${userId}`, SK: 'TOKEN#plaid' }),
    }));
    if (!res.Item) return null;
    const item = unmarshall(res.Item);
    return { accessToken: item.accessToken, itemId: item.itemId, connectedAt: item.connectedAt };
  } catch {
    return null;
  }
}

export async function deletePlaidToken(userId: string): Promise<void> {
  await client.send(new DeleteItemCommand({
    TableName: TABLE,
    Key: marshall({ PK: `USER#${userId}`, SK: 'TOKEN#plaid' }),
  }));
}
