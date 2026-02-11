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

- `/` redirects to `/configure`
- A modern configuration page lets you choose subtitle language (`All`, `Hungarian`, `English`)
- You get:
  - an **Open in Stremio** button
  - a copy-friendly dynamic manifest URL field

The Stremio button uses:

```text
stremio:///addon-install?url=<encoded_manifest_url>
```

and falls back to opening the manifest URL in browser if deep-link is blocked.

## Season-pack extraction (no archive storage)

If a subtitle is provided as ZIP/RAR season pack, the addon serves `/subfile/...` URLs and extracts the matching episode subtitle **in-memory** (without persisting archive files on disk).

## Vercel deployment

1. Push repository to GitHub.
2. Create a Vercel project from the repo.
3. Keep default Node settings.
4. Use the deployed manifest URL:

```text
https://<project>.vercel.app/manifest.json
```

`vercel.json` rewrites all relevant routes (`/manifest.json`, `/subtitles/...`, `/subfile/...`, `/configure`) to the serverless handler.

## Notes

- Feliratok.eu does not provide a full official JSON API for complete listing, so HTML parsing is required there.
- Returned subtitle list is currently capped at 150 merged items.
