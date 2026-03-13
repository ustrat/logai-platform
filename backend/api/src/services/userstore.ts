import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'analyst' | 'viewer';
  createdAt: string;
}

// In-memory store — replace with PostgreSQL queries when DB is ready
const users: Map<string, User> = new Map();

// Seed a default admin for development
(async () => {
  const hash = await bcrypt.hash('admin1234', 10);
  const admin: User = {
    id: uuidv4(),
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
    const user: User = { id: uuidv4(), name, email, passwordHash, role, createdAt: new Date().toISOString() };
    users.set(email, user);
    return user;
  },

  verifyPassword: (user: User, password: string): Promise<boolean> =>
    bcrypt.compare(password, user.passwordHash),
};