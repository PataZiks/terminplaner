// Cloudflare Worker for Schulplaner
// Bindings required (set in Cloudflare dashboard):
//   KV namespace binding: PLANNER_KV
//   Secrets: PUSHOVER_TOKEN, PUSHOVER_USER, WRITE_SECRET
//
// Routes:
//   GET  /entries              -> current saved entries (JSON array)
//   POST /entries               body: { secret, entries: [...] } -> saves entries
//   POST /test-push             body: { secret } -> sends immediate Pushover push for all upcoming entries
//   (cron) scheduled trigger    -> sends daily reminders for entries due in 0/1/3 days

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function daysUntil(dateStr, now) {
  const t = new Date(now); t.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T12:00:00Z');
  return Math.round((d - t) / 86400000);
}

async function loadEntries(env) {
  const raw = await env.PLANNER_KV.get('entries');
  return raw ? JSON.parse(raw) : [];
}

async function sendPushover(env, title, message, priority) {
  const fd = new FormData();
  fd.append('token', env.PUSHOVER_TOKEN);
  fd.append('user', env.PUSHOVER_USER);
  fd.append('title', title);
  fd.append('message', message);
  fd.append('priority', String(priority));
  const res = await fetch('https://api.pushover.net/1/messages.json', { method: 'POST', body: fd });
  const j = await res.json();
  return j.status === 1;
}

async function handleTestPush(env) {
  const now = new Date();
  const entries = await loadEntries(env);
  const upcoming = entries
    .filter((e) => daysUntil(e.date, now) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  let ok = 0;
  for (const e of upcoming) {
    const d = daysUntil(e.date, now);
    const w = d === 0 ? 'Heute' : d === 1 ? 'Morgen' : `in ${d} Tagen`;
    const msg = e.time ? `${e.title} um ${e.time} Uhr` : e.title;
    const sent = await sendPushover(env, `${w}: ${e.title}`, msg, 0);
    if (sent) ok++;
  }
  return { sent: ok, total: upcoming.length };
}

async function runDailyReminders(env) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const lastRun = await env.PLANNER_KV.get('lastRun');
  if (lastRun === today) return { skipped: true };

  const entries = await loadEntries(env);
  let sent = 0;
  for (const days of [3, 1, 0]) {
    const label = days === 0 ? 'Heute' : days === 1 ? 'Morgen' : 'In 3 Tagen';
    const targets = entries.filter((e) => daysUntil(e.date, now) === days);
    for (const e of targets) {
      const msg = e.time ? `${e.title} um ${e.time} Uhr` : e.title;
      const ok = await sendPushover(env, `${label}: ${e.title}`, msg, -1);
      if (ok) sent++;
    }
  }
  await env.PLANNER_KV.put('lastRun', today);
  return { sent };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    if (url.pathname === '/entries' && request.method === 'GET') {
      const entries = await loadEntries(env);
      return json(entries);
    }

    if (url.pathname === '/entries' && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      if (!body || body.secret !== env.WRITE_SECRET) return json({ error: 'unauthorized' }, 401);
      if (!Array.isArray(body.entries)) return json({ error: 'entries must be an array' }, 400);
      await env.PLANNER_KV.put('entries', JSON.stringify(body.entries));
      return json({ ok: true });
    }

    if (url.pathname === '/test-push' && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      if (!body || body.secret !== env.WRITE_SECRET) return json({ error: 'unauthorized' }, 401);
      const result = await handleTestPush(env);
      return json(result);
    }

    return json({ error: 'not found' }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDailyReminders(env));
  },
};
