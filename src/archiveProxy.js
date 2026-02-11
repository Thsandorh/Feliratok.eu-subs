const JSZip = require('jszip');
const { createExtractorFromData } = require('node-unrar-js');
const { fetchBuffer } = require('./http');

function toBase64Url(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function detectArchiveType(buffer, originalUrl) {
  const sig = buffer.subarray(0, 8);

  if (sig.length >= 4 && sig[0] === 0x50 && sig[1] === 0x4b) {
    return 'zip';
  }

  if (
    sig.length >= 7 &&
    sig[0] === 0x52 &&
    sig[1] === 0x61 &&
    sig[2] === 0x72 &&
    sig[3] === 0x21 &&
    sig[4] === 0x1a &&
    sig[5] === 0x07
  ) {
    return 'rar';
  }

  if (/\.zip(?:$|[?&])/i.test(originalUrl)) return 'zip';
  if (/\.rar(?:$|[?&])/i.test(originalUrl)) return 'rar';
  return 'text';
}

function buildSeasonEpisodePatterns(season, episode) {
  if (!season || !episode) return [];

  const s = Number(season);
  const e = Number(episode);
  const s2 = String(s).padStart(2, '0');
  const e2 = String(e).padStart(2, '0');

  return [new RegExp(`s${s2}e${e2}`, 'i'), new RegExp(`${s}x${e2}`, 'i'), new RegExp(`${s}x${e}`, 'i')];
}

function isSubtitleFile(name) {
  return /\.(srt|sub|ass|ssa|vtt)$/i.test(name);
}

function pickBestSubtitleFile(fileNames, season, episode) {
  const subtitleNames = fileNames.filter(isSubtitleFile);
  if (subtitleNames.length === 0) return null;

  const patterns = buildSeasonEpisodePatterns(season, episode);
  for (const fileName of subtitleNames) {
    if (patterns.some((pattern) => pattern.test(fileName))) {
      return fileName;
    }
  }

  return subtitleNames[0];
}

function createProxyUrl(originalUrl, season, episode) {
  const token = toBase64Url(JSON.stringify({ originalUrl, season, episode }));
  return `/subfile/${token}.srt`;
}

function parseProxyToken(token) {
  return JSON.parse(fromBase64Url(token));
}

async function extractFromZip(buffer, season, episode) {
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => entry.name);

  const chosen = pickBestSubtitleFile(entries, season, episode);
  if (!chosen) throw new Error('No subtitle file found in ZIP');

  return zip.file(chosen).async('nodebuffer');
}

async function extractFromRar(buffer, season, episode) {
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const extractor = await createExtractorFromData({ data: ab });
  const list = extractor.getFileList();
  const headers = [...list.fileHeaders].map((h) => h.name);

  const chosen = pickBestSubtitleFile(headers, season, episode);
  if (!chosen) throw new Error('No subtitle file found in RAR');

  const extracted = extractor.extract({ files: [chosen] });
  const files = [...extracted.files];
  const first = files.find((file) => file.fileHeader.name === chosen);

  if (!first || !first.extraction) {
    throw new Error('Failed to extract chosen subtitle from RAR');
  }

  return Buffer.from(first.extraction);
}

async function getSubtitleFromArchiveUrl(originalUrl, season, episode) {
  const payload = await fetchBuffer(originalUrl);
  const archiveType = detectArchiveType(payload, originalUrl);

  if (archiveType === 'zip') return extractFromZip(payload, season, episode);
  if (archiveType === 'rar') return extractFromRar(payload, season, episode);

  return payload;
}

module.exports = {
  createProxyUrl,
  parseProxyToken,
  getSubtitleFromArchiveUrl
};
