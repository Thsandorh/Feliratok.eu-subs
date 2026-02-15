const http = require('node:http');
const { getRouter } = require('stremio-addon-sdk');
const { parseProxyToken, getSubtitleFromArchiveUrl } = require('./archiveProxy');

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function sendHtml(res, status, html) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

function normalizeAppBasePath(input) {
  const raw = String(input || '').trim();
  if (!raw || raw === '/') {
    return '';
  }

  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, '');
  return withoutTrailingSlash === '/' ? '' : withoutTrailingSlash;
}

function stripBasePathFromUrl(url, appBasePath) {
  const [path, query = ''] = String(url || '/').split('?');
  if (!appBasePath) {
    return { matched: true, strippedUrl: String(url || '/') };
  }

  if (path === appBasePath || path === `${appBasePath}/`) {
    return { matched: true, strippedUrl: `/${query ? `?${query}` : ''}` };
  }

  const prefix = `${appBasePath}/`;
  if (!path.startsWith(prefix)) {
    return { matched: false, strippedUrl: String(url || '/') };
  }

  const strippedPath = path.slice(appBasePath.length);
  return { matched: true, strippedUrl: `${strippedPath}${query ? `?${query}` : ''}` };
}

function getRequestBaseUrl(req) {
  const forwardedProto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = forwardedProto || (req.socket.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || '127.0.0.1';
  return `${proto}://${host}`;
}

function getPublicBaseUrl(req, appBasePath) {
  return `${getRequestBaseUrl(req)}${appBasePath}`;
}

function absolutizeSubtitleUrls(payload, req, appBasePath) {
  if (!payload || !Array.isArray(payload.subtitles)) {
    return payload;
  }

  const base = getPublicBaseUrl(req, appBasePath);
  payload.subtitles = payload.subtitles.map((sub) => {
    if (typeof sub?.url !== 'string') {
      return sub;
    }

    if (appBasePath && sub.url.startsWith(`${appBasePath}/`)) {
      return { ...sub, url: `${getRequestBaseUrl(req)}${sub.url}` };
    }

    if (sub.url.startsWith('/')) {
      return { ...sub, url: `${base}${sub.url}` };
    }

    return sub;
  });

  return payload;
}

function configManifestUrl(baseUrl, lang) {
  const config = encodeURIComponent(JSON.stringify({ lang }));
  return `${baseUrl}/${config}/manifest.json`;
}

function configurePageHtml(baseUrl) {
  const hun = configManifestUrl(baseUrl, 'hun');
  const eng = configManifestUrl(baseUrl, 'eng');
  const all = `${baseUrl}/manifest.json`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Feliratok.eu Subtitles - Configure</title>
  <style>
    :root {
      --bg: #0b1020;
      --card: rgba(19, 28, 55, 0.88);
      --line: rgba(255,255,255,0.14);
      --txt: #e6eeff;
      --muted: #9fb1d9;
      --primary: #6ea8fe;
      --primary2: #5a7fff;
      --ok: #79f2b3;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      color: var(--txt);
      background: radial-gradient(1200px 600px at 10% 0%, #1d2a52 0%, #0b1020 45%, #060914 100%);
      display: grid;
      place-items: center;
      padding: 28px 16px;
    }
    .wrap { width: min(840px, 100%); }
    .card {
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 24px;
      background: var(--card);
      backdrop-filter: blur(8px);
      box-shadow: 0 14px 48px rgba(0,0,0,.4);
    }
    h1 { margin: 0 0 8px; font-size: clamp(1.5rem, 3vw, 2.1rem); }
    p.lead { margin: 0 0 20px; color: var(--muted); }
    label { display: block; margin-bottom: 8px; color: var(--muted); font-size: .95rem; }
    select, input {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px 14px;
      color: var(--txt);
      background: rgba(10, 16, 35, .8);
      outline: none;
    }
    select:focus, input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(110,168,254,.22); }
    .row { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit,minmax(200px,1fr)); margin-top: 14px; }
    button {
      border: 0;
      border-radius: 12px;
      padding: 12px 14px;
      cursor: pointer;
      font-weight: 600;
      transition: transform .08s ease, filter .15s ease;
    }
    button:active { transform: translateY(1px); }
    .btn-primary { color: #0a0f22; background: linear-gradient(135deg, var(--primary), var(--primary2)); }
    .btn-ghost { color: var(--txt); background: rgba(255,255,255,0.08); border: 1px solid var(--line); }
    .small { color: var(--muted); margin-top: 10px; font-size: .9rem; }
    .badge {
      display: inline-flex; align-items: center; gap: 8px;
      margin-top: 14px; padding: 6px 10px; border-radius: 999px;
      background: rgba(121,242,179,.12); border: 1px solid rgba(121,242,179,.3); color: var(--ok); font-size: .85rem;
    }
    code { color: #b6cbff; }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="card">
      <h1>Feliratok.eu Subtitles for Stremio</h1>
      <p class="lead">Pick your preferred subtitle language, then install directly in Stremio or copy the dynamic manifest URL.</p>

      <label for="lang">Subtitle language</label>
      <select id="lang">
        <option value="all">All languages</option>
        <option value="hun">Hungarian</option>
        <option value="eng">English</option>
      </select>

      <label for="manifestUrl" style="margin-top:12px;">Dynamic manifest URL</label>
      <input id="manifestUrl" type="text" readonly value="${all}" />

      <div class="row">
        <a id="openStremioBtn" class="btn-primary" href="#" style="text-align:center;text-decoration:none;display:block;">Open in Stremio</a>
        <button id="copyBtn" class="btn-ghost">Copy Manifest URL</button>
      </div>

      <p class="small">Stremio button uses the native install URI format: <code>stremio://&lt;host&gt;/.../manifest.json</code>.</p>
      <div class="badge">⚡ Powered by Feliratok.eu + Wyzie subtitle sources</div>
    </section>
  </main>

  <script>
    const urls = { all: ${JSON.stringify(all)}, hun: ${JSON.stringify(hun)}, eng: ${JSON.stringify(eng)} };
    const lang = document.getElementById('lang');
    const manifest = document.getElementById('manifestUrl');
    const copyBtn = document.getElementById('copyBtn');
    const openBtn = document.getElementById('openStremioBtn');

    function toStremioInstallUrl(manifestUrl) {
      const u = new URL(manifestUrl);
      return 'stremio://' + u.host + u.pathname + u.search;
    }

    function sync() {
      const manifestUrl = urls[lang.value] || urls.all;
      manifest.value = manifestUrl;
      openBtn.href = toStremioInstallUrl(manifestUrl);
    }

    lang.addEventListener('change', sync);

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(manifest.value);
        copyBtn.textContent = 'Copied ✅';
        setTimeout(() => (copyBtn.textContent = 'Copy Manifest URL'), 1200);
      } catch {
        manifest.focus();
        manifest.select();
      }
    });

    sync();
  </script>
