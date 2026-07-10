'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker in production so the app is installable as a PWA.
 * Skipped in development to avoid interfering with hot reloading.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  }, []);

  return null;
}
