const { fetchJson } = require('./http');

const BASE_URL = 'https://sub.wyzie.ru';

const wyzieToStremioLang = {
  en: 'eng',
  hu: 'hun',
  de: 'ger',
  fr: 'fre',
  es: 'spa',
  it: 'ita',
  pt: 'por',
  ru: 'rus',
  pl: 'pol',
  nl: 'dut',
  cs: 'cze',
  sk: 'slo',
  sl: 'slv',
  ro: 'rum',
  sr: 'srp',
  hr: 'hrv',
  tr: 'tur',
  sv: 'swe',
  da: 'dan',
  fi: 'fin',
  no: 'nor',
  ar: 'ara',
  he: 'heb',
  ko: 'kor',
  ja: 'jpn'
};

function makeUrl(path, params = {}) {
  const url = new URL(path, BASE_URL);
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      url.searchParams.set(key, String(val));
    }
  }
  return url.toString();
}

function mapWyzieEntry(item) {
  const lang = wyzieToStremioLang[String(item.language || '').toLowerCase()] || 'eng';
  const releaseInfo = [
    item.media ? `Title: ${item.media}` : '',
    item.release ? `Release: ${item.release}` : '',
    item.source ? `Source: ${item.source}` : 'Source: wyzie',
    item.encoding ? `Encoding: ${item.encoding}` : ''
  ].filter(Boolean);

  return {
    id: `wyzie:${item.id}`,
    lang,
    url: item.url,
    releaseInfo: releaseInfo.join(' | ')
  };
}

async function fetchWyzieSubtitles({ imdbId, season, episode, language = 'en,hu' }) {
  try {
    const url = makeUrl('/search', {
      id: imdbId,
      season,
      episode,
      language,
      format: 'srt,ass,vtt,sub'
    });

    const payload = await fetchJson(url);
    if (!Array.isArray(payload)) {
      return [];
    }

    return payload
      .filter((item) => item && typeof item.url === 'string' && item.url.startsWith('http'))
      .map(mapWyzieEntry);
  } catch (error) {
    console.error('[wyzie-fetch-error]', error.message || error);
    return [];
  }
}

module.exports = {
  fetchWyzieSubtitles
};
