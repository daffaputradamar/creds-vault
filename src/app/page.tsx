import { checkSession, getCredentials } from './actions';
import VaultClient from '@/components/VaultClient';
import PassphraseLockWrapper from '@/components/PassphraseLockWrapper';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await checkSession();

  if (!session.valid || session.expiresAt === null) {
    return <PassphraseLockWrapper />
  }

  // Retrieve initial credentials list from DB
  const initialCredentials = await getCredentials();

  return <VaultClient initialCredentials={initialCredentials} sessionExpiresAt={session.expiresAt} />
}
