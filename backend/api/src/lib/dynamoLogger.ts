import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

const ENV = process.env.NODE_ENV === 'production' ? 'production' : 'production';

function tableName(domain: string): string {
  return `vp-${domain}-log-${ENV}`;
}

export async function logEvent(
  domain: string,
  pk: string,
  sk: string,
  attrs: Record<string, unknown>,
): Promise<void> {
  const now = Date.now();
  const item = {
    PK: pk,
    SK: sk,
    timestamp_ms: now,
    ...attrs,
  };
  await client.send(new PutItemCommand({
    TableName: tableName(domain),
    Item: marshall(item, { removeUndefinedValues: true }),
  }));
}
