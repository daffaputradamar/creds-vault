"use client"

import { useMemo, useState } from 'react';
import {
  cn,
  generatePassword,
  passwordEntropyBits,
  type PasswordOptions,
} from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

const DEFAULT_OPTIONS: PasswordOptions = {
  length: 20,
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: false,
};

type BoolOption = Exclude<keyof PasswordOptions, 'length'>;

const TOGGLES: { key: BoolOption; label: string }[] = [
  { key: 'uppercase', label: 'A–Z' },
  { key: 'lowercase', label: 'a–z' },
  { key: 'numbers', label: '0–9' },
  { key: 'symbols', label: '!@#$' },
  { key: 'excludeAmbiguous', label: 'no look-alikes' },
];

function strengthFor(bits: number): { label: string; tone: string; pct: number } {
  if (bits < 40) return { label: 'weak', tone: 'bg-destructive', pct: 25 };
  if (bits < 70) return { label: 'fair', tone: 'bg-amber-500', pct: 55 };
  if (bits < 100) return { label: 'strong', tone: 'bg-primary', pct: 80 };
  return { label: 'excellent', tone: 'bg-primary', pct: 100 };
}

interface PasswordGeneratorPanelProps {
  onUse?: (value: string) => void;
  useLabel?: string;
  className?: string;
}

export function PasswordGeneratorPanel({
  onUse,
  useLabel = 'Use password',
  className,
}: PasswordGeneratorPanelProps) {
  // Lazy init runs client-side only (parent popover/dialog unmounts when closed).
  const [options, setOptions] = useState<PasswordOptions>(DEFAULT_OPTIONS);
  const [password, setPassword] = useState<string>(() => generatePassword(DEFAULT_OPTIONS));
  const [copied, setCopied] = useState(false);

  const regenerate = (opts: PasswordOptions = options) => {
    setPassword(generatePassword(opts));
    setCopied(false);
  };

  const setOption = <K extends keyof PasswordOptions>(key: K, value: PasswordOptions[K]) => {
    const next = { ...options, [key]: value };
    setOptions(next);
    regenerate(next);
  };

  const copy = async () => {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const bits = useMemo(() => passwordEntropyBits(options), [options]);
  const strength = strengthFor(bits);
  const noCharsets =
    !options.lowercase && !options.uppercase && !options.numbers && !options.symbols;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Output */}
      <div className="flex gap-1.5">
        <Input
          readOnly
          value={password}
          placeholder="select a character set"
          className="h-8 font-mono text-sm tracking-wide"
        />
        <Button variant="outline" size="icon" onClick={() => regenerate()} title="Regenerate">
          <i className="ti ti-refresh" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={copy}
          disabled={!password}
          title="Copy"
        >
          <i className={`ti ${copied ? 'ti-check' : 'ti-copy'}`} aria-hidden="true" />
        </Button>
      </div>

      {/* Strength */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <span>{noCharsets ? 'no charset' : strength.label}</span>
          <span>{noCharsets ? '0 bits' : `${bits} bits`}</span>
        </div>
        <div className="h-1 w-full overflow-hidden bg-muted">
          <div
            className={cn('h-full transition-all', noCharsets ? 'bg-muted' : strength.tone)}
            style={{ width: noCharsets ? '0%' : `${strength.pct}%` }}
          />
        </div>
      </div>

      {/* Length */}
      <div className="space-y-2">
        <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <span>length</span>
          <span className="tabular-nums text-foreground">{options.length}</span>
        </div>
        <Slider
          value={options.length}
          min={8}
          max={64}
          step={1}
          onValueChange={(v) => setOption('length', Array.isArray(v) ? v[0] : v)}
        />
      </div>

      {/* Toggles */}
      <div className="grid gap-2">
        {TOGGLES.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between">
            <Label htmlFor={`pg-${key}`} className="font-mono text-xs font-normal text-muted-foreground">
              {label}
            </Label>
            <Switch
              id={`pg-${key}`}
              checked={options[key]}
              onCheckedChange={(checked) => setOption(key, checked)}
            />
          </div>
        ))}
      </div>

      {onUse && (
        <Button
          className="w-full gap-1.5"
          disabled={!password}
          onClick={() => onUse(password)}
        >
          <i className="ti ti-arrow-down-to-arc" aria-hidden="true" />
          {useLabel}
        </Button>
      )}
    </div>
  );
}
