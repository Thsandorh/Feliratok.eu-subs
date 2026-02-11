# Feliratok.eu Stremio Subtitles Addon

A Stremio subtitles addon powered by [feliratok.eu](https://feliratok.eu/), supporting:

- movies,
- series,
- season-pack based subtitle discovery for both old and new shows.

## How it works

1. Stremio passes IMDb id and (for series) season/episode metadata.
2. The addon fetches title metadata from Cinemeta.
3. For movies, it searches `feliratok.eu/index.php?search=...&tab=film`.
4. For series, it:
   - resolves the internal series id (`sid`) via `action=autoname`,
   - searches by season/episode using `complexsearch=true&evad=...&epizod1=...`,
   - performs an additional season-pack search with `evadpakk=on`.
5. HTML results are parsed into Stremio-compatible `subtitles` objects.

## Usage

```bash
npm install
npm start
```

Manifest URL:

```text
http://127.0.0.1:7000/manifest.json
```

Add this URL to Stremio as a Community addon.

## Important notes

- The addon parses feliratok.eu HTML pages; there is no official public JSON API for full subtitle listing.
- Results are deduplicated by `URL + language`.
- Subtitle response is capped at 100 items.

## Vercel deploy

1. Push the repository to GitHub.
2. In Vercel, create a new project from the repo.
3. Keep default Node build settings.
4. After deploy, use: `https://<project>.vercel.app/manifest.json`
5. Add that URL to Stremio as a Community addon.

The repo includes a `vercel.json` rewrite rule so Stremio routes (`/manifest.json`, `/subtitles/...`, `/subfile/...`) work directly on Vercel. Public host/protocol are auto-detected from request headers, so `ADDON_BASE_URL` is not required.

`/subfile/...` extracts subtitle files from ZIP/RAR season packs in memory (no archive file persisted to disk).

## Configure page

- `/` redirects to `/configure`.
- `/configure` lets users choose subtitle language (`All`, `Hungarian`, `English`).
- It provides:
  - a `Open Stremio Manifest` button,
  - a copy-friendly dynamic manifest URL field.
- Selected language is embedded into config manifest URL, so the addon can filter returned subtitles accordingly.
