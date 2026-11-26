/* Shared by worker/sketch.js and worker/brief.js (the /start wizard).

   Variables and secrets: Workers & Pages → mcw-site → Settings → Variables and
   Secrets (locally, .dev.vars at the repo root, which is gitignored). The KV
   binding is in wrangler.jsonc.
     ANTHROPIC_API_KEY        secret   Claude API key (set a monthly spend limit on it)
     SKETCH_SECRET            secret   signs the session tickets; any long random string
     TURNSTILE_SITEKEY        var      Cloudflare Turnstile site key (public)
     TURNSTILE_SECRET         secret   Turnstile secret key
     WEBSITE_FORM_SECRET      secret   same value as Business OS's WEBSITE_FORM_SECRET
     BUSINESS_OS_WEBHOOK_URL  var      https://<Business OS host>/webhooks/website-form/
     SKETCH_KV                KV       per-session and per-IP counters */

export const USERS = {
  staff: 'Our staff', customers: 'Our customers', clients: 'Patients or clients',
  members: 'Members or volunteers', public: 'The public', me: 'Just me',
};
export const PLATFORMS = { desktop: 'A computer', phone: 'Their phone', both: 'Both' };
export const TODAY = {
  sheets: 'Spreadsheets', paper: 'Paper or a whiteboard', tool: "An off-the-shelf tool that doesn't fit",
  email: 'Email and phone calls', existing: 'An app we already have', nothing: "Nothing yet, it's new",
};
export const KINDS = { startup: "I'm building a product to sell", organization: "We're fixing how our organization works" };
export const TIMING = { asap: 'As soon as possible', soon: 'In the next few months', exploring: 'Just exploring' };
export const BLOCKS = ['list', 'table', 'form', 'calendar', 'chart', 'map', 'messages', 'cards', 'payments', 'signin', 'stats', 'upload'];

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function clip(value, max) {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1).trim() + '…' : s;
}

export const isSid = (s) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);

const oneOf = (map, v) => (typeof v === 'string' && Object.hasOwn(map, v) ? v : '');

/* The visitor's answers, reduced to known fields, known enum values and
   bounded text. Returns null when the payload isn't an object. */
export function cleanAnswers(a) {
  if (!a || typeof a !== 'object') return null;
  return {
    idea: clip(a.idea, 600),
    followup_q: clip(a.followup_q, 200),
    followup: clip(a.followup, 600),
    users: Array.isArray(a.users) ? [...new Set(a.users.map((u) => oneOf(USERS, u)).filter(Boolean))] : [],
    platform: oneOf(PLATFORMS, a.platform),
    today: oneOf(TODAY, a.today),
    today_detail: clip(a.today_detail, 300),
    musts: Array.isArray(a.musts) ? a.musts.slice(0, 3).map((m) => clip(m, 120)).filter(Boolean) : [],
    kind: oneOf(KINDS, a.kind),
    timing: oneOf(TIMING, a.timing),
  };
}

/* --- session tickets: `${sid}.${expiry}.${hmac}`, issued once Turnstile passes --- */

const enc = new TextEncoder();
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export function hmacKey(secret, usages = ['sign', 'verify']) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usages);
}

const TICKET_TTL = 3 * 60 * 60; // seconds

export async function makeTicket(env, sid) {
  const payload = `${sid}.${Math.floor(Date.now() / 1000) + TICKET_TTL}`;
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env.SKETCH_SECRET), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

export async function verifyTicket(env, ticket, sid) {
  if (typeof ticket !== 'string') return false;
  const [tsid, exp, sig] = ticket.split('.');
  if (tsid !== sid || !/^\d+$/.test(exp || '') || !sig || Number(exp) < Date.now() / 1000) return false;
  try {
    return await crypto.subtle.verify('HMAC', await hmacKey(env.SKETCH_SECRET), unb64url(sig), enc.encode(`${tsid}.${exp}`));
  } catch {
    return false;
  }
}

export async function verifyTurnstile(env, token, ip) {
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: form, signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

/* Both endpoints let a request in with this session's ticket, or else a fresh
   Turnstile token, which earns a new ticket (`issued`). The page retries with a
   token when a ticket has expired. */
export async function admit(env, body, ip) {
  if (await verifyTicket(env, body.ticket, body.sid)) return { ok: true, issued: null };
  if (!(await verifyTurnstile(env, body.turnstile, ip))) return { ok: false, issued: null };
  return { ok: true, issued: await makeTicket(env, body.sid) };
}

export const turnstileConfigured = (env) => Boolean(env.TURNSTILE_SITEKEY && env.TURNSTILE_SECRET && env.SKETCH_SECRET && env.SKETCH_KV);
export const claudeConfigured = (env) => Boolean(env.ANTHROPIC_API_KEY && turnstileConfigured(env));
export const sendConfigured = (env) => Boolean(env.WEBSITE_FORM_SECRET && env.BUSINESS_OS_WEBHOOK_URL && turnstileConfigured(env));

/* Rate-limit counters. KV is eventually consistent, so they're approximate,
   which is fine for a cap. Check every limit with usedUp before counting any
   with countUse, so a refused request doesn't count against the others. */
export async function usedUp(env, key, limit) {
  return parseInt((await env.SKETCH_KV.get(key)) || '0', 10) >= limit;
}

export async function countUse(env, key, ttlSeconds) {
  const used = parseInt((await env.SKETCH_KV.get(key)) || '0', 10);
  await env.SKETCH_KV.put(key, String(used + 1), { expirationTtl: ttlSeconds });
}

export const clientIp = (request) => request.headers.get('CF-Connecting-IP') || 'unknown';
export const today = () => new Date().toISOString().slice(0, 10);
