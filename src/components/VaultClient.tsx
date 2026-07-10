'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  createCredential,
  updateCredential,
  deleteCredential,
  lockVault,
} from '@/app/actions';
import type { Credential } from '@/db/schema';
import { ModeToggle } from './mode-toggle';
import KeyGenerator from './key-generator';
import { SecretInput } from './secret-input';

export const TYPES = {
  ssh:      { label: 'SSH',              icon: 'ti-terminal-2',    fields: ['host','port','username','privateKey','passphrase'] },
  pat:      { label: 'GitHub PAT',       icon: 'ti-brand-github',  fields: ['name','token','scopes','expiry'] },
  userpass: { label: 'Username/Pass',    icon: 'ti-user',           fields: ['url','username','password'] },
  api:      { label: 'API key',          icon: 'ti-api',            fields: ['service','apiKey','endpoint'] },
  keypair:  { label: 'Key + Secret',     icon: 'ti-key',            fields: ['service','keyId','secretKey','region','endpoint'] },
  db:       { label: 'Database',         icon: 'ti-database',       fields: ['host','port','database','username','password'] },
} as const;

export const FIELD_META = {
  host:        { label: 'Host',         secret: false },
  port:        { label: 'Port',         secret: false },
  username:    { label: 'Username',     secret: false },
  privateKey:  { label: 'Private key',  secret: true  },
  passphrase:  { label: 'Passphrase',   secret: true  },
  name:        { label: 'Name',         secret: false },
  token:       { label: 'Token',        secret: true  },
  scopes:      { label: 'Scopes',       secret: false },
  expiry:      { label: 'Expiry',       secret: false },
  url:         { label: 'URL',          secret: false },
  password:    { label: 'Password',     secret: true  },
  service:     { label: 'Service',      secret: false },
  apiKey:      { label: 'API key',      secret: true  },
  endpoint:    { label: 'Endpoint',     secret: false },
  database:    { label: 'Database',     secret: false },
  keyId:       { label: 'Access key ID / Client ID',   secret: false },
  secretKey:   { label: 'Secret key / Client secret',  secret: true  },
  region:      { label: 'Region',       secret: false },
} as const;

type CredentialType = keyof typeof TYPES;
type FieldKey = keyof typeof FIELD_META;
type CredentialField = Exclude<keyof Credential, 'id' | 'createdAt' | 'type' | 'label' | 'notes'>;

const TYPE_BADGE_STYLES: Record<CredentialType, string> = {
  ssh: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  pat: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  userpass: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  api: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  keypair: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  db: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
};

const EMPTY_CREDENTIAL_FIELDS = {
  host: null, port: null, username: null, privateKey: null, passphrase: null,
  name: null, token: null, scopes: null, expiry: null, url: null, password: null,
  service: null, apiKey: null, endpoint: null, database: null, keyId: null,
  secretKey: null, region: null,
} as const satisfies Pick<Credential, CredentialField>;

function getTypeBadgeStyle(type: CredentialType) {
  return TYPE_BADGE_STYLES[type];
}

function formatDate(d: Date | null) {
  return d ? new Date(d).toISOString().slice(0, 10) : '—';
}

interface VaultClientProps {
  initialCredentials: Credential[];
}