</body>
</html>`;
}

async function handleSubfile(req, res) {
  try {
    const match = req.url.match(/^\/subfile\/([^/.]+)\.srt$/);
    if (!match) {
      return false;
    }

    const token = match[1];
    const { originalUrl, season, episode } = parseProxyToken(token);
    const subtitleBuffer = await getSubtitleFromArchiveUrl(originalUrl, season, episode);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/x-subrip; charset=utf-8');
    res.end(subtitleBuffer);
    return true;
  } catch (error) {
    console.error('[subfile-error]', error);
    sendJson(res, 500, { err: 'failed to extract subtitle from archive' });
    return true;
  }
}

function maybeHandleConfigure(req, res) {
  const path = (req.url || '').split('?')[0];

  if (path === '/' || path === '/configure') {
    sendHtml(res, 200, configurePageHtml(req.publicBaseUrl || getRequestBaseUrl(req)));
    return true;
  }

  return false;
}

function createRequestHandler(addonInterface, options = {}) {
  const appBasePath = normalizeAppBasePath(options.appBasePath || process.env.APP_BASE_PATH);
  const router = getRouter(addonInterface);

  return async (req, res) => {
    const { matched, strippedUrl } = stripBasePathFromUrl(req.url || '/', appBasePath);
    if (!matched) {
      sendJson(res, 404, { err: 'not found' });
      return;
    }

    const originalUrl = req.url;
    req.url = strippedUrl;
    req.publicBaseUrl = getPublicBaseUrl(req, appBasePath);

    if (maybeHandleConfigure(req, res)) {
      req.url = originalUrl;
      return;
    }

    if (await handleSubfile(req, res)) {
      req.url = originalUrl;
      return;
    }

    const shouldPatchSubtitlesResponse = /\/subtitles\//.test(req.url || '');
    if (shouldPatchSubtitlesResponse) {
      const originalEnd = res.end.bind(res);
      res.end = (chunk, ...args) => {
        try {
          const asString = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk || '');
          const payload = JSON.parse(asString);
          const patched = absolutizeSubtitleUrls(payload, req, appBasePath);
          return originalEnd(JSON.stringify(patched), ...args);
        } catch {
          return originalEnd(chunk, ...args);
        }
      };
    }

    router(req, res, () => {
      req.url = originalUrl;
      sendJson(res, 404, { err: 'not found' });
    });
  };
}

function startServer({ addonInterface, port, appBasePath }) {
  const handler = createRequestHandler(addonInterface, { appBasePath });
  const server = http.createServer((req, res) => {
    Promise.resolve(handler(req, res)).catch((error) => {
      console.error('[server-error]', error);
      sendJson(res, 500, { err: 'internal server error' });
    });
  });

  server.listen(port);
  return server;
}

module.exports = {
  createRequestHandler,
  startServer
};
