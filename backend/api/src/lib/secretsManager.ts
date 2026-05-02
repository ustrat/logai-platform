import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

// In-memory cache: secret name → parsed value. Populated once at startup.
const cache = new Map<string, Record<string, string>>();

async function fetchSecret(name: string): Promise<Record<string, string>> {
  if (cache.has(name)) return cache.get(name)!;

  const res = await client.send(new GetSecretValueCommand({ SecretId: name }));
  if (!res.SecretString) throw new Error(`Secret ${name} has no string value`);

  const parsed = JSON.parse(res.SecretString) as Record<string, string>;
  cache.set(name, parsed);
  return parsed;
}

// ── Typed secret shapes ────────────────────────────────────────────────────

export interface AppSecrets {
  jwt: {
    secret: string;
    expiresIn: string;
  };
  plaid: {
    clientId: string;
    secret: string;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
  };
  smtp: {
    host: string;
    port: string;
    user: string;
    pass: string;
  };
}

let _secrets: AppSecrets | null = null;

// ── Dev fallback: assemble from env vars so local dev works without AWS ───

function fromEnv(): AppSecrets {
  return {
    jwt: {
      secret: process.env.JWT_SECRET ?? '',
      expiresIn: process.env.JWT_EXPIRES_IN ?? '30m',
    },
    plaid: {
      clientId: process.env.PLAID_CLIENT_ID ?? '',
      secret: process.env.PLAID_SECRET ?? '',
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY ?? '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
    smtp: {
      host: process.env.SMTP_HOST ?? '',
      port: process.env.SMTP_PORT ?? '587',
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
    },
  };
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Call once at application startup (before the HTTP server binds).
 * In production, fetches all secrets from AWS Secrets Manager and fails fast
 * if any secret is unreachable. In development, falls back to env vars.
 *
 * Secret field mapping (matches existing Secrets Manager structure):
 *   valuepilot/jwt            → { jwtSecret }
 *   valuepilot/plaid          → { clientId, secret }
 *   valuepilot/stripe         → { stripeSecretKey }
 *   valuepilot/stripe-webhook → { stripeWebhookSecret }
 *   valuepilot/google-oauth   → { clientId, clientSecret }
 *   valuepilot/smtp           → { host, port, user, pass }
 */
export async function loadSecrets(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    _secrets = fromEnv();
    return;
  }

  const prefix = process.env.SECRETS_PREFIX ?? 'valuepilot';

  const [jwtRaw, plaidRaw, stripeRaw, stripeWebhookRaw, googleRaw, smtpRaw] = await Promise.all([
    fetchSecret(`${prefix}/jwt`),
    fetchSecret(`${prefix}/plaid`),
    fetchSecret(`${prefix}/stripe`),
    fetchSecret(`${prefix}/stripe-webhook`),
    fetchSecret(`${prefix}/google-oauth`),
    fetchSecret(`${prefix}/smtp`),
  ]);

  _secrets = {
    jwt: {
      secret:    jwtRaw.jwtSecret,
      expiresIn: jwtRaw.expiresIn ?? '30m',
    },
    plaid: {
      clientId: plaidRaw.clientId,
      secret:   plaidRaw.secret,
    },
    stripe: {
      secretKey:     stripeRaw.stripeSecretKey,
      webhookSecret: stripeWebhookRaw.stripeWebhookSecret,
    },
    google: {
      clientId:     googleRaw.clientId,
      clientSecret: googleRaw.clientSecret,
    },
    smtp: {
      host: smtpRaw.host,
      port: smtpRaw.port ?? '587',
      user: smtpRaw.user,
      pass: smtpRaw.pass,
    },
  };
}

/**
 * Returns the loaded secrets. Throws if called before loadSecrets().
 */
export function getSecrets(): AppSecrets {
  if (!_secrets) throw new Error('Secrets not loaded — call loadSecrets() at startup');
  return _secrets;
}
