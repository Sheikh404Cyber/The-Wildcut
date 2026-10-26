#!/usr/bin/env node
// Alternative first-admin method (the easier way is the /admin setup form —
// see DEPLOYMENT_GUIDE_BN.md). This script only PRINTS an SQL statement;
// it never connects anywhere and never stores the password.
//
// Usage (on a computer with Node.js):
//   node scripts/create-admin.mjs "Your Name" you@example.com "a-strong-password"
//
// Then paste the printed SQL into: Cloudflare Dashboard → D1 → wildcut-db →
// Console, and run it. The password is hashed with PBKDF2-HMAC-SHA256,
// 100,000 iterations, random 16-byte salt — exactly like the website itself.

import { pbkdf2Sync, randomBytes } from 'node:crypto';

const [name, email, password] = process.argv.slice(2);
if (!name || !email || !password) {
  console.error('Usage: node scripts/create-admin.mjs "Name" email@example.com "password (min 10 chars)"');
  process.exit(1);
}
if (password.length < 10) {
  console.error('Password must be at least 10 characters.');
  process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, 100000, 32, 'sha256');
const esc = (s) => String(s).replace(/'/g, "''");

console.log(`INSERT INTO admin_users (name, email, password_hash, password_salt, role)
VALUES ('${esc(name)}', '${esc(email.toLowerCase())}', '${hash.toString('base64')}', '${salt.toString('base64')}', 'owner');`);
