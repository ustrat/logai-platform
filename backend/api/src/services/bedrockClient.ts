import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  type Message,
  type SystemContentBlock,
  type ContentBlock,
} from '@aws-sdk/client-bedrock-runtime';

// ── Model IDs ─────────────────────────────────────────────────────────────────
export const MODELS = {
  // Complex reasoning: enterprise assistant, anomaly explanations, subscription analysis
  SONNET: process.env.BEDROCK_SONNET_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-6',
  // High-volume fast inference: email signal scanning (called per email)
  HAIKU:  process.env.BEDROCK_HAIKU_MODEL_ID  ?? 'us.anthropic.claude-haiku-4-5-20251001',
} as const;

export type ModelId = typeof MODELS[keyof typeof MODELS];

// ── Client (singleton, region from env) ──────────────────────────────────────
const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ConverseOptions {
  modelId:      ModelId;
  system:       string;          // system prompt text
  cacheSystem?: boolean;         // cache the system prompt (default true for long prompts)
  messages:     Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?:   number;
  temperature?: number;
}

export interface ConverseResult {
  text:         string;
  inputTokens:  number;
  outputTokens: number;
  cacheRead:    number;
  cacheWrite:   number;
}

// ── Core converse call ────────────────────────────────────────────────────────
export async function converse(opts: ConverseOptions): Promise<ConverseResult> {
  const {
    modelId,
    system,
    cacheSystem = true,
    messages,
    maxTokens = 2048,
    temperature = 0.2,
  } = opts;

  // Build system blocks — cache point after system text enables prompt caching
  const systemBlocks: SystemContentBlock[] = [
    { text: system },
    ...(cacheSystem ? [{ cachePoint: { type: 'default' as const } }] : []),
  ];

  // Build message blocks
  const messageBlocks: Message[] = messages.map(m => ({
    role: m.role,
    content: [{ text: m.content } as ContentBlock],
  }));

  const cmd = new ConverseCommand({
    modelId,
    system: systemBlocks,
    messages: messageBlocks,
    inferenceConfig: { maxTokens, temperature },
  });

  const response = await client.send(cmd);

  const text = response.output?.message?.content
    ?.map(b => ('text' in b ? b.text : ''))
    .join('') ?? '';

  const usage = response.usage ?? {};

  return {
    text,
    inputTokens:  usage.inputTokens  ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    cacheRead:    (usage as any).cacheReadInputTokens  ?? 0,
    cacheWrite:   (usage as any).cacheWriteInputTokens ?? 0,
  };
}

// ── Streaming converse — yields text chunks ───────────────────────────────────
export async function* converseStream(opts: ConverseOptions): AsyncGenerator<string> {
  const { modelId, system, cacheSystem = true, messages, maxTokens = 4096, temperature = 0.2 } = opts;

  const systemBlocks: SystemContentBlock[] = [
    { text: system },
    ...(cacheSystem ? [{ cachePoint: { type: 'default' as const } }] : []),
  ];

  const messageBlocks: Message[] = messages.map(m => ({
    role: m.role,
    content: [{ text: m.content } as ContentBlock],
  }));

  const cmd = new ConverseStreamCommand({
    modelId,
    system: systemBlocks,
    messages: messageBlocks,
    inferenceConfig: { maxTokens, temperature },
  });

  const response = await client.send(cmd);
  if (!response.stream) return;

  for await (const event of response.stream) {
    if (event.contentBlockDelta?.delta?.text) {
      yield event.contentBlockDelta.delta.text;
    }
  }
}

// ── JSON helper — parse Claude's response as JSON, with fallback ──────────────
export function parseJSON<T>(text: string, fallback: T): T {
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    console.error('[bedrockClient] Failed to parse JSON response:', cleaned.slice(0, 200));
    return fallback;
  }
}
