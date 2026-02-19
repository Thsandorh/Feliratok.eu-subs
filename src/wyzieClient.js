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
  const lang = wyzieToStremioLang[String(item.language || '').toLowerCase()] || 'und';
  const releaseInfo = [
    item.media ? `Title: ${item.media}` : '',
    item.release ? `Release: ${item.release}` : '',
    item.source ? `Source: ${item.source}` : 'Source: wyzie',
    item.encoding ? `Encoding: ${item.encoding}` : ''
  ].filter(Boolean);
  const displayName = item.release || item.media || item.id || 'subtitle';
  const sourceName = item.source ? `Wyzie/${item.source}` : 'Wyzie';

  return {
    id: `${displayName} | ${sourceName} | #${item.id || 'na'}`,
    source: 'wyzie',
    lang,
    url: item.url,
    title: `${displayName} | ${sourceName}`,
    releaseInfo: releaseInfo.join(' | ')
  };
}

async function fetchWyzieSubtitles({ imdbId, season, episode, language = 'en,hu' }) {
  async function requestWyzie(languageParam) {
    try {
      const url = makeUrl('/search', {
        id: imdbId,
        season,
        episode,
        language: languageParam,
        source: 'all',
        format: 'srt,ass,vtt,sub'
      });

      const payload = await fetchJson(url);
      if (!Array.isArray(payload)) {
        return [];
      }
      return payload;
    } catch (error) {
      // Treat provider-side 4xx/no-results as empty set so caller can fallback.
      const message = String(error?.message || error);
      if (/400|no subtitles found|invalid language format/i.test(message)) {
        return [];
      }
      throw error;
    }
  }

  try {
    let payload = await requestWyzie(language);

    // Wyzie may return 0 for language-filtered query even when generic query has results.
    // Fallback keeps EN/HU preference while avoiding empty source for many titles.
    if (payload.length === 0 && language) {
      payload = await requestWyzie(undefined);
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
  fetchWyzieSubtitles,
  mapWyzieEntry
};