export default function VaultClient({ initialCredentials }: VaultClientProps) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  const [creds, setCreds] = useState<Credential[]>(initialCredentials);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(
    initialCredentials.length > 0 ? initialCredentials[0].id : null
  );

  // UI state
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState({ show: false, msg: '' });
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Modal state
  const [modalType, setModalType] = useState<'add' | 'edit' | 'delete' | null>(null);
  const [addStep, setAddStep] = useState(1);
  const [addType, setAddType] = useState<CredentialType>('ssh');

  // Form state
  const [formLabel, setFormLabel] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  // Focus search with "/" (unless already typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const el = document.activeElement;
      const typing = el instanceof HTMLElement &&
        (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleLock = async () => {
    await lockVault();
    router.refresh();
  };

  const triggerToast = (msg: string) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: '' }), 2000);
  };

  const copySshFromCred = async (c: Credential) => {
    try {
      if (c.type !== 'ssh') return triggerToast('Not an SSH credential');
      const host = (c.host ?? '').toString().trim();
      const user = (c.username ?? '').toString().trim();
      const port = (c.port ?? '').toString().trim();
      if (!host) return triggerToast('No host available');

      const sshCmd = `ssh ${user ? `${user}@` : ''}${host}${port ? ` -p ${port}` : ''}`;
      await navigator.clipboard.writeText(sshCmd);
      setCopiedField(`ssh-${c.id}`);
      triggerToast('SSH command copied!');
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      triggerToast('Failed to copy SSH command');
    }
  };

  const filteredCreds = useMemo(() => {
    if (!search.trim()) return creds;
    const q = search.trim().toLowerCase();
    return creds.filter(c =>
      c.label.toLowerCase().includes(q) ||
      (c.notes || '').toLowerCase().includes(q) ||
      (c.host || '').toLowerCase().includes(q) ||
      (c.username || '').toLowerCase().includes(q) ||
      (c.service || '').toLowerCase().includes(q) ||
      (c.url || '').toLowerCase().includes(q)
    );
  }, [search, creds]);

  const handleCopy = async (val: string, label: string, fieldKey: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedField(fieldKey);
      triggerToast(`${label} copied!`);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      triggerToast('Failed to copy');
    }
  };

  const openAddModal = () => {
    setModalType('add');
    setAddStep(1);
    setAddType('ssh');
    setFormLabel('');
    setFormNotes('');
    setFormFields({});
    setFormError('');
  };

  const openEditModal = (c: Credential) => {
    setModalType('edit');
    setFormLabel(c.label);
    setFormNotes(c.notes || '');

    const initialFields: Record<string, string> = {};
    const meta = TYPES[c.type as CredentialType];
    meta.fields.forEach((f) => {
      const key = f as CredentialField;
      initialFields[f] = (c[key] ?? '') as string;
    });
    setFormFields(initialFields);
    setFormError('');
  };

  const handleDelete = async () => {
    if (selectedId === null) return;
    const res = await deleteCredential(selectedId);
    if (res.success) {
      const remaining = creds.filter(c => c.id !== selectedId);
      setCreds(remaining);
      setSelectedId(remaining.length > 0 ? remaining[0].id : null);
      setModalType(null);
      triggerToast('Credential deleted');
    } else {
      triggerToast(res.error || 'Failed to delete');
    }
  };

  const saveNew = async () => {
    const meta = TYPES[addType];
    const newLabel = formLabel.trim() || formFields[meta.fields[0]] || `New ${meta.label}`;

    const payload: Omit<Credential, 'id' | 'createdAt'> = {
      ...EMPTY_CREDENTIAL_FIELDS,
      type: addType,
      label: newLabel,
      notes: formNotes.trim(),
    };
    meta.fields.forEach((f) => { payload[f] = formFields[f]?.trim() || ''; });

    const res = await createCredential(payload);
    if (res.success && res.id) {
      const newCred: Credential = { ...payload, id: res.id, createdAt: new Date() };
      const updatedCreds = [...creds, newCred].sort((a, b) => a.label.localeCompare(b.label));
      setCreds(updatedCreds);
      setSelectedId(res.id);
      setModalType(null);
      setRevealed({});
      triggerToast('Credential saved');
    } else {
      setFormError(res.error || 'Failed to save credential');
    }
  };

  const saveEdit = async () => {
    if (selectedId === null) return;
    const c = creds.find(x => x.id === selectedId);
    if (!c) return;

    const meta = TYPES[c.type as CredentialType];
    const newLabel = formLabel.trim() || c.label;

    const payload: Partial<Omit<Credential, 'id' | 'createdAt'>> = {
      label: newLabel,
      notes: formNotes.trim(),
    };
    meta.fields.forEach((f) => { payload[f] = formFields[f]?.trim() || ''; });

    const res = await updateCredential(selectedId, payload);
    if (res.success) {
      const updated = creds.map(x => x.id === selectedId ? { ...x, ...payload } : x);
      setCreds(updated);
      setModalType(null);
      setRevealed({});
      triggerToast('Changes saved');
    } else {
      setFormError(res.error || 'Failed to update credential');
    }
  };

  const selectedCred = filteredCreds.find(x => x.id === selectedId);

  const groupedCreds: Record<string, Credential[]> = {};
  filteredCreds.forEach((c) => {
    (groupedCreds[c.type] ||= []).push(c);
  });

  const isFormDialogOpen = modalType === 'add' || modalType === 'edit';
  const isDeleteDialogOpen = modalType === 'delete';

  const setField = (f: string, val: string) =>
    setFormFields((prev) => ({ ...prev, [f]: val }));

  // Shared form-field renderer for add/edit dialogs.
  const renderFormFields = (fields: readonly string[]) =>
    fields.map((f) => {
      const fm = FIELD_META[f as FieldKey];
      return (
        <div key={f} className="space-y-1.5">
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{fm.label}</div>
          {fm.secret ? (
            <SecretInput
              value={formFields[f] || ''}
              onChange={(val) => setField(f, val)}
              placeholder={fm.label}
            />
          ) : (
            <Input
              type="text"
              placeholder={fm.label}
              value={formFields[f] || ''}
              onChange={(e) => setField(f, e.target.value)}
              className="font-mono text-sm"
            />
          )}
        </div>
      );
    });

  return (
    <div className="flex h-screen flex-col bg-background font-mono text-foreground">
      {/* ── Top command bar ─────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:gap-3 sm:px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground">
            <i className="ti ti-lock text-base" aria-hidden="true" />
          </div>
          <div className="hidden leading-tight sm:block">
            <div className="text-sm font-semibold tracking-tight">vault</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {creds.length} {creds.length === 1 ? 'entry' : 'entries'}
            </div>
          </div>
        </div>

        <div className="relative ml-1 min-w-0 flex-1 sm:ml-2 sm:max-w-xs">
          <i className="ti ti-search pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden="true" />
          <Input
            ref={searchRef}
            type="text"
            placeholder="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 pr-7 font-mono text-sm"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 border border-border px-1 text-[10px] text-muted-foreground sm:block">
            /
          </kbd>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" className="gap-1.5" onClick={openAddModal}>
            <i className="ti ti-plus" aria-hidden="true" />
            <span className="hidden sm:inline">New</span>
          </Button>
          <KeyGenerator />
          <Button variant="outline" size="icon" onClick={handleLock} title="Lock vault">
            <i className="ti ti-lock" aria-hidden="true" />
          </Button>
          <ModeToggle />
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="grid min-h-0 flex-1 md:grid-cols-[17rem_1fr]">
        {/* Sidebar list */}
        <aside className="flex max-h-[38vh] min-h-0 flex-col border-b border-border md:max-h-none md:border-b-0 md:border-r">
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-2">
              {Object.entries(TYPES).map(([typeKey, typeMeta]) => {
                const list = groupedCreds[typeKey] || [];
                if (list.length === 0) return null;

                return (
                  <div key={typeKey} className="mb-3">
                    <div className="flex items-center gap-2 px-1.5 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      <span className="text-primary">//</span>
                      {typeMeta.label}
                      <span className="ml-auto tabular-nums">{list.length}</span>
                    </div>

                    <div className="space-y-0.5">
                      {list.map((c) => {
                        const subLabel = c.type === 'userpass'
                          ? c.username
                          : c.type === 'keypair'
                            ? c.service
                            : c.host || c.service || '';
                        const active = c.id === selectedId;

                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => { setSelectedId(c.id); setRevealed({}); }}
                            className={cn(
                              'group flex w-full items-center gap-2.5 border-l-2 border-transparent px-2 py-2 text-left transition-colors hover:bg-muted',
                              active && 'border-primary bg-muted'
                            )}
                          >
                            <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center text-sm', getTypeBadgeStyle(c.type as CredentialType))}>
                              <i className={`ti ${typeMeta.icon}`} aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium">{c.label}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">{subLabel || 'no details'}</span>
                            </span>

                            {c.type === 'ssh' && (
                              <span
                                role="button"
                                tabIndex={-1}
                                className="flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                                onClick={(e) => { e.stopPropagation(); copySshFromCred(c); }}
                                title="Copy SSH command"
                              >
                                <i className={`ti ${copiedField === `ssh-${c.id}` ? 'ti-check' : 'ti-copy'}`} aria-hidden="true" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {filteredCreds.length === 0 && (
                <div className="mt-6 px-2 text-center text-xs text-muted-foreground">
                  <div className="mb-1 text-primary">// empty</div>
                  {search ? 'no matches' : 'no credentials yet'}
                </div>
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Detail panel */}
        <main className="min-h-0 overflow-auto">
          {selectedCred ? (
            <div className="flex min-h-full flex-col">
              <div className="flex items-start justify-between gap-3 border-b border-border p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center text-lg', getTypeBadgeStyle(selectedCred.type as CredentialType))}>
                    <i className={`ti ${TYPES[selectedCred.type as CredentialType].icon}`} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold tracking-tight">{selectedCred.label}</h2>
                      <span className="border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                        {TYPES[selectedCred.type as CredentialType].label}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      added {formatDate(selectedCred.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 gap-1.5">
                  {selectedCred.type === 'ssh' && (
                    <Button variant="outline" size="icon" onClick={() => copySshFromCred(selectedCred)} title="Copy SSH command">
                      <i className="ti ti-terminal-2" aria-hidden="true" />
                    </Button>
                  )}
                  <Button variant="outline" size="icon" onClick={() => openEditModal(selectedCred)} title="Edit">
                    <i className="ti ti-edit" aria-hidden="true" />
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => setModalType('delete')} title="Delete">
                    <i className="ti ti-trash" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <div className="space-y-6 p-4">
                {/* Fields */}
                <section>
                  <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    <span className="text-primary">#</span> credentials
                  </div>
                  <div className="divide-y divide-border border border-border">
                    {TYPES[selectedCred.type as CredentialType].fields.map((f) => {
                      const fm = FIELD_META[f as FieldKey];
                      const key = f as CredentialField;
                      const val = (selectedCred[key] ?? '') as string;
                      const isRevealed = revealed[f] || false;
                      const display = fm.secret && !isRevealed ? '•'.repeat(12) : val;

                      return (
                        <div key={f} className="grid grid-cols-[6.5rem_1fr] items-center gap-2 px-3 py-2.5 sm:grid-cols-[8rem_1fr]">
                          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{fm.label}</div>
                          <div className="flex min-w-0 items-center gap-1">
                            <span className={cn('min-w-0 flex-1 truncate text-sm', fm.secret && !isRevealed && 'tracking-widest text-muted-foreground')}>
                              {display || '—'}
                            </span>
                            {fm.secret && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setRevealed((prev) => ({ ...prev, [f]: !prev[f] }))}
                                title={isRevealed ? 'Hide' : 'Reveal'}
                              >
                                <i className={`ti ${isRevealed ? 'ti-eye-off' : 'ti-eye'}`} aria-hidden="true" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleCopy(val, fm.label, f)}
                              title="Copy"
                            >
                              <i className={`ti ${copiedField === f ? 'ti-check' : 'ti-copy'}`} aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Notes */}
                {selectedCred.notes && (
                  <section>
                    <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      <span className="text-primary">#</span> notes
                    </div>
                    <div className="border border-border p-3 text-sm leading-6 text-foreground">
                      {selectedCred.notes}
                    </div>
                  </section>
                )}

                {/* Meta */}
                <section>
                  <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    <span className="text-primary">#</span> info
                  </div>
                  <div className="grid grid-cols-2 border border-border divide-x divide-border">
                    <div className="p-3">
                      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">added</div>
                      <div className="mt-1 text-sm">{formatDate(selectedCred.createdAt)}</div>
                    </div>
                    <div className="p-3">
                      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">type</div>
                      <div className="mt-1 text-sm">{TYPES[selectedCred.type as CredentialType].label}</div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-8">
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center border border-border text-2xl text-muted-foreground">
                  <i className="ti ti-lock-open" aria-hidden="true" />
                </div>
                <div className="mt-4 text-sm font-medium">nothing selected</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  pick a credential from the list, or press
                  <span className="mx-1 border border-border px-1">New</span>
                  to add one.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Toast */}
      <div
        className={cn(
          'pointer-events-none fixed bottom-4 right-4 z-50 flex items-center gap-2 border border-border bg-popover px-3 py-2 text-sm shadow-lg transition-all duration-200',
          toast.show ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        )}
      >
        <i className="ti ti-check text-primary" aria-hidden="true" />
        <span>{toast.msg}</span>
      </div>

      {/* Delete confirm */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => !open && setModalType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete credential</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <span className="font-medium text-foreground">{selectedCred?.label}</span>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add / Edit */}
      <Dialog open={isFormDialogOpen} onOpenChange={(open) => !open && setModalType(null)}>
        <DialogContent className="sm:max-w-lg">
          {modalType === 'add' && addStep === 1 && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono">new credential</DialogTitle>
                <DialogDescription>Choose a type to store.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(TYPES).map(([k, m]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setAddType(k as CredentialType)}
                    className={cn(
                      'flex items-center gap-3 border p-3 text-left transition-colors hover:bg-muted',
                      addType === k ? 'border-primary bg-muted' : 'border-border'
                    )}
                  >
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center text-base', getTypeBadgeStyle(k as CredentialType))}>
                      <i className={`ti ${m.icon}`} aria-hidden="true" />
                    </span>
                    <span className="text-xs font-medium">{m.label}</span>
                  </button>
                ))}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setModalType(null)}>Cancel</Button>
                <Button onClick={() => setAddStep(2)}>Next</Button>
              </DialogFooter>
            </>
          )}

          {modalType === 'add' && addStep === 2 && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon-sm" onClick={() => setAddStep(1)} title="Back">
                    <i className="ti ti-arrow-left" aria-hidden="true" />
                  </Button>
                  <div>
                    <DialogTitle className="font-mono">{TYPES[addType].label}</DialogTitle>
                    <DialogDescription>Fill in the details.</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {formError && (
                <div className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {formError}
                </div>
              )}

              <ScrollArea className="max-h-[55vh]">
                <div className="space-y-4 pr-3">
                  <div className="space-y-1.5">
                    <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Label</div>
                    <Input
                      type="text"
                      placeholder="e.g. AWS production"
                      value={formLabel}
                      onChange={(e) => setFormLabel(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>

                  {addType === 'keypair' && (
                    <div className="border border-border bg-muted/40 p-2.5 text-xs leading-5 text-muted-foreground">
                      Works for AWS, GCP, Twilio, SendGrid, Cloudflare — any service with an access key/client ID and secret pair.
                    </div>
                  )}

                  {renderFormFields(TYPES[addType].fields)}

                  <div className="space-y-1.5">
                    <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Notes</div>
                    <Textarea
                      placeholder="optional notes…"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter>
                <Button variant="outline" onClick={() => setModalType(null)}>Cancel</Button>
                <Button onClick={saveNew}>Save</Button>
              </DialogFooter>
            </>
          )}

          {modalType === 'edit' && selectedCred && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono">edit credential</DialogTitle>
                <DialogDescription>Update and save your changes.</DialogDescription>
              </DialogHeader>

              {formError && (
                <div className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {formError}
                </div>
              )}

              <ScrollArea className="max-h-[55vh]">
                <div className="space-y-4 pr-3">
                  <div className="space-y-1.5">
                    <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Label</div>
                    <Input
                      type="text"
                      value={formLabel}
                      onChange={(e) => setFormLabel(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>

                  {renderFormFields(TYPES[selectedCred.type as CredentialType].fields)}

                  <div className="space-y-1.5">
                    <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Notes</div>
                    <Textarea
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter>
                <Button variant="outline" onClick={() => setModalType(null)}>Cancel</Button>
                <Button onClick={saveEdit}>Save changes</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
