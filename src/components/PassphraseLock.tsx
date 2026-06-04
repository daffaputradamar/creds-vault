'use client';

import { useState } from 'react';
import { unlockVault } from '@/app/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

interface PassphraseLockProps {
  onUnlock: () => void;
}

export default function PassphraseLock({ onUnlock }: PassphraseLockProps) {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await unlockVault(passphrase);
      if (res.success) {
        onUnlock();
      } else {
        setError(res.error || 'Incorrect passphrase');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-h-screen mx-auto flex min-h-svh w-full max-w-md items-center px-4 py-10 sm:px-6">
      <Card className="w-full border-border/70 bg-card/95 shadow-2xl shadow-black/5 backdrop-blur">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted/60 text-foreground shadow-sm">
            <i className="ti ti-lock text-2xl" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <Badge variant="secondary" className="mx-auto w-fit rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.2em]">
              Secure vault
            </Badge>
            <CardTitle className="text-2xl tracking-tight">Credentials Vault</CardTitle>
            <CardDescription className="mx-auto max-w-sm text-sm leading-6">
              Enter the passphrase to decrypt the vault and access your stored secrets.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="passphrase" className="text-sm font-medium text-foreground">
                Passphrase
              </label>
              <Input
                id="passphrase"
                type="password"
                placeholder="Enter your vault passphrase"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Decrypting...' : 'Unlock Vault'}
            </Button>
          </form>

          {error && (
            <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </CardContent>

        <Separator />

        <CardFooter className="justify-center py-4 text-xs text-muted-foreground">
          The vault unlocks only in this browser session.
        </CardFooter>
      </Card>
    </div>
  );
}
