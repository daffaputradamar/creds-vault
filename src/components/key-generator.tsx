"use client"

import { useState } from 'react';
import { generateSecretKey, generateUUID } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PasswordGeneratorPanel } from './password-generator-panel';

type CopyField = 'secretKey' | 'uuid';

export default function KeyGenerator() {
  const [secretKey, setSecretKey] = useState('');
  const [uuid, setUuid] = useState('');
  const [copiedField, setCopiedField] = useState<CopyField | null>(null);

  const handleCopy = async (value: string, field: CopyField) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField((f) => (f === field ? null : f)), 1500);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" title="Open generator">
          <i className="ti ti-wand" aria-hidden="true" />
          <span className="hidden sm:inline">Generate</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono">
            <i className="ti ti-wand text-primary" aria-hidden="true" />
            generator
          </DialogTitle>
          <DialogDescription>
            Passwords, secret keys, and UUIDs — generated locally in your browser, never sent anywhere.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="password" className="mt-1">
          <TabsList className="w-full">
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="secretKey">Secret key</TabsTrigger>
            <TabsTrigger value="uuid">UUID</TabsTrigger>
          </TabsList>

          <TabsContent value="password" className="pt-3">
            <PasswordGeneratorPanel />
          </TabsContent>

          <TabsContent value="secretKey" className="space-y-3 pt-3">
            <p className="font-mono text-xs text-muted-foreground">
              256-bit random key, hex-encoded.
            </p>
            <div className="flex gap-1.5">
              <Input readOnly value={secretKey} placeholder="click generate" className="h-8 font-mono text-sm" />
              <Button size="sm" onClick={() => { setSecretKey(generateSecretKey()); setCopiedField(null); }}>
                Generate
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(secretKey, 'secretKey')}
                disabled={!secretKey}
                title="Copy"
              >
                <i className={`ti ${copiedField === 'secretKey' ? 'ti-check' : 'ti-copy'}`} aria-hidden="true" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="uuid" className="space-y-3 pt-3">
            <p className="font-mono text-xs text-muted-foreground">
              Random UUID v4 — identifiers, client IDs, idempotency keys.
            </p>
            <div className="flex gap-1.5">
              <Input readOnly value={uuid} placeholder="click generate" className="h-8 font-mono text-sm" />
              <Button size="sm" onClick={() => { setUuid(generateUUID()); setCopiedField(null); }}>
                Generate
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(uuid, 'uuid')}
                disabled={!uuid}
                title="Copy"
              >
                <i className={`ti ${copiedField === 'uuid' ? 'ti-check' : 'ti-copy'}`} aria-hidden="true" />
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
