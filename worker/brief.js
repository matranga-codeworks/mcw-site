/* /api/brief — sends a finished /start sketch to Business OS.

   POST { sid, ticket, answers, sketch, brief, used_claude, contact }
     → { ok: true } once Business OS has it; 400 { error, fields } for a field
       Business OS rejected (start.js points at the email field); 403 without a
       valid ticket or Turnstile token; 429 over the
       limits; 502/503 when Business OS can't be reached or isn't configured,
       and start.js offers a prefilled email instead.

   The lead goes to Business OS's website form webhook (PIP-6), signed with
   WEBSITE_FORM_SECRET (HMAC-SHA256 of the body, X-Signature-256). Business OS
   creates the client, contact and opportunity (lead source: Website form) and
   puts `message` on the client's timeline. The id makes a resend of the same
   sketch a no-op there. */

import {
  BLOCKS, KINDS, PLATFORMS, TIMING, TODAY, USERS,
  admit, cleanAnswers, clientIp, clip, countUse, hmacKey, isSid, json, sendConfigured, today, usedUp,
} from './shared.js';

const SESSION_SENDS = 3;
const IP_SENDS_PER_DAY = 5;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

const cleanMusts = (list) => (Array.isArray(list) ? list : []).slice(0, 3).map((m) => clip(m, 90)).filter(Boolean);

function cleanBrief(b, answers) {
  b = b && typeof b === 'object' ? b : {};
  return {
    title: clip(b.title, 48) || 'Your app',
    summary: clip(b.summary, 360),
    who: clip(b.who, 90),
    replaces: clip(b.replaces, 90),
    musts: cleanMusts(b.musts).length ? cleanMusts(b.musts) : cleanMusts(answers.musts),
  };
}

function cleanScreens(sketch) {
  const screens = Array.isArray(sketch?.screens) ? sketch.screens : [];
  return screens.slice(0, 4).map((s) => ({
    name: clip(s?.name, 28),
    blocks: (Array.isArray(s?.blocks) ? s.blocks : []).filter((b) => BLOCKS.includes(b?.kind)).slice(0, 4)
      .map((b) => `${clip(b.label, 32)} (${b.kind})`),
  })).filter((s) => s.name);
}

/* Plain text: Business OS shows it as a note on the client's timeline. */
function compose({ answers: a, brief: b, screens, usedClaude, sid }) {
  const lines = [
    'Project sketch from matrangacode.works/start',
    '',
    b.title,
    b.summary,
    '',
    `For: ${b.who || a.users.map((u) => USERS[u]).join(', ')}`,
    `Mostly on: ${PLATFORMS[a.platform] || '—'}`,
    `Replaces: ${b.replaces || TODAY[a.today] || '—'}`,
    `Situation: ${KINDS[a.kind] || '—'}`,
    `Wants to start: ${TIMING[a.timing] || '—'}`,
    '',
    'It has to:',
    ...b.musts.map((m, i) => `${i + 1}. ${m}`),
  ];
  if (screens.length) {
    lines.push('', 'Screens sketched:');
    for (const s of screens) lines.push(`- ${s.name}: ${s.blocks.join(', ')}`);
  }
  lines.push(
    '',
    'In their own words',
    `Idea: ${a.idea}`,
  );
  if (a.followup_q) lines.push(`Asked: ${a.followup_q}`, `Answered: ${a.followup || '—'}`);
  lines.push(
    `Who uses it: ${a.users.map((u) => USERS[u]).join(', ') || '—'}`,
    `Done today with: ${TODAY[a.today] || '—'}${a.today_detail ? ` (${a.today_detail})` : ''}`,
    `Must-dos as typed: ${a.musts.join(' | ') || '—'}`,
    '',
    usedClaude
      ? 'The working title, screens and brief were drafted by Claude from these answers.'
      : 'Claude was unavailable; the sketch was drawn from the answers by the page itself.',
    `Sketch ${sid}`,
  );
  return lines.join('\n');
}

export async function handlePost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const contact = body?.contact && typeof body.contact === 'object' ? body.contact : {};
  // The hidden "website" field is a honeypot: pretend it worked.
  if (contact.website) return json({ ok: true });

  const answers = cleanAnswers(body?.answers);
  if (!isSid(body?.sid) || !answers || !answers.idea) return json({ error: 'bad_request' }, 400);
  if (!sendConfigured(env)) return json({ error: 'unavailable' }, 503);
  const ip = clientIp(request);
  // A ticket from /api/sketch, or a Turnstile token when Claude was never
  // reached (not configured, failed) or the ticket expired.
  if (!(await admit(env, body, ip)).ok) return json({ error: 'challenge' }, 403);

  const name = clip(contact.name, 200);
  const email = clip(contact.email, 254).toLowerCase();
  if (!name) return json({ error: 'invalid', fields: ['name'] }, 400);
  if (!EMAIL.test(email)) return json({ error: 'invalid', fields: ['email'] }, 400);

  // Checked now, counted only once Business OS has the lead, so a failed send
  // doesn't use up the visitor's retries.
  const limits = [
    [`brief:s:${body.sid}`, SESSION_SENDS, 24 * 60 * 60],
    [`brief:ip:${ip}:${today()}`, IP_SENDS_PER_DAY, 2 * 24 * 60 * 60],
  ];
  for (const [key, limit] of limits) if (await usedUp(env, key, limit)) return json({ error: 'limit' }, 429);

  const brief = cleanBrief(body.brief, answers);
  const payload = JSON.stringify({
    id: `sketch-${body.sid}`,
    name,
    email,
    company: clip(contact.company, 200),
    phone: clip(contact.phone, 40),
    subject: clip(`Project sketch: ${brief.title}`, 200),
    message: compose({ answers, brief, screens: cleanScreens(body.sketch), usedClaude: body.used_claude === true, sid: body.sid })
      .slice(0, 10000),
  });
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(env.WEBSITE_FORM_SECRET, ['sign']), new TextEncoder().encode(payload));

  let res;
  try {
    res = await fetch(env.BUSINESS_OS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Signature-256': `sha256=${hex(signature)}` },
      body: payload,
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    console.error('brief_webhook_unreachable', String(err?.message || err).slice(0, 80));
    return json({ error: 'unreachable' }, 502);
  }
  if (res.status === 200 || res.status === 201) {
    for (const [key, , ttl] of limits) await countUse(env, key, ttl);
    return json({ ok: true });
  }
  if (res.status === 400) {
    const data = await res.json().catch(() => ({}));
    return json({ error: 'invalid', fields: Object.keys(data?.errors || {}) }, 400);
  }
  console.error('brief_webhook_failed', res.status);
  return json({ error: 'failed' }, 502);
}
