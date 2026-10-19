'use server';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/drizzle';
import { credentials, type Credential } from '@/db/schema';
import { eq } from 'drizzle-orm';

const SESSION_COOKIE = 'vault_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours

export type ActionResult<T = object> =
  | ({ success: true } & T)
  | { success: false; error: string; unauthorized?: boolean };

const UNAUTHORIZED = { success: false, error: 'Session expired. Unlock the vault again.', unauthorized: true } as const;

function getPassphrase() {
  return process.env.VAULT_PASSPHRASE || 'hunter2';
}

function sign(expiresAt: number) {
  return createHmac('sha256', getPassphrase()).update(`vault:${expiresAt}`).digest('base64url');
}

/**
 * Read and verify the session cookie. The cookie holds `<expiresAt>.<hmac>`, so
 * the server knows exactly when a session ends (and it never stores the
 * passphrase itself). Changing VAULT_PASSPHRASE invalidates every session.
 */
async function readSession(): Promise<{ expiresAt: number } | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const [expStr, sig] = raw.split('.');
  const expiresAt = Number(expStr);
  if (!Number.isFinite(expiresAt) || !sig || expiresAt <= Date.now()) return null;

  const expected = Buffer.from(sign(expiresAt));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  return { expiresAt };
}

/**
 * Check if the current session is authorized.
 */
export async function isAuthorized(): Promise<boolean> {
  return (await readSession()) !== null;
}

/**
 * Lightweight session probe for the client: whether the session is still valid
 * and when it expires (ms since epoch).
 */
export async function checkSession(): Promise<{ valid: boolean; expiresAt: number | null }> {
  const session = await readSession();
  return { valid: session !== null, expiresAt: session?.expiresAt ?? null };
}

/**
 * Validate passphrase and store session if correct.
 */
export async function unlockVault(passphrase: string): Promise<ActionResult> {
  if (passphrase === getPassphrase()) {
    const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, `${expiresAt}.${sign(expiresAt)}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_TTL_SECONDS,
    });
    return { success: true };
  }
  return { success: false, error: 'Incorrect passphrase' };
}

/**
 * Destroy vault session.
 */
export async function lockVault(): Promise<{ success: boolean }> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  return { success: true };
}

/**
 * Get all credentials.
 */
export async function getCredentials(): Promise<Credential[]> {
  const authorized = await isAuthorized();
  if (!authorized) {
    throw new Error('Unauthorized access to vault');
  }

  try {
    return await db.select().from(credentials).orderBy(credentials.label);
  } catch (error) {
    console.error('Failed to fetch credentials:', error);
    return [];
  }
}

/**
 * Add a new credential to the vault.
 */
export async function createCredential(data: Omit<Credential, 'id' | 'createdAt'>): Promise<ActionResult<{ id: number }>> {
  const authorized = await isAuthorized();
  if (!authorized) {
    return UNAUTHORIZED;
  }

  try {
    const [inserted] = await db.insert(credentials).values(data).returning({ id: credentials.id });
    revalidatePath('/');
    return { success: true, id: inserted.id };
  } catch (error) {
    console.error('Failed to create credential:', error);
    return { success: false, error: 'Failed to create credential in database' };
  }
}

/**
 * Update an existing credential.
 */
export async function updateCredential(
  id: number,
  data: Partial<Omit<Credential, 'id' | 'createdAt'>>
): Promise<ActionResult> {
  const authorized = await isAuthorized();
  if (!authorized) {
    return UNAUTHORIZED;
  }

  try {
    await db.update(credentials).set(data).where(eq(credentials.id, id));
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error(`Failed to update credential ${id}:`, error);
    return { success: false, error: 'Failed to update credential' };
  }
}

/**
 * Delete a credential.
 */
export async function deleteCredential(id: number): Promise<ActionResult> {
  const authorized = await isAuthorized();
  if (!authorized) {
    return UNAUTHORIZED;
  }

  try {
    await db.delete(credentials).where(eq(credentials.id, id));
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error(`Failed to delete credential ${id}:`, error);
    return { success: false, error: 'Failed to delete credential' };
  }
}
