const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function makeTempPath(prefix, ext) {
  const name = `${prefix}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}${ext || ''}`;
  return path.join(os.tmpdir(), name);
}

function runCurl(args, encoding = 'utf8') {
  return new Promise((resolve, reject) => {
    execFile(
      'curl',
      args,
      { maxBuffer: parsePositiveInt(process.env.CURL_MAX_STDIO_BYTES, 6 * 1024 * 1024), encoding },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`curl failed: ${stderr || error.message}`));
          return;
        }
        resolve(stdout);
      }
    );
  });
}

function curlArgs(url) {
  return ['-L', '--silent', '--show-error', '--max-time', '45', '-A', 'Mozilla/5.0', url];
}

async function fetchText(url) {
  return runCurl(curlArgs(url), 'utf8');
}

async function fetchBuffer(url) {
  const maxBytes = parsePositiveInt(process.env.CURL_MAX_DOWNLOAD_BYTES, 25 * 1024 * 1024);
  const outFile = makeTempPath('feliratok-curl', '.bin');

  try {
    // Write directly to a temp file so curl output does not sit in Node's stdout buffer.
    // Limits protect the host from large season packs / zip bombs.
    await runCurl([...curlArgs(url), '--max-filesize', String(maxBytes), '--output', outFile], 'utf8');
    const buf = await fs.readFile(outFile);
    if (buf.length > maxBytes) {
      throw new Error(`download too large: ${buf.length} bytes (limit ${maxBytes})`);
    }
    return buf;
  } finally {
    await fs.unlink(outFile).catch(() => {});
  }
}

async function fetchJson(url) {
  const raw = await fetchText(url);
  return JSON.parse(raw);
}

module.exports = {
  fetchText,
  fetchBuffer,
  fetchJson
};
