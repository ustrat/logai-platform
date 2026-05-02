import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { config } from '../config';
import { getSecrets } from '../lib/secretsManager';
import { getEntitlementVersion } from '../lib/entitlementService';
import { AuthUser, ApiResponse, JwtPayload } from '../schemas/types';

declare global {
  namespace Express {
    interface Request { user?: AuthUser; }
  }
}

// ── Cognito RS256 setup ───────────────────────────────────────────────────

const jwksClient = jwksRsa({
  jwksUri: `https://cognito-idp.${config.cognito.region}.amazonaws.com/${config.cognito.userPoolId}/.well-known/jwks.json`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600_000,
  rateLimit: true,
});

function getCognitoSigningKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback): void {
  jwksClient.getSigningKey(header.kid!, (err, key) => {
    if (err || !key) { callback(err ?? new Error('No signing key found')); return; }
    callback(null, key.getPublicKey());
  });
}

const COGNITO_ISSUER = `https://cognito-idp.${config.cognito.region}.amazonaws.com/${config.cognito.userPoolId}`;

// ── Helpers ───────────────────────────────────────────────────────────────

function extractToken(req: Request): string | null {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
}

function unauthorized(res: Response, message = 'Token expired or invalid'): void {
  res.status(401).json({ success: false, error: message } as ApiResponse);
}

function setUserFromCognito(req: Request, payload: Record<string, unknown>): void {
  req.user = {
    userId:               payload.sub as string,
    email:                payload.email as string,
    role:                 (payload['custom:role'] as AuthUser['role']) || 'analyst',
    type:                 'access',
    iat:                  (payload.iat as number) ?? 0,
    exp:                  (payload.exp as number) ?? 0,
    plan:                 (payload['plan'] as string) ?? 'free',
    entitlementsVersion:  (payload['entitlements_version'] as string) ?? null,
  };
}

// ── entitlements_version check ────────────────────────────────────────────
// Call after authenticate on protected routes that gate features.
// Returns 409 ENTITLEMENTS_CHANGED if the token's version is stale.
// The client should silently refresh its Cognito token and retry.
export async function checkEntitlementsVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
  const tokenVersion = (req.user as any)?.entitlementsVersion;
  if (!tokenVersion) { next(); return; }

  try {
    const currentVersion = await getEntitlementVersion(req.user!.userId);
    if (currentVersion !== tokenVersion) {
      res.status(409).json({
        success: false,
        error:   'ENTITLEMENTS_CHANGED',
        message: 'Your entitlements have changed. Refresh your token and retry.',
      });
      return;
    }
  } catch {
    // Non-fatal: if the version check fails, let the request proceed
  }
  next();
}

// ── HS256 verification (locally-issued tokens) ────────────────────────────

function verifyLocalHs256(
  token: string,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const decoded = jwt.verify(
      token,
      getSecrets().jwt.secret,
      { algorithms: ['HS256'] },
    ) as JwtPayload & { iat: number; exp: number };

    // Prevent refresh tokens from being used as access tokens
    if (decoded.type !== 'access') {
      unauthorized(res, 'Refresh tokens cannot be used for API access');
      return;
    }

    req.user = {
      userId: decoded.userId,
      email:  decoded.email,
      role:   decoded.role,
      type:   'access',
      iat:    decoded.iat,
      exp:    decoded.exp,
    };
    next();
  } catch {
    unauthorized(res);
  }
}

// ── Primary middleware ────────────────────────────────────────────────────

/**
 * Verifies Bearer tokens in this order:
 *   1. Cognito RS256 (if COGNITO_USER_POOL_ID is configured)
 *   2. Local HS256   (tokens issued by /auth/login or /auth/register)
 *
 * Refresh tokens are explicitly blocked — they carry type !== 'access'.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' } as ApiResponse);
    return;
  }

  // Skip Cognito verification if the user pool is not configured (dev mode)
  if (!config.cognito.userPoolId) {
    verifyLocalHs256(token, req, res, next);
    return;
  }

  // Try Cognito RS256 first
  jwt.verify(
    token,
    getCognitoSigningKey,
    { issuer: COGNITO_ISSUER, algorithms: ['RS256'] },
    (err, decoded) => {
      if (!err && decoded) {
        setUserFromCognito(req, decoded as Record<string, unknown>);
        next();
        return;
      }
      // RS256 failed — fall back to local HS256 (locally-issued token)
      verifyLocalHs256(token, req, res, next);
    },
  );
}

export function requireRole(...roles: AuthUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' } as ApiResponse);
      return;
    }
    next();
  };
}
