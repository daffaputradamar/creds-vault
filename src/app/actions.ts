'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/drizzle';
import { credentials, type Credential } from '@/db/schema';
import { eq, or, ilike } from 'drizzle-orm';

/**
 * Check if the current session is authorized using the vault passphrase.
 */
export async function isAuthorized(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('vault_session')?.value;
  const configuredPassphrase = process.env.VAULT_PASSPHRASE || 'hunter2';
  return session === configuredPassphrase;
}

/**
 * Validate passphrase and store session if correct.
 */
export async function unlockVault(passphrase: string): Promise<{ success: boolean; error?: string }> {
  const configuredPassphrase = process.env.VAULT_PASSPHRASE || 'hunter2';
  if (passphrase === configuredPassphrase) {
    const cookieStore = await cookies();
    cookieStore.set('vault_session', passphrase, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
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
  cookieStore.delete('vault_session');
  return { success: true };
}

/**
 * Get credentials, filtering by an optional search query.
 */
export async function getCredentials(search?: string): Promise<Credential[]> {
  const authorized = await isAuthorized();
  if (!authorized) {
    throw new Error('Unauthorized access to vault');
  }

  try {
    if (search && search.trim() !== '') {
      const query = `%${search.trim()}%`;
      return await db
        .select()
        .from(credentials)
        .where(
          or(
            ilike(credentials.label, query),
            ilike(credentials.notes, query),
            ilike(credentials.host, query),
            ilike(credentials.username, query),
            ilike(credentials.service, query),
            ilike(credentials.url, query)
          )
        )
        .orderBy(credentials.label);
    }

    return await db.select().from(credentials).orderBy(credentials.label);
  } catch (error) {
    console.error('Failed to fetch credentials:', error);
    return [];
  }
}

/**
 * Add a new credential to the vault.
 */
export async function createCredential(data: Omit<Credential, 'id' | 'createdAt'>): Promise<{ success: boolean; error?: string; id?: number }> {
  const authorized = await isAuthorized();
  if (!authorized) {
    throw new Error('Unauthorized access to vault');
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
): Promise<{ success: boolean; error?: string }> {
  const authorized = await isAuthorized();
  if (!authorized) {
    throw new Error('Unauthorized access to vault');
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
export async function deleteCredential(id: number): Promise<{ success: boolean; error?: string }> {
  const authorized = await isAuthorized();
  if (!authorized) {
    throw new Error('Unauthorized access to vault');
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
