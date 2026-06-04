'use client';

import { useRouter } from 'next/navigation';
import PassphraseLock from './PassphraseLock';

export default function PassphraseLockWrapper() {
  const router = useRouter();
  
  return (
    <PassphraseLock 
      onUnlock={() => {
        router.refresh();
      }} 
    />
  );
}
