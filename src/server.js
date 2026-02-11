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

function getRequestBaseUrl(req) {
  const forwardedProto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = forwardedProto || (req.socket.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || '127.0.0.1';
  return `${proto}://${host}`;
}

function absolutizeSubtitleUrls(payload, req) {
  if (!payload || !Array.isArray(payload.subtitles)) {
    return payload;
  }

  const base = getRequestBaseUrl(req);
  payload.subtitles = payload.subtitles.map((sub) => {
    if (typeof sub?.url !== 'string') {
      return sub;
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
  <title>Feliratok.eu Stremio Addon - Configure</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 760px; margin: 30px auto; padding: 0 16px; }
    h1 { font-size: 24px; }
    .card { border: 1px solid #ddd; border-radius: 10px; padding: 16px; }
    label, select, button, input { font-size: 16px; }
    select, input { width: 100%; padding: 10px; margin-top: 8px; box-sizing: border-box; }
    button { margin-top: 12px; padding: 10px 14px; cursor: pointer; }
    .muted { color: #555; font-size: 14px; }
  </style>
</head>
<body>
  <h1>Feliratok.eu Stremio Addon - Configuration</h1>
  <div class="card">
    <label for="lang">Subtitle language</label>
    <select id="lang">
      <option value="all">All languages</option>
      <option value="hun">Hungarian</option>
      <option value="eng">English</option>
    </select>

    <label for="manifestUrl" style="margin-top:12px;display:block;">Dynamic manifest URL</label>
    <input id="manifestUrl" type="text" readonly value="${all}" />

    <button id="copyBtn">Copy Manifest URL</button>
    <button id="openStremioBtn">Open Stremio Manifest</button>
    <p class="muted">The button opens the manifest URL generated for the selected language.</p>
  </div>

  <script>
    const urls = { all: ${JSON.stringify(all)}, hun: ${JSON.stringify(hun)}, eng: ${JSON.stringify(eng)} };
    const lang = document.getElementById('lang');
    const manifest = document.getElementById('manifestUrl');
    const copyBtn = document.getElementById('copyBtn');
    const openBtn = document.getElementById('openStremioBtn');

    function sync() {
      manifest.value = urls[lang.value] || urls.all;
    }

    lang.addEventListener('change', sync);
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(manifest.value);
        copyBtn.textContent = 'Copied ✅';
        setTimeout(() => copyBtn.textContent = 'Copy Manifest URL', 1200);
      } catch {
        manifest.select();
      }
    });

    openBtn.addEventListener('click', () => {
      window.open(manifest.value, '_blank');
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

  if (path === '/') {
    res.statusCode = 302;
    res.setHeader('Location', '/configure');
    res.end();
    return true;
  }

  if (path === '/configure') {
    sendHtml(res, 200, configurePageHtml(getRequestBaseUrl(req)));
    return true;
  }

  return false;
}

function createRequestHandler(addonInterface) {
  const router = getRouter(addonInterface);

  return async (req, res) => {
    if (maybeHandleConfigure(req, res)) {
      return;
    }

    if (await handleSubfile(req, res)) {
      return;
    }

    const shouldPatchSubtitlesResponse = /\/subtitles\//.test(req.url || '');
    if (shouldPatchSubtitlesResponse) {
      const originalEnd = res.end.bind(res);
      res.end = (chunk, ...args) => {
        try {
          const asString = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk || '');
          const payload = JSON.parse(asString);
          const patched = absolutizeSubtitleUrls(payload, req);
          return originalEnd(JSON.stringify(patched), ...args);
        } catch {
          return originalEnd(chunk, ...args);
        }
      };
    }

    router(req, res, () => {
      sendJson(res, 404, { err: 'not found' });
    });
  };
}

function startServer({ addonInterface, port }) {
  const handler = createRequestHandler(addonInterface);
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
