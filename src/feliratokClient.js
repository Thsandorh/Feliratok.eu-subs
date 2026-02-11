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

    subtitles.push({
      id: `feliratok:${subtitleId}`,
      lang,
      url: downloadUrl,
      releaseInfo: releaseInfoParts.join(' | ')
    });
  });

  return subtitles;
}

async function resolveSeriesIdByName(seriesName) {
  const url = makeUrl('/index.php', {
    action: 'autoname',
    term: seriesName,
    nyelv: 0
  });

  const matches = await fetchJson(url);
  if (!Array.isArray(matches) || matches.length === 0) {
    return null;
  }

  const normalizedNeedle = normalizeName(seriesName);
  const exact = matches.find((item) => normalizeName(item.name) === normalizedNeedle);
  const prefix = matches.find((item) => normalizeName(item.name).startsWith(normalizedNeedle));

  return String((exact || prefix || matches[0]).ID);
}

async function fetchSeriesSubtitles({ names, season, episode }) {
  const results = [];

  for (const name of names) {
    const sid = await resolveSeriesIdByName(name);
    if (!sid) {
      continue;
    }

    const episodeUrl = makeUrl('/index.php', {
      sid,
      tab: 'sorozat',
      complexsearch: 'true',
      evad: season,
      epizod1: episode
    });

    results.push(...parseSubtitleRows(await fetchText(episodeUrl), { isSeasonPack: false }));

    if (season) {
      const seasonPackUrl = makeUrl('/index.php', {
        sid,
        tab: 'sorozat',
        complexsearch: 'true',
        evad: season,
        evadpakk: 'on'
      });

      results.push(...parseSubtitleRows(await fetchText(seasonPackUrl), { isSeasonPack: true }));
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
