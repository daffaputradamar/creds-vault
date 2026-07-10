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

export interface PasswordOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

const PASSWORD_POOLS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?',
} as const;

// Characters that are easy to confuse in some fonts.
const AMBIGUOUS = new Set('O0oIl1|`\'"{}[]()/\\;:.,<>'.split(''));

/**
 * Cryptographically secure random password generator. Uses the Web Crypto API
 * (`crypto.getRandomValues`) with rejection sampling so every character in the
 * pool is equally likely (no modulo bias). Guarantees at least one character
 * from each selected category when the length allows.
 */
export function generatePassword(options: PasswordOptions): string {
  const categories = (['lowercase', 'uppercase', 'numbers', 'symbols'] as const)
    .filter((c) => options[c])
    .map((c) => {
      const chars = PASSWORD_POOLS[c].split('');
      return options.excludeAmbiguous
        ? chars.filter((ch) => !AMBIGUOUS.has(ch))
        : chars;
    })
    .filter((pool) => pool.length > 0);

  if (categories.length === 0) return '';

  const pool = categories.flat();
  const length = Math.max(options.length, categories.length);

  // Unbiased random integer in [0, max) via rejection sampling.
  const randomInt = (max: number): number => {
    const limit = Math.floor(0xffffffff / max) * max;
    const buf = new Uint32Array(1);
    let n: number;
    do {
      globalThis.crypto.getRandomValues(buf);
      n = buf[0];
    } while (n >= limit);
    return n % max;
  };

  const pick = (from: string[]) => from[randomInt(from.length)];

  // Seed one char per selected category, then fill the rest from the full pool.
  const chars = categories.map((cat) => pick(cat));
  for (let i = chars.length; i < length; i++) {
    chars.push(pick(pool));
  }

  // Fisher-Yates shuffle so the seeded characters aren't stuck at the front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

/**
 * Estimate password strength as bits of entropy: length * log2(poolSize).
 */
export function passwordEntropyBits(options: PasswordOptions): number {
  const poolSize = (['lowercase', 'uppercase', 'numbers', 'symbols'] as const)
    .filter((c) => options[c])
    .reduce((sum, c) => {
      const chars = PASSWORD_POOLS[c].split('');
      const usable = options.excludeAmbiguous
        ? chars.filter((ch) => !AMBIGUOUS.has(ch))
        : chars;
      return sum + usable.length;
    }, 0);

  if (poolSize === 0) return 0;
  return Math.round(options.length * Math.log2(poolSize));
}
