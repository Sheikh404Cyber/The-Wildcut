// Authentication & sessions.
// Passwords: PBKDF2-HMAC-SHA256 (WebCrypto), per-user random salt.
// Sessions: random 256-bit token; only the SHA-256 hash is stored in D1.

import { sqlTime, sqlTimePlus } from './util.js';
import { getCookie, SESSION_COOKIE } from './http.js';

const PBKDF2_ITERATIONS = 100000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;
const LOGIN_WINDOW_MIN = 15;
const LOGIN_MAX_FAILS = 5;

function bytesToB64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2(password, saltBytes, iterations, dkLen = 32) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    key,
    dkLen * 8
  );
  return new Uint8Array(bits);
}

/** Hash a new password. Returns { hash, salt } (base64) to store in admin_users. */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return { hash: bytesToB64(hash), salt: bytesToB64(salt) };
}

/** Verify a password against stored hash/salt. Constant-time comparison. */
export async function verifyPassword(password, storedHashB64, storedSaltB64) {
  try {
    const salt = b64ToBytes(storedSaltB64);
    const computed = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
    const stored = b64ToBytes(storedHashB64);
    if (computed.length !== stored.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i++) diff |= computed[i] ^ stored[i];
    return diff === 0;
  } catch {
    return false;
  }
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Create a session for a user; returns the RAW token (goes into the cookie, never stored). */
export async function createSession(DB, userId) {
  const rawBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = [...rawBytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  const tokenHash = await sha256Hex(token);
  await DB.prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
    .bind(userId, tokenHash, sqlTimePlus(SESSION_TTL_MS))
    .run();
  return token;
}

/** Resolve the session cookie to a user row, or null. Also cleans expired sessions opportunistically. */
export async function getSessionUser(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT s.expires_at, u.id, u.name, u.email, u.role, u.is_active
       FROM sessions s JOIN admin_users u ON u.id = s.user_id
      WHERE s.token_hash = ?`
  )
    .bind(tokenHash)
    .first();
  if (!row) return null;
  if (!row.is_active) return null;
  if (new Date(row.expires_at.replace(' ', 'T') + 'Z').getTime() < Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

export async function destroySession(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return;
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
}

/** Brute-force guard for the login endpoint. */
export async function loginRateLimited(DB, ip) {
  const cutoff = sqlTime(new Date(Date.now() - LOGIN_WINDOW_MIN * 60 * 1000));
  const row = await DB.prepare(
    'SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND attempted_at > ?'
  )
    .bind(ip, cutoff)
    .first();
  return (row?.n ?? 0) >= LOGIN_MAX_FAILS;
}

export async function recordFailedLogin(DB, ip) {
  await DB.prepare('INSERT INTO login_attempts (ip) VALUES (?)').bind(ip).run();
}

export async function clearFailedLogins(DB, ip) {
  await DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
}

/**
 * Guard for admin API handlers.
 * Usage: const auth = await requireRole(request, env, ['owner','admin']);
 *        if (auth.response) return auth.response; const user = auth.user;
 */
export async function requireRole(request, env, roles) {
  const user = await getSessionUser(request, env);
  if (!user) {
    const { fail } = await import('./http.js');
    return { response: fail(401, 'Login required') };
  }
  if (roles && !roles.includes(user.role)) {
    const { fail } = await import('./http.js');
    return { response: fail(403, 'Permission denied') };
  }
  return { user };
}
