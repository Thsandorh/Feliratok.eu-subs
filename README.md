# Feliratok.eu Stremio Subtitles Addon

Stremio kiegészítő, ami a [feliratok.eu](https://feliratok.eu/) feliratbázisából ad vissza feliratokat:

- filmekhez,
- sorozatokhoz,
- külön évadpakk kereséssel régi és új sorozatok esetén is.

## Fő működés

1. A Stremio átadja az IMDb azonosítót és (sorozatnál) évad/epizód adatokat.
2. A kiegészítő lekéri a metaadatot a Cinemeta API-ról.
3. Filmnél cím alapján keres a `feliratok.eu/index.php?search=...&tab=film` végponton.
4. Sorozatnál:
   - `action=autoname` endpointtal feloldja a `sid` azonosítót,
   - epizódra keres `complexsearch=true&evad=...&epizod1=...` paraméterekkel,
   - külön évadpakk keresést is lefuttat `evadpakk=on` használatával.
5. A HTML találatokból kinyeri a letöltési URL-t és a nyelvet, majd Stremio-kompatibilis `subtitles` választ ad.

## Használat

```bash
npm install
npm start
```

Manifest URL:

```text
http://127.0.0.1:7000/manifest.json
```

Ezt add hozzá a Stremio-hoz mint Community addon.

## Fontos megjegyzések

- A `feliratok.eu` HTML oldalait parse-olja, nincs hivatalos publikus JSON API a teljes feliratlistára.
- Az addon deduplikálja a találatokat URL+nyelv alapon.
- A találatlista maximum 100 elemre van vágva a Stremio válaszban.


## Vercel deploy

1. Pushold a repót GitHubra.
2. Vercelben `New Project` -> válaszd a repót.
3. Build Command: hagyd alapértelmezetten (Node projekt).
4. Deploy után a manifest URL: `https://<project>.vercel.app/manifest.json`
5. Ezt az URL-t add hozzá Stremio-ban Community addonként.
A repo tartalmaz egy `vercel.json` rewrite szabályt, ami minden útvonalat az addon routerre küld, így a Stremio endpointok (`/manifest.json`, `/subtitles/...`, `/subfile/...`) közvetlenül működnek Vercelen is. A publikus host/protokoll automatikusan a beérkező kérésből kerül meghatározásra, ezért nem kell külön `ADDON_BASE_URL` változót beállítani. A `/subfile/...` végpont a ZIP/RAR évadpakkokból memóriában választja ki a megfelelő epizód feliratot, fájl mentése nélkül.
