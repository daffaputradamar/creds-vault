import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const credentials = pgTable('credentials', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(), // ssh, pat, userpass, api, keypair, db
  label: text('label').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  
  // SSH fields
  host: text('host'),
  port: text('port'),
  username: text('username'),
  privateKey: text('private_key'),
  passphrase: text('passphrase'),
  
  // PAT fields
  name: text('name'),
  token: text('token'),
  scopes: text('scopes'),
  expiry: text('expiry'),
  
  // Username/Password & API & DB
  url: text('url'),
  password: text('password'),
  service: text('service'),
  apiKey: text('api_key'),
  endpoint: text('endpoint'),
  database: text('database'),
  keyId: text('key_id'),
  secretKey: text('secret_key'),
  region: text('region'),
});

export type Credential = typeof credentials.$inferSelect;
export type NewCredential = typeof credentials.$inferInsert;
