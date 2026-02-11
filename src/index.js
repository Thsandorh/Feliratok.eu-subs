const { addonBuilder } = require('stremio-addon-sdk');
const { fetchMovieSubtitles, fetchSeriesSubtitles } = require('./feliratokClient');
const { fetchJson } = require('./http');
const { createProxyUrl } = require('./archiveProxy');
const { startServer } = require('./server');

const MANIFEST = {
  id: 'community.feliratok.eu.subtitles',
  version: '1.0.0',
  name: 'Feliratok.eu Subtitles',
  description:
    'Complete Stremio subtitles addon for feliratok.eu (movies, series, season-pack support).',
  resources: ['subtitles'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: [],
  config: [
    {
      key: 'lang',
      type: 'select',
      title: 'Subtitle language',
      options: ['all', 'hun', 'eng'],
      default: 'all'
    }
  ],
  behaviorHints: {
    configurable: true,
    configurationRequired: false
  }
};

const builder = new addonBuilder(MANIFEST);

async function fetchCinemetaMeta(type, imdbId) {
  const url = `https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`;
  const payload = await fetchJson(url);
  return payload.meta;
}

function buildNameCandidates(meta, fallbackId) {
  const set = new Set();
  if (meta?.name) set.add(meta.name);
  if (Array.isArray(meta?.aliases)) meta.aliases.forEach((alias) => set.add(alias));
  if (meta?.originalName) set.add(meta.originalName);
  if (set.size === 0 && fallbackId) set.add(fallbackId);
  return [...set].filter(Boolean);
}

function convertArchiveEntriesToProxyUrls(subtitles, { season, episode }) {
  return subtitles.map((subtitle) => {
    if (!/\.(zip|rar)(?:$|[?&])/i.test(subtitle.url)) {
      return subtitle;
    }

    return {
      ...subtitle,
      url: createProxyUrl(subtitle.url, season, episode),
      releaseInfo: `${subtitle.releaseInfo} | Extraction: on-the-fly`
    };
  });
}

function filterByConfigLanguage(subtitles, config = {}) {
  const lang = String(config.lang || 'all').toLowerCase();
  if (lang === 'all') {
    return subtitles;
  }
  return subtitles.filter((sub) => String(sub.lang || '').toLowerCase() === lang);
}

builder.defineSubtitlesHandler(async ({ type, id, extra = {}, config = {} }) => {
  try {
    const imdbId = String(id || '').split(':')[0];
    if (!imdbId.startsWith('tt')) {
      return { subtitles: [] };
    }

    const cinemetaType = type === 'movie' ? 'movie' : 'series';
    const meta = await fetchCinemetaMeta(cinemetaType, imdbId);
    const names = buildNameCandidates(meta, imdbId);

    let subtitles = [];
    if (type === 'movie') {
      subtitles = await fetchMovieSubtitles({ names });
    } else if (type === 'series') {
      subtitles = await fetchSeriesSubtitles({
        names,
        season: extra.season,
        episode: extra.episode
      });
    }

    subtitles = convertArchiveEntriesToProxyUrls(subtitles, {
      season: extra.season,
      episode: extra.episode
    });

    subtitles = filterByConfigLanguage(subtitles, config);

    return { subtitles: subtitles.slice(0, 100) };
  } catch (error) {
    console.error('[subtitles-handler-error]', error);
    return { subtitles: [] };
  }
});

const addonInterface = builder.getInterface();

module.exports = addonInterface;

if (require.main === module) {
  const port = Number(process.env.PORT || 7000);
  startServer({ addonInterface, port });
  console.log(`✅ Feliratok.eu Stremio addon fut: http://127.0.0.1:${port}/manifest.json`);
}
