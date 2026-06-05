'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardDescription,
} from '@/components/ui/card';
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
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { 
  getCredentials, 
  createCredential, 
  updateCredential, 
  deleteCredential, 
  lockVault 
} from '@/app/actions';
import type { Credential } from '@/db/schema';
import { ModeToggle } from './mode-toggle';

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
  ssh: 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900',
  pat: 'bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-900',
  userpass: 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900',
  api: 'bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-900',
  keypair: 'bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-900',
  db: 'bg-orange-100 text-orange-700 ring-1 ring-inset ring-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:ring-orange-900',
};

const EMPTY_CREDENTIAL_FIELDS = {
  host: null,
  port: null,
  username: null,
  privateKey: null,
  passphrase: null,
  name: null,
  token: null,
  scopes: null,
  expiry: null,
  url: null,
  password: null,
  service: null,
  apiKey: null,
  endpoint: null,
  database: null,
  keyId: null,
  secretKey: null,
  region: null,
} as const satisfies Pick<Credential, CredentialField>;

function getTypeBadgeStyle(type: CredentialType) {
  return TYPE_BADGE_STYLES[type];
}

interface VaultClientProps {
  initialCredentials: Credential[];
}

export default function VaultClient({ initialCredentials }: VaultClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [creds, setCreds] = useState<Credential[]>(initialCredentials);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(
    initialCredentials.length > 0 ? initialCredentials[0].id : null
  );

  // UI state
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState({ show: false, msg: '' });
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Modal State
  const [modalType, setModalType] = useState<'add' | 'edit' | 'delete' | null>(null);
  const [addStep, setAddStep] = useState(1);
  const [addType, setAddType] = useState<CredentialType>('ssh');

  // Form State
  const [formLabel, setFormLabel] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  // Lock Vault
  const handleLock = async () => {
    await lockVault();
    router.refresh();
  };

  const copySshFromCred = async (c: Credential) => {
    try {
      if (c.type !== 'ssh') {
        triggerToast('Not an SSH credential');
        return;
      }

      const host = (c.host ?? '').toString().trim();
      const user = (c.username ?? '').toString().trim();
      const port = (c.port ?? '').toString().trim();

      if (!host) {
        triggerToast('No host available');
        return;
      }

      const sshCmd = `ssh ${user ? `${user}@` : ''}${host}${port ? ` -p ${port}` : ''}`;
      await navigator.clipboard.writeText(sshCmd);
      setCopiedField(`ssh-${c.id}`);
      triggerToast('SSH command copied!');
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      triggerToast('Failed to copy SSH command');
    }
  };

  // Toast Helper
  const triggerToast = (msg: string) => {
    setToast({ show: true, msg });
    setTimeout(() => {
      setToast({ show: false, msg: '' });
    }, 2000);
  };

  // Search Logic
  const DEBOUNCE_MS = 500;

  const handleSearchChange = (val: string) => {
    setSearch(val);
  };

  useEffect(() => {
    const id = setTimeout(() => {
      startTransition(async () => {
        const results = await getCredentials(search);
        setCreds(results);
        if (results.length > 0) {
          // Only reset selected if current selected is not in search results
          if (!results.some(c => c.id === selectedId)) {
            setSelectedId(results[0].id);
          }
        } else {
          setSelectedId(null);
        }
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(id);
  }, [search, startTransition, selectedId]);

  // Copy to Clipboard
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

  // Open Add modal
  const openAddModal = () => {
    setModalType('add');
    setAddStep(1);
    setAddType('ssh');
    setFormLabel('');
    setFormNotes('');
    setFormFields({});
    setFormError('');
  };

  // Open Edit modal
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

  // Delete Action
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

  // Save Add Form
  const saveNew = async () => {
    const meta = TYPES[addType];
    const newLabel = formLabel.trim() || formFields[meta.fields[0]] || `New ${meta.label}`;
    
    const payload: Omit<Credential, 'id' | 'createdAt'> = {
      ...EMPTY_CREDENTIAL_FIELDS,
      type: addType,
      label: newLabel,
      notes: formNotes.trim(),
    };

    meta.fields.forEach((f) => {
      payload[f] = formFields[f]?.trim() || '';
    });

    const res = await createCredential(payload);
    if (res.success && res.id) {
      const newCred: Credential = {
        ...payload,
        id: res.id,
        createdAt: new Date(),
      };
      
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

  // Save Edit Form
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

    meta.fields.forEach((f) => {
      payload[f] = formFields[f]?.trim() || '';
    });

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

  // Retrieve current credential details
  const selectedCred = creds.find(x => x.id === selectedId);

  // Group credentials by type for the sidebar
  const groupedCreds: Record<string, Credential[]> = {};
  creds.forEach((c) => {
    if (!groupedCreds[c.type]) groupedCreds[c.type] = [];
    groupedCreds[c.type].push(c);
  });

  const isFormDialogOpen = modalType === 'add' || modalType === 'edit';
  const isDeleteDialogOpen = modalType === 'delete';

  return (
    <div className="h-screen bg-background text-foreground">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4 sm:px-6 lg:px-8">
        <div className="grid flex-1 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] items-center">
          <Card className="flex h-[calc(100vh-2rem)] flex-col overflow-hidden border-border/70 bg-card/90 shadow-xl shadow-black/5 backdrop-blur">
            <div className="border-b border-border/70 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <Badge variant="secondary" className="w-fit rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]">
                    Secure store
                  </Badge>
                  <div>
                    <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                      <i className="ti ti-lock text-muted-foreground" aria-hidden="true" />
                      Credentials Vault
                    </h1>
                    <CardDescription className="mt-1 max-w-xs text-sm leading-6">
                      Search, inspect, and manage stored secrets from a single encrypted workspace.
                    </CardDescription>
                  </div>
                </div>
                <Button variant="outline" size="icon" onClick={handleLock} title="Lock vault">
                  <i className="ti ti-lock-off" aria-hidden="true" />
                </Button>
                <ModeToggle/>
                
              </div>

              <div className="mt-4">
                <Input
                  type="text"
                  placeholder="Search credentials"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
              <div className="mt-3">
                <Button className="w-full gap-2" onClick={openAddModal}>
                  <i className="ti ti-plus" aria-hidden="true" />
                  Add credential
                </Button>
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-5 p-3">
                {Object.entries(TYPES).map(([typeKey, typeMeta]) => {
                  const list = groupedCreds[typeKey] || [];

                  if (list.length === 0) return null;

                  return (
                    <div key={typeKey} className="space-y-2">
                      <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {typeMeta.label}
                      </div>

                      <div className="space-y-1">
                        {list.map((c) => {
                          const subLabel = c.type === 'userpass'
                            ? c.username
                            : c.type === 'keypair'
                              ? c.service
                              : c.host || c.service || '';

                          return (
                            <>
                              <span
                                key={c.id}
                                className={cn(
                                  buttonVariants({variant: 'ghost'}),
                                  'h-auto w-full justify-start gap-3 rounded-xl border border-transparent px-3 py-3 text-left hover:border-border hover:bg-muted/60',
                                  c.id === selectedId && 'border-primary/20 bg-primary/5 shadow-sm'
                                )}
                                onClick={() => {
                                  setSelectedId(c.id);
                                  setRevealed({});
                                }}
                              >
                                <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl text-base', getTypeBadgeStyle(c.type as CredentialType))}>
                                  <i className={`ti ${typeMeta.icon}`} aria-hidden="true" />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium text-foreground">{c.label}</div>
                                  <div className="truncate text-xs text-muted-foreground">{subLabel || 'No extra details'}</div>
                                </div>

                                {c.type === 'ssh' && (
                                <span
                                  className={`h-8 w-8 shrink-0 ${buttonVariants({variant: 'ghost', size: 'icon'})}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copySshFromCred(c);
                                  }}
                                  title="Copy SSH command"
                                >
                                  <i className={`ti ${copiedField === `ssh-${c.id}` ? 'ti-check' : 'ti-copy'}`} aria-hidden="true" />
                                </span>
                              )}
                              </span>
                            </>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {creds.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
                    No results found
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>

          <Card className="flex h-[calc(100vh-2rem)] flex-col overflow-auto border-border/70 bg-card/90 shadow-xl shadow-black/5 backdrop-blur">
            {selectedCred ? (
              <>
                <div className="border-b border-border/70 px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl text-lg', getTypeBadgeStyle(selectedCred.type as CredentialType))}>
                        <i className={`ti ${TYPES[selectedCred.type as CredentialType].icon}`} aria-hidden="true" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{selectedCred.label}</h2>
                          <Badge variant="secondary" className="rounded-full">
                            {TYPES[selectedCred.type as CredentialType].label}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Added {selectedCred.createdAt ? new Date(selectedCred.createdAt).toISOString().slice(0, 10) : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" onClick={() => openEditModal(selectedCred)} title="Edit credential">
                        <i className="ti ti-edit" aria-hidden="true" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => setModalType('delete')} title="Delete credential">
                        <i className="ti ti-trash" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </div>

                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-8 p-5 sm:p-6">
                    <section className="space-y-4">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Credentials</h3>
                        <Separator className="flex-1" />
                      </div>

                      <div className="space-y-4">
                        {TYPES[selectedCred.type as CredentialType].fields.map((f) => {
                          const fm = FIELD_META[f as FieldKey];
                          const key = f as CredentialField;
                          const val = (selectedCred[key] ?? '') as string;
                          const isSecret = fm.secret;
                          const isRevealed = revealed[f] || false;
                          const display = isSecret && !isRevealed ? '••••••••••••' : val;
                          const wrapClass = selectedCred.type === 'keypair' && (f === 'keyId' || f === 'secretKey')
                            ? 'border-l-2 border-primary/40 pl-3'
                            : '';

                          return (
                            <div key={f} className={cn('space-y-2', wrapClass)}>
                              <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{fm.label}</div>
                              <div className={cn(
                                'flex min-h-11 items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5 font-mono text-sm',
                                isSecret && !isRevealed && 'tracking-[0.12em] text-muted-foreground'
                              )}>
                                <span className="min-w-0 flex-1 truncate">{display || '—'}</span>

                                {isSecret && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={() => setRevealed((prev) => ({ ...prev, [f]: !prev[f] }))}
                                    title={isRevealed ? 'Hide' : 'Reveal'}
                                  >
                                    <i className={`ti ${isRevealed ? 'ti-eye-off' : 'ti-eye'}`} aria-hidden="true" />
                                  </Button>
                                )}

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  onClick={() => handleCopy(val, fm.label, f)}
                                  title="Copy"
                                >
                                  <i
                                    className={`ti ${copiedField === f ? 'ti-check' : 'ti-copy'}`}
                                    aria-hidden="true"
                                  />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    {selectedCred.notes && (
                      <section className="space-y-4">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Notes</h3>
                          <Separator className="flex-1" />
                        </div>
                        <div className="rounded-xl border border-border/70 bg-muted/40 p-4 text-sm leading-6 text-foreground">
                          {selectedCred.notes}
                        </div>
                      </section>
                    )}

                    <section className="space-y-4">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Info</h3>
                        <Separator className="flex-1" />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                          <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Added</div>
                          <div className="mt-2 text-sm font-medium text-foreground">
                            {selectedCred.createdAt ? new Date(selectedCred.createdAt).toISOString().slice(0, 10) : '—'}
                          </div>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                          <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Type</div>
                          <div className="mt-2 text-sm font-medium text-foreground">
                            {TYPES[selectedCred.type as CredentialType].label}
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8">
                <div className="max-w-sm rounded-2xl border border-dashed border-border/70 bg-muted/30 px-6 py-10 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground shadow-sm">
                    <i className="ti ti-lock-open text-2xl" aria-hidden="true" />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold tracking-tight">No credential selected</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Select a credential from the sidebar or add a new one to get started.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div
          className={cn(
            'pointer-events-none fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-border/70 bg-card px-4 py-2 text-sm shadow-lg shadow-black/10 transition-all duration-200',
            toast.show ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          )}
        >
          <i className="ti ti-circle-check text-emerald-600" aria-hidden="true" />
          <span>{toast.msg}</span>
        </div>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => !open && setModalType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-medium text-foreground">{selectedCred?.label}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isFormDialogOpen} onOpenChange={(open) => !open && setModalType(null)}>
        <DialogContent className="sm:max-w-lg">
          {modalType === 'add' && addStep === 1 && (
            <>
              <DialogHeader>
                <DialogTitle>Add credential</DialogTitle>
                <DialogDescription>
                  Choose the credential type to store.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(TYPES).map(([k, m]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setAddType(k as CredentialType)}
                    className={cn(
                      'rounded-xl border p-4 text-left transition-colors hover:bg-muted/60',
                      addType === k ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/70 bg-background'
                    )}
                  >
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl text-base', getTypeBadgeStyle(k as CredentialType))}>
                      <i className={`ti ${m.icon}`} aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-sm font-medium text-foreground">{m.label}</div>
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
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAddStep(1)} title="Back">
                    <i className="ti ti-arrow-left" aria-hidden="true" />
                  </Button>
                  <div>
                    <DialogTitle>{TYPES[addType].label}</DialogTitle>
                    <DialogDescription>
                      Fill in the credential details and optional notes.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {formError && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Label</div>
                  <Input
                    type="text"
                    placeholder="e.g. AWS production"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                  />
                </div>

                {addType === 'keypair' && (
                  <div className="rounded-lg border border-border/70 bg-muted/40 p-3 text-sm leading-6 text-muted-foreground">
                    Works for AWS, GCP, Twilio, SendGrid, Cloudflare, and any service that provides an access key/client ID and secret key pair.
                  </div>
                )}

                {TYPES[addType].fields.map((f) => {
                  const fm = FIELD_META[f as FieldKey];

                  return (
                    <div key={f} className="space-y-2">
                      <div className="text-sm font-medium">{fm.label}</div>
                      <Input
                        type={fm.secret ? 'password' : 'text'}
                        placeholder={fm.label}
                        value={formFields[f] || ''}
                        onChange={(e) => setFormFields((prev) => ({ ...prev, [f]: e.target.value }))}
                      />
                    </div>
                  );
                })}

                <div className="space-y-2">
                  <div className="text-sm font-medium">Notes</div>
                  <Textarea
                    placeholder="Optional notes…"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setModalType(null)}>Cancel</Button>
                <Button onClick={saveNew}>Save</Button>
              </DialogFooter>
            </>
          )}

          {modalType === 'edit' && selectedCred && (
            <>
              <DialogHeader>
                <DialogTitle>Edit credential</DialogTitle>
                <DialogDescription>
                  Update the selected credential and save your changes.
                </DialogDescription>
              </DialogHeader>

              {formError && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Label</div>
                  <Input
                    type="text"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                  />
                </div>

                {TYPES[selectedCred.type as CredentialType].fields.map((f) => {
                  const fm = FIELD_META[f as FieldKey];

                  return (
                    <div key={f} className="space-y-2">
                      <div className="text-sm font-medium">{fm.label}</div>
                      <Input
                        type={fm.secret ? 'password' : 'text'}
                        placeholder={fm.label}
                        value={formFields[f] || ''}
                        onChange={(e) => setFormFields((prev) => ({ ...prev, [f]: e.target.value }))}
                      />
                    </div>
                  );
                })}

                <div className="space-y-2">
                  <div className="text-sm font-medium">Notes</div>
                  <Textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                  />
                </div>
              </div>

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
