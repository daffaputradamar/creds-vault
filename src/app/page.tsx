import { isAuthorized, getCredentials } from './actions';
import VaultClient from '@/components/VaultClient';
import PassphraseLockWrapper from '@/components/PassphraseLockWrapper';
import { ModeToggle } from '@/components/mode-toggle';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const authorized = await isAuthorized();

  if (!authorized) {
    return (
      <div className="min-h-svh">
        <PassphraseLockWrapper />
      </div>
    );
  }

  // Retrieve initial credentials list from DB
  const initialCredentials = await getCredentials();

  return (
    <div className="min-h-svh">
      <VaultClient initialCredentials={initialCredentials} />
    </div>
  );
}
