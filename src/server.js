const http = require('node:http');
const { getRouter } = require('stremio-addon-sdk');
const { parseProxyToken, getSubtitleFromArchiveUrl } = require('./archiveProxy');

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
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

function createRequestHandler(addonInterface) {
  const router = getRouter(addonInterface);

  return async (req, res) => {
    if (await handleSubfile(req, res)) {
      return;
    }

    const shouldPatchSubtitlesResponse = /^\/subtitles\//.test(req.url || '');
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
