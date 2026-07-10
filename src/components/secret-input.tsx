"use client"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PasswordGeneratorPanel } from './password-generator-panel';

interface SecretInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Show the inline password generator button. */
  withGenerator?: boolean;
}

/**
 * Text field for secret values: masks by default with a reveal toggle, and
 * optionally an inline generator popover that fills the field with a strong
 * password.
 */
export function SecretInput({ value, onChange, placeholder, withGenerator = true }: SecretInputProps) {
  const [revealed, setRevealed] = useState(false);
  const [genOpen, setGenOpen] = useState(false);

  return (
    <div className="flex gap-1.5">
      <Input
        type={revealed ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-sm"
      />

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setRevealed((r) => !r)}
        title={revealed ? 'Hide' : 'Reveal'}
      >
        <i className={`ti ${revealed ? 'ti-eye-off' : 'ti-eye'}`} aria-hidden="true" />
      </Button>

      {withGenerator && (
        <Popover open={genOpen} onOpenChange={setGenOpen}>
          <PopoverTrigger
            render={
              <Button type="button" variant="outline" size="icon" title="Generate password">
                <i className="ti ti-wand" aria-hidden="true" />
              </Button>
            }
          />
          <PopoverContent align="end" className="w-80">
            <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              password generator
            </div>
            <PasswordGeneratorPanel
              useLabel="Insert into field"
              onUse={(val) => {
                onChange(val);
                setRevealed(true);
                setGenOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
