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
import { Label } from '@/components/ui/label';
import { CheckIcon, CopyIcon, KeyIcon } from '@phosphor-icons/react';

export default function KeyGenerator() {
  const [secretKey, setSecretKey] = useState('');
  const [uuid, setUuid] = useState('');
  const [copiedField, setCopiedField] = useState<'secretKey' | 'uuid' | null>(null);

  const handleGenerateSecretKey = () => {
    setSecretKey(generateSecretKey());
    setCopiedField(null);
  };

  const handleGenerateUUID = () => {
    setUuid(generateUUID());
    setCopiedField(null);
  };

  const handleCopy = async (value: string, field: 'secretKey' | 'uuid') => {
    if (!value) {
      return;
    }

    await navigator.clipboard.writeText(value);
    setCopiedField(field);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <KeyIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Key Generator</DialogTitle>
          <DialogDescription>
            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="secretKey">Secret Key</Label>
                <div className="flex gap-2">
                  <Input id="secretKey" readOnly value={secretKey} />
                  <Button onClick={handleGenerateSecretKey}>Generate</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleCopy(secretKey, 'secretKey')}
                    disabled={!secretKey}
                  >
                    {copiedField === 'secretKey' ? <CheckIcon /> : <CopyIcon />}
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="uuid">UUID</Label>
                <div className="flex gap-2">
                  <Input id="uuid" readOnly value={uuid} />
                  <Button onClick={handleGenerateUUID}>Generate</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleCopy(uuid, 'uuid')}
                    disabled={!uuid}
                  >
                    {copiedField === 'uuid' ? <CheckIcon /> : <CopyIcon />}
                  </Button>
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}