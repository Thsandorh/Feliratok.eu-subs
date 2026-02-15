# Feliratok.eu Stremio Subtitles Addon

A modern Stremio subtitles addon powered by **Feliratok.eu + Wyzie**.

It supports:

- movies,
- series,
- season-pack subtitle extraction,
- language-focused enrichment (English + Hungarian) via Wyzie.

## How it works

1. Stremio sends IMDb id and (for series) season/episode metadata.
2. The addon fetches title metadata from Cinemeta.
3. It searches subtitles from:
   - **Feliratok.eu** (HTML parsing + season-pack support)
   - **Wyzie API** (`https://sub.wyzie.ru/search`) for extra EN/HU coverage
4. Results are merged, deduplicated, optionally language-filtered by config, and returned in Stremio format.

## Usage

```bash
npm install
npm start
```

Manifest URL:

```text
http://127.0.0.1:7000/manifest.json
```

## Configure UI

Open the addon root URL in browser:

```text
http://127.0.0.1:7000/
```

Behavior:

- `/` serves the configure page (`200 text/html`)
- A modern configuration page lets you choose subtitle language (`All`, `Hungarian`, `English`)
- You get:
  - an **Open in Stremio** button
  - a copy-friendly dynamic manifest URL field

The Stremio button uses:

```text
stremio://<host>/.../manifest.json
```

## Season-pack extraction (no archive storage)

If a subtitle is provided as ZIP/RAR season pack, the addon serves `/subfile/...` URLs and extracts the matching episode subtitle **in-memory** (without persisting archive files on disk).

## cPanel / CloudLinux deployment (Node.js app, no Docker)

Set the Node.js application fields in cPanel:

- Application root: repository root (the folder that contains `package.json` and `server.js`)
- Application URL: `/` or `/addon-path`
- Application startup file: `server.js`
- Node.js version: 18+ (recommended: latest available on your hosting)

Environment variables:

- `APP_BASE_PATH`:
  - leave empty when Application URL is `/`
  - set to `/addon-path` when Application URL is `/addon-path`
- `PORT`: optional (cPanel usually injects it automatically)

URLs after deploy:

- Configure page: `https://<domain>/<addon-path-if-used>/configure`
- Manifest: `https://<domain>/<addon-path-if-used>/manifest.json`

## Notes

- Feliratok.eu does not provide a full official JSON API for complete listing, so HTML parsing is required there.
- Returned subtitle list is currently capped at 150 merged items.
