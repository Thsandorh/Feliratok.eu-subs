const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

const BASE = 'http://127.0.0.1:7000';
let server;

async function waitForServer(timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/manifest.json`);
      if (res.ok) {
        return;
      }
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Addon server did not start in time');
}

async function getSubtitleList(path) {
  const res = await fetch(`${BASE}${path}`);
  assert.equal(res.ok, true, `Expected HTTP OK for ${path}`);
  const payload = await res.json();
  assert.ok(Array.isArray(payload.subtitles), `subtitles must be array for ${path}`);
  return payload.subtitles;
}

test.before(async () => {
  server = spawn(process.execPath, ['src/index.js'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '7000' }
  });

  server.stdout.on('data', () => {});
  server.stderr.on('data', () => {});

  await waitForServer();
});

test.after(async () => {
  if (!server || server.killed) {
    return;
  }
  server.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 300));
});

test('Finds subtitles for movie playback (The Matrix)', { timeout: 60000 }, async () => {
  const subtitles = await getSubtitleList('/subtitles/movie/tt0133093.json');
  assert.ok(subtitles.length > 0, 'Movie subtitles should not be empty');
});

test('Finds subtitles for series playback (Breaking Bad S01E01)', { timeout: 60000 }, async () => {
  const subtitles = await getSubtitleList('/subtitles/series/tt0903747.json?season=1&episode=1');
  assert.ok(subtitles.length > 0, 'Series subtitles should not be empty');
});

test('Finds and extracts subtitle from old season-pack series on-the-fly (Six Feet Under S01E01)', { timeout: 90000 }, async () => {
  const subtitles = await getSubtitleList('/subtitles/series/tt0248654.json?season=1&episode=1');
  assert.ok(subtitles.length > 0, 'Old series subtitles should not be empty');

  const seasonPackSubtitle = subtitles.find((sub) =>
    (String(sub.releaseInfo || '').includes('Évadpakk') || String(sub.releaseInfo || '').includes('Extraction: on-the-fly')) && /\/subfile\//.test(String(sub.url || ''))
  );

  assert.ok(seasonPackSubtitle, 'Expected an Évadpakk subtitle with local /subfile/ proxy URL');

  const subRes = await fetch(seasonPackSubtitle.url);
  assert.equal(subRes.ok, true, 'Expected subfile endpoint to return HTTP 200');

  const subText = await subRes.text();
  assert.match(subText, /\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}/, 'Expected SRT-like content');
});


test('Redirects homepage to /configure and exposes dynamic manifest field', { timeout: 30000 }, async () => {
  const rootRes = await fetch(`${BASE}/`, { redirect: 'manual' });
  assert.equal(rootRes.status, 302, 'Expected / to redirect');
  assert.equal(rootRes.headers.get('location'), '/configure', 'Expected redirect target /configure');

  const cfgRes = await fetch(`${BASE}/configure`);
  assert.equal(cfgRes.ok, true, 'Expected /configure to be reachable');
  const html = await cfgRes.text();
  assert.match(html, /Dynamic manifest URL/, 'Configure page should contain dynamic manifest field');
  assert.match(html, /option value="hun"/, 'Configure page should expose Hungarian option');
  assert.match(html, /option value="eng"/, 'Configure page should expose English option');
});

