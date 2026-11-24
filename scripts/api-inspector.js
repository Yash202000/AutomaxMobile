#!/usr/bin/env node
/* eslint-disable */
// Local API Inspector (dev only) — a browser "Network" tab for the app.
//
//   npm run api-inspector        then open http://localhost:9091
//
// Dev builds with EXPO_PUBLIC_DEBUG_API_LOGS=true post every axios request /
// response here (src/api/apiLogger.ts). The page lists them live; click one to
// see headers + bodies and "Copy as cURL" to share with backend.
// Nothing leaves your machine. Calls are kept in memory (last 500).

const http = require('http');
const { execFile } = require('child_process');

const PORT = Number(process.env.API_INSPECTOR_PORT || 9091);
const MAX_CALLS = 500;

const calls = new Map(); // id -> call
const clients = new Set(); // SSE responses

const broadcast = (call) => {
  const payload = `data: ${JSON.stringify(call)}\n\n`;
  for (const res of clients) res.write(payload);
};

const upsert = (event) => {
  const existing = calls.get(event.id) || {};
  const call = { ...existing, ...event };
  calls.set(event.id, call);
  while (calls.size > MAX_CALLS) calls.delete(calls.keys().next().value);
  broadcast(call);
};

const readBody = (req) =>
  new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/events') {
    try {
      upsert(JSON.parse(await readBody(req)));
      res.writeHead(204).end();
    } catch {
      res.writeHead(400).end();
    }
    return;
  }
  if (req.url === '/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (req.url === '/calls') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify([...calls.values()]));
    return;
  }
  if (req.method === 'POST' && req.url === '/clear') {
    calls.clear();
    broadcast({ cleared: true });
    res.writeHead(204).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(PAGE);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use — the API Inspector is probably already running: http://localhost:${PORT}`);
    console.error(`(stop it, or use another port: API_INSPECTOR_PORT=9092 npm run api-inspector — the app expects ${PORT})`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`API Inspector: http://localhost:${PORT}`);
  // Physical Android devices over USB reach the Mac's localhost through adb.
  execFile('adb', ['reverse', `tcp:${PORT}`, `tcp:${PORT}`], (err) => {
    console.log(
      err
        ? '  (adb not available — Android devices on USB need: adb reverse tcp:' + PORT + ' tcp:' + PORT + ')'
        : `  adb reverse tcp:${PORT} set for connected Android devices`,
    );
  });
});

