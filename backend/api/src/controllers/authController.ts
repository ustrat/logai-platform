import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { userStore } from '../services/userStore';
import { ApiResponse, JwtPayload } from '../schemas/types';
import { logger } from '../config/logger';

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as any);
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password, role } = req.body;
    const user = await userStore.create(name, email, password, role);
    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    res.status(201).json({
      success: true,
      data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } },
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

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  logger.info(`User logged in: ${email}`);

  res.json({
    success: true,
    data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } },
  } as ApiResponse);
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