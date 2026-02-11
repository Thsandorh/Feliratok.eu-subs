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

test('Stremio film lejátszásnál talál feliratot (The Matrix)', { timeout: 60000 }, async () => {
  const subtitles = await getSubtitleList('/subtitles/movie/tt0133093.json');
  assert.ok(subtitles.length > 0, 'Movie subtitles should not be empty');
});

test('Stremio sori lejátszásnál talál feliratot (Breaking Bad S01E01)', { timeout: 60000 }, async () => {
  const subtitles = await getSubtitleList('/subtitles/series/tt0903747.json?season=1&episode=1');
  assert.ok(subtitles.length > 0, 'Series subtitles should not be empty');
});

test('Régi sorozat évadpakkból on-the-fly kiválasztható a megfelelő felirat (Six Feet Under S01E01)', { timeout: 90000 }, async () => {
  const subtitles = await getSubtitleList('/subtitles/series/tt0248654.json?season=1&episode=1');
  assert.ok(subtitles.length > 0, 'Old series subtitles should not be empty');

  const seasonPackSubtitle = subtitles.find((sub) =>
    String(sub.releaseInfo || '').includes('Évadpakk') && /\/subfile\//.test(String(sub.url || ''))
  );

  assert.ok(seasonPackSubtitle, 'Expected an Évadpakk subtitle with local /subfile/ proxy URL');

  const subRes = await fetch(seasonPackSubtitle.url);
  assert.equal(subRes.ok, true, 'Expected subfile endpoint to return HTTP 200');

  const subText = await subRes.text();
  assert.match(subText, /\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}/, 'Expected SRT-like content');
});
