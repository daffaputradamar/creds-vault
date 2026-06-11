import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateSecretKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateUUID(): string {
  return uuidv4();
}
