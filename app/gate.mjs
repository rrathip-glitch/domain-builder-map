// PIN gate for hosted deployments (Railway). Owned by the orchestrator; app/server.mjs is untouched.
// Listens on PORT, starts the real app on an internal port, and proxies to it once the visitor
// has entered the PIN in APP_PIN. With no APP_PIN set it is a plain pass-through.
//   APP_PIN=<pin> PORT=8080 node app/gate.mjs
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as newsletter from './newsletter.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const INTERNAL = Number(process.env.INTERNAL_PORT) || 4174;
const PIN = (process.env.APP_PIN || '').trim();
const TOKEN = PIN ? crypto.createHash('sha256').update('domain-builder-map:' + PIN).digest('hex') : '';
const COOKIE = 'dbm_pin';

const child = spawn(process.execPath, [path.join(HERE, 'server.mjs')], {
  env: { ...process.env, PORT: String(INTERNAL), HOST: '127.0.0.1' }, stdio: 'inherit',
});
child.on('exit', (code) => { console.error('app server exited', code); process.exit(code || 1); });
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { child.kill(sig); process.exit(0); });

const page = (msg = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Domain builder map</title>
<style>body{font:16px/1.4 system-ui,sans-serif;background:#0f1b33;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}
form{background:#fff;color:#111;padding:28px 32px;border-radius:10px;width:min(320px,86vw)}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 16px;color:#555;font-size:14px}
input{font:inherit;font-size:22px;letter-spacing:.3em;width:100%;box-sizing:border-box;padding:10px;border:1px solid #bbb;border-radius:6px;text-align:center}
button{font:inherit;margin-top:12px;width:100%;padding:10px;border:0;border-radius:6px;background:#0f1b33;color:#fff;cursor:pointer}.e{color:#b00020;font-size:14px;margin-top:10px}</style></head>
<body><form method="post" action="/__pin"><h1>Domain builder map</h1><p>Enter the PIN to continue.</p>
<input name="pin" inputmode="numeric" autocomplete="off" autofocus aria-label="PIN"><button>Open</button>${msg ? `<div class="e">${msg}</div>` : ''}</form></body></html>`;

const authed = (req) => {
  if (!PIN) return true;
  const c = (req.headers.cookie || '').split(';').map((s) => s.trim()).find((s) => s.startsWith(COOKIE + '='));
  if (!c) return false;
  const v = c.slice(COOKIE.length + 1);
  return v.length === TOKEN.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(TOKEN));
};

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (url.pathname === '/robots.txt') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('User-agent: *\nDisallow: /\n'); }
  if (newsletter.handlePublic(req, res, url)) return;
  if (url.pathname === '/__pin') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 2000) req.destroy(); });
      req.on('end', () => {
        const pin = (new URLSearchParams(body).get('pin') || '').trim();
        if (PIN && pin === PIN) {
          const secure = (req.headers['x-forwarded-proto'] || '') === 'https' ? '; Secure' : '';
          res.writeHead(303, { 'set-cookie': `${COOKIE}=${TOKEN}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`, location: '/' });
          return res.end();
        }
        setTimeout(() => { res.writeHead(401, { 'content-type': 'text/html; charset=utf-8' }); res.end(page('That PIN is not right.')); }, 1200);
      });
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page());
  }
  if (!authed(req)) {
    if (url.pathname.startsWith('/api/')) { res.writeHead(401, { 'content-type': 'application/json' }); return res.end('{"error":"PIN required"}'); }
    res.writeHead(303, { location: '/__pin' }); return res.end();
  }
  if (url.pathname.startsWith('/newsletter/')) { try { if (await newsletter.handle(req, res, url)) return; } catch (e) { res.writeHead(500, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: 'newsletter error' })); } }
  const up = http.request({ host: '127.0.0.1', port: INTERNAL, method: req.method, path: req.url, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode || 502, r.headers); r.pipe(res);
  });
  up.on('error', () => { res.writeHead(502, { 'content-type': 'text/plain' }); res.end('The app is starting. Refresh in a few seconds.'); });
  req.pipe(up);
});
newsletter.startScheduler();
server.listen(PORT, '0.0.0.0', () => console.log(`PIN gate on :${PORT} -> app on :${INTERNAL} (${PIN ? 'PIN required' : 'no PIN set'})`));