const PAGE = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>API Inspector</title>
<style>
  :root { --bg:#fff; --fg:#1f2328; --muted:#6b7280; --line:#e5e7eb; --sel:#eef2ff; --head:#f8fafc;
          --ok:#15803d; --warn:#b45309; --err:#b91c1c; --accent:#4d77ff; --code:#f6f8fa; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#16181d; --fg:#e6e6e6; --muted:#9aa0a6; --line:#2c2f36; --sel:#1f2a44; --head:#1c1f25;
            --ok:#4ade80; --warn:#fbbf24; --err:#f87171; --accent:#7c9cff; --code:#1c1f25; }
  }
  * { box-sizing: border-box; }
  body { margin:0; font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:var(--bg); color:var(--fg); }
  header { display:flex; gap:8px; align-items:center; padding:8px 12px; border-bottom:1px solid var(--line); background:var(--head); position:sticky; top:0; }
  header h1 { font-size:14px; margin:0 8px 0 0; }
  input { flex:1; max-width:420px; padding:6px 8px; border:1px solid var(--line); border-radius:6px; background:var(--bg); color:var(--fg); }
  button { padding:6px 10px; border:1px solid var(--line); border-radius:6px; background:var(--bg); color:var(--fg); cursor:pointer; }
  button:hover { border-color:var(--accent); }
  .dot { width:8px; height:8px; border-radius:50%; background:var(--err); }
  .dot.on { background:var(--ok); }
  main { display:grid; grid-template-columns: minmax(380px, 45%) 1fr; height:calc(100vh - 45px); }
  #list { overflow:auto; border-right:1px solid var(--line); }
  table { width:100%; border-collapse:collapse; }
  th, td { text-align:left; padding:5px 8px; border-bottom:1px solid var(--line); white-space:nowrap; }
  th { position:sticky; top:0; background:var(--head); font-weight:600; color:var(--muted); }
  td.url { max-width:0; overflow:hidden; text-overflow:ellipsis; width:100%; }
  tr { cursor:pointer; }
  tr.sel { background:var(--sel); }
  .s2 { color:var(--ok); } .s3 { color:var(--warn); } .s4, .s5, .serr { color:var(--err); } .spend { color:var(--muted); }
  #detail { overflow:auto; padding:12px 16px; }
  #detail h2 { font-size:14px; margin:0 0 4px; word-break:break-all; }
  #detail h3 { font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); margin:16px 0 6px; }
  pre { margin:0; padding:10px; background:var(--code); border:1px solid var(--line); border-radius:6px; overflow:auto; white-space:pre-wrap; word-break:break-all; font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace; }
  .actions { display:flex; gap:8px; margin:10px 0; flex-wrap:wrap; }
  .empty { color:var(--muted); padding:24px; }
  .toast { position:fixed; bottom:16px; right:16px; background:var(--fg); color:var(--bg); padding:8px 12px; border-radius:6px; opacity:0; transition:opacity .2s; }
  .toast.show { opacity:1; }
  @media (max-width: 800px) { main { grid-template-columns:1fr; grid-template-rows:45% 55%; } #list { border-right:0; border-bottom:1px solid var(--line); } }
</style>
</head>
<body>
<header>
  <span class="dot" id="conn" title="Live connection"></span>
  <h1>API Inspector</h1>
  <input id="filter" placeholder="Filter by URL, method or status">
  <button id="clear">Clear</button>
</header>
<main>
  <div id="list">
    <table><thead><tr><th>Time</th><th>Method</th><th>Status</th><th>URL</th><th>ms</th></tr></thead><tbody id="rows"></tbody></table>
    <div class="empty" id="empty">Waiting for API calls from the app…</div>
  </div>
  <div id="detail"><div class="empty">Select a call to see its request and response.</div></div>
</main>
<div class="toast" id="toast"></div>
<script>
  const calls = new Map();
  let selected = null;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const pretty = (body) => {
    if (body === undefined || body === null || body === '') return '';
    if (typeof body === 'string') { try { return JSON.stringify(JSON.parse(body), null, 2); } catch { return body; } }
    return JSON.stringify(body, null, 2);
  };
  const headersText = (h) => h ? Object.entries(h).map(([k, v]) => k + ': ' + v).join('\\n') : '';
  const statusClass = (c) => c.error && !c.status ? 'serr' : !c.status ? 'spend' : 's' + String(c.status)[0];
  const statusText = (c) => c.status || (c.error ? 'ERR' : '…');
  const q = (s) => "'" + String(s).replace(/'/g, "'\\\\''") + "'";

  const toCurl = (c) => {
    const parts = ['curl -X ' + c.method + ' ' + q(c.url)];
    for (const [k, v] of Object.entries(c.requestHeaders || {})) {
      if (v === undefined || v === null || /^content-length$/i.test(k)) continue;
      parts.push('-H ' + q(k + ': ' + v));
    }
    if (c.requestBody !== undefined && c.requestBody !== null && c.requestBody !== '') {
      if (c.requestBody === '[FormData]') parts.push("# multipart/form-data body not captured");
      else parts.push('--data-raw ' + q(typeof c.requestBody === 'string' ? c.requestBody : JSON.stringify(c.requestBody)));
    }
    return parts.join(' \\\\\\n  ');
  };

  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); }
    catch { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
    const toast = $('toast'); toast.textContent = what + ' copied'; toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1200);
  };

  const matches = (c) => {
    const f = $('filter').value.trim().toLowerCase();
    return !f || (c.method + ' ' + c.url + ' ' + (c.status || '')).toLowerCase().includes(f);
  };

  const render = () => {
    const list = [...calls.values()].filter(matches).reverse();
    $('empty').style.display = calls.size ? 'none' : 'block';
    $('rows').innerHTML = list.map((c) =>
      '<tr data-id="' + esc(c.id) + '" class="' + (c.id === selected ? 'sel' : '') + '">' +
      '<td>' + esc(new Date(c.startedAt).toLocaleTimeString()) + '</td>' +
      '<td>' + esc(c.method) + '</td>' +
      '<td class="' + statusClass(c) + '">' + esc(statusText(c)) + '</td>' +
      '<td class="url" title="' + esc(c.url) + '">' + esc(c.url.replace(/^https?:\\/\\/[^/]+/, '')) + '</td>' +
      '<td>' + esc(c.durationMs ?? '') + '</td></tr>').join('');
    renderDetail();
  };

  const renderDetail = () => {
    const c = calls.get(selected);
    if (!c) { $('detail').innerHTML = '<div class="empty">Select a call to see its request and response.</div>'; return; }
    $('detail').innerHTML =
      '<h2>' + esc(c.method) + ' ' + esc(c.url) + '</h2>' +
      '<div class="' + statusClass(c) + '">' + esc(statusText(c)) + (c.durationMs != null ? ' · ' + esc(c.durationMs) + ' ms' : '') + (c.error ? ' · ' + esc(c.error) : '') + '</div>' +
      '<div class="actions"><button id="cpCurl">Copy as cURL</button><button id="cpRes">Copy response</button><button id="cpReq">Copy request body</button></div>' +
      '<h3>cURL</h3><pre>' + esc(toCurl(c)) + '</pre>' +
      '<h3>Request headers</h3><pre>' + esc(headersText(c.requestHeaders) || '—') + '</pre>' +
      '<h3>Request body</h3><pre>' + esc(pretty(c.requestBody) || '—') + '</pre>' +
      '<h3>Response headers</h3><pre>' + esc(headersText(c.responseHeaders) || '—') + '</pre>' +
      '<h3>Response body</h3><pre>' + esc(pretty(c.responseBody) || (c.status ? '—' : 'Waiting…')) + '</pre>';
    $('cpCurl').onclick = () => copy(toCurl(c), 'cURL');
    $('cpRes').onclick = () => copy(pretty(c.responseBody), 'Response');
    $('cpReq').onclick = () => copy(pretty(c.requestBody), 'Request body');
  };

  $('rows').addEventListener('click', (e) => {
    const tr = e.target.closest('tr'); if (!tr) return;
    selected = tr.dataset.id; render();
  });
  $('filter').addEventListener('input', render);
  $('clear').addEventListener('click', async () => { await fetch('/clear', { method: 'POST' }); });

  fetch('/calls').then((r) => r.json()).then((list) => { list.forEach((c) => calls.set(c.id, c)); render(); });
  const connect = () => {
    const es = new EventSource('/stream');
    es.onopen = () => $('conn').classList.add('on');
    es.onerror = () => $('conn').classList.remove('on');
    es.onmessage = (e) => {
      const c = JSON.parse(e.data);
      if (c.cleared) { calls.clear(); selected = null; render(); return; }
      calls.set(c.id, c); render();
    };
  };
  connect();
</script>
</body>
</html>`;
