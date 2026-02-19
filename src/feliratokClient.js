const cheerio = require('cheerio');
const { fetchText, fetchJson } = require('./http');

const BASE_URL = 'https://feliratok.eu';

const languageMap = {
  Magyar: 'hun',
  Angol: 'eng',
  Francia: 'fre',
  Német: 'ger',
  Olasz: 'ita',
  Spanyol: 'spa',
  Portugál: 'por',
  Orosz: 'rus',
  Lengyel: 'pol',
  Török: 'tur',
  Holland: 'dut',
  Svéd: 'swe',
  Dán: 'dan',
  Finn: 'fin',
  Norvég: 'nor',
  Cseh: 'cze',
  Szlovák: 'slo',
  Szlovén: 'slv',
  Román: 'rum',
  Szerb: 'srp',
  Horvát: 'hrv',
  Arab: 'ara',
  Héber: 'heb',
  Koreai: 'kor',
  Japán: 'jpn'
};

function normalizeName(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function makeUrl(path, params = {}) {
  const url = new URL(path, BASE_URL);
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      url.searchParams.set(key, String(val));
    }
  }
  return url.toString();
}

function parseSubtitleRows(html, context = {}) {
  const $ = cheerio.load(html);
  const subtitles = [];

  $('tr#vilagit').each((_, row) => {
    const tr = $(row);
    const languageRaw = tr.find('td.lang small').first().text().trim();
    const href = tr.find('a[href*="action=letolt"]').first().attr('href');
    const onclick = tr.find('td[onclick*="adatlapnyitas"]').first().attr('onclick') || '';
    const idMatch = onclick.match(/a_(\d+)/);
    const subtitleId = idMatch ? idMatch[1] : null;

    if (!href || !subtitleId) {
      return;
    }

    const magyar = tr.find('.magyar').first().text().trim();
    const eredeti = tr.find('.eredeti').first().text().trim();
    const uploader = tr.children('td').eq(3).text().trim();
    const date = tr.children('td').eq(4).text().trim();

    const downloadUrl = new URL(href, BASE_URL).toString();
    const filename = new URL(downloadUrl).searchParams.get('fnev') || '';
    const isSeasonPack = /\.(zip|rar)$/i.test(filename) || Boolean(context.isSeasonPack);
    const lang = languageMap[languageRaw] || 'eng';

    const releaseInfoParts = [
      eredeti || magyar,
      filename ? `File: ${filename}` : '',
      uploader ? `Uploader: ${uploader}` : '',
      date ? `Date: ${date}` : '',
      isSeasonPack ? 'Season pack' : ''
    ].filter(Boolean);
    const displayName = filename || eredeti || magyar || `Felirat ${subtitleId}`;

    subtitles.push({
      id: `${displayName} | Feliratok.eu | #${subtitleId}`,
      source: 'feliratok',
      lang,
      url: downloadUrl,
      title: `${displayName} | Feliratok.eu`,
      releaseInfo: releaseInfoParts.join(' | ')
    });
  });

  return subtitles;
}

async function resolveSeriesIdsByName(seriesName) {
  const url = makeUrl('/index.php', {
    action: 'autoname',
    term: seriesName,
    nyelv: 0
  });

  const matches = await fetchJson(url);
  if (!Array.isArray(matches) || matches.length === 0) {
    return [];
  }

  const normalizedNeedle = normalizeName(seriesName);
  const scored = matches.map((item, index) => {
    const normalized = normalizeName(item.name);
    let score = 0;
    if (normalized === normalizedNeedle) score = 3;
    else if (normalized.startsWith(normalizedNeedle)) score = 2;
    else if (normalized.includes(normalizedNeedle)) score = 1;
    return { id: String(item.ID), score, index };
  });

  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return [...new Set(scored.map((item) => item.id))];
}

async function fetchSeriesSubtitles({ names, season, episode }) {
  const results = [];

  for (const name of names) {
    const sids = await resolveSeriesIdsByName(name);
    if (sids.length === 0) {
      continue;
    }

    for (const sid of sids) {
      const episodeUrl = makeUrl('/index.php', {
        sid,
        tab: 'sorozat',
        complexsearch: 'true',
        evad: season,
        epizod1: episode
      });

      const candidate = parseSubtitleRows(await fetchText(episodeUrl), { isSeasonPack: false });

      if (season) {
        const seasonPackUrl = makeUrl('/index.php', {
          sid,
          tab: 'sorozat',
          complexsearch: 'true',
          evad: season,
          evadpakk: 'on'
        });

        candidate.push(...parseSubtitleRows(await fetchText(seasonPackUrl), { isSeasonPack: true }));
      }

      if (candidate.length > 0) {
        results.push(...candidate);
        break;
      }
    }

    if (results.length > 0) {
      break;
    }
  }

  return dedupeSubtitles(results);
}

async function fetchMovieSubtitles({ names }) {
  const results = [];

  for (const name of names) {
    const url = makeUrl('/index.php', {
      search: name,
      tab: 'film'
    });

    results.push(...parseSubtitleRows(await fetchText(url)));
    if (results.length > 0) {
      break;
    }
  }

  return dedupeSubtitles(results);
}

function dedupeSubtitles(subtitles) {
  const seen = new Set();
  return subtitles.filter((sub) => {
    const key = `${sub.url}|${sub.lang}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

module.exports = {
  BASE_URL,
  parseSubtitleRows,
  fetchMovieSubtitles,
  fetchSeriesSubtitles,
  dedupeSubtitles
};
