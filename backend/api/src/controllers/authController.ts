import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { userStore } from '../services/userStore';
import { ApiResponse, JwtPayload } from '../schemas/types';
import { logger } from '../config/logger';
import { getSecrets } from '../lib/secretsManager';

// ── Token helpers ─────────────────────────────────────────────────────────

function signAccessToken(payload: Omit<JwtPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'access' } satisfies JwtPayload,
    getSecrets().jwt.secret,
    // expiresIn from Secrets Manager; defaults to '1h' if not set
    { expiresIn: (getSecrets().jwt.expiresIn ?? '1h') as jwt.SignOptions['expiresIn'] },
  );
}

function issueTokenPair(userId: string, email: string, role: JwtPayload['role']) {
  const accessToken  = signAccessToken({ userId, email, role });
  const refreshToken = userStore.createRefreshToken({ userId, email, role });
  return { accessToken, refreshToken };
}

// ── Handlers ──────────────────────────────────────────────────────────────

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password, role } = req.body;
    const user   = await userStore.create(name, email, password, role);
    const tokens = issueTokenPair(user.id, user.email, user.role);

    res.status(201).json({
      success: true,
      data: {
        ...tokens,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      },
    } as ApiResponse);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message } as ApiResponse);
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  const user = userStore.findByEmail(email);

  if (!user || !(await userStore.verifyPassword(user, password))) {
    res.status(401).json({ success: false, error: 'Invalid email or password' } as ApiResponse);
    return;
  }

  const tokens = issueTokenPair(user.id, user.email, user.role);
  logger.info(`User logged in: ${email}`);

  res.json({
    success: true,
    data: {
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    },
  } as ApiResponse);
}

/**
 * POST /api/v1/auth/refresh
 * Body: { refreshToken: string }
 *
 * Validates the refresh token, issues a new access + refresh token pair
 * (rotation: the submitted refresh token is invalidated immediately).
 */
export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    res.status(400).json({ success: false, error: 'refreshToken is required' } as ApiResponse);
    return;
  }

  const record = userStore.consumeRefreshToken(refreshToken);
  if (!record) {
    res.status(401).json({ success: false, error: 'Refresh token is invalid or expired' } as ApiResponse);
    return;
  }

  const tokens = issueTokenPair(record.userId, record.email, record.role);

  res.json({
    success: true,
    data: tokens,
  } as ApiResponse);
}

/**
 * POST /api/v1/auth/logout
 * Body: { refreshToken?: string, allDevices?: boolean }
 *
 * Revokes the provided refresh token (or all tokens for the user).
 * The access token expiry is enforced by its short TTL — no server-side tracking needed.
 */
export function logout(req: Request, res: Response): void {
  const { refreshToken, allDevices } = req.body as { refreshToken?: string; allDevices?: boolean };

  if (allDevices && req.user) {
    userStore.revokeAllRefreshTokens(req.user.userId);
  } else if (refreshToken) {
    userStore.revokeRefreshToken(refreshToken);
  }

  res.json({ success: true, message: 'Logged out' } as ApiResponse);
}

export function me(req: Request, res: Response): void {
  const user = userStore.findById(req.user!.userId);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' } as ApiResponse);
    return;
  }
  res.json({
    success: true,
    data: { id: user.id, name: user.name, email: user.email, role: user.role },
  } as ApiResponse);
}
