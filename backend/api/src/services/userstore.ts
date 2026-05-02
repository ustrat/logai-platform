import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { logger } from '../config/logger';
import { JwtPayload } from '../schemas/types';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'analyst' | 'viewer';
  createdAt: string;
}

interface RefreshTokenRecord {
  userId: string;
  email: string;
  role: User['role'];
  expiresAt: number; // Unix ms
}

// In-memory store — replace with PostgreSQL queries when DB is ready
const users = new Map<string, User>();

// keyed by opaque token string; single-use (deleted on consumption)
const refreshTokens = new Map<string, RefreshTokenRecord>();

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Seed a default admin for development
(async () => {
  const hash = await bcrypt.hash('admin1234', 10);
  const admin: User = {
    id: randomUUID(),
    name: 'Admin User',
    email: 'admin@logai.dev',
    passwordHash: hash,
    role: 'admin',
    createdAt: new Date().toISOString(),
  };
  users.set(admin.email, admin);
  logger.info('Dev admin seeded — email: admin@logai.dev  password: admin1234');
})();

export const userStore = {
  findByEmail: (email: string): User | undefined => users.get(email),

  findById: (id: string): User | undefined =>
    [...users.values()].find((u) => u.id === id),

  create: async (name: string, email: string, password: string, role: User['role']): Promise<User> => {
    if (users.has(email)) throw new Error('Email already registered');
    const passwordHash = await bcrypt.hash(password, 10);
    const user: User = { id: randomUUID(), name, email, passwordHash, role, createdAt: new Date().toISOString() };
    users.set(email, user);
    return user;
  },

  verifyPassword: (user: User, password: string): Promise<boolean> =>
    bcrypt.compare(password, user.passwordHash),

  // ── Refresh token management ────────────────────────────────────────────

  createRefreshToken: (payload: Pick<JwtPayload, 'userId' | 'email' | 'role'>): string => {
    const token = randomUUID();
    refreshTokens.set(token, {
      ...payload,
      expiresAt: Date.now() + REFRESH_TTL_MS,
    });
    return token;
  },

  /** Validates and consumes a refresh token (single-use). Returns null if invalid/expired. */
  consumeRefreshToken: (token: string): RefreshTokenRecord | null => {
    const record = refreshTokens.get(token);
    if (!record) return null;
    refreshTokens.delete(token); // single-use: delete immediately
    if (Date.now() > record.expiresAt) return null;
    return record;
  },

  /** Revokes all refresh tokens for a user (logout from all sessions). */
  revokeAllRefreshTokens: (userId: string): void => {
    for (const [token, record] of refreshTokens.entries()) {
      if (record.userId === userId) refreshTokens.delete(token);
    }
  },

  /** Revokes a single specific refresh token (single-device logout). */
  revokeRefreshToken: (token: string): void => {
    refreshTokens.delete(token);
  },
};
