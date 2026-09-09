# Mapa Societario — Chrome extension

Select a Spanish company name on any page → right-click → "Look up Spanish company" →
side panel shows the registry card + officer network. Read-only, anonymous.

## Develop

```
npm install
npm run build        # outputs dist/
npm test
```

Load `dist/` as an unpacked extension (chrome://extensions → Developer mode → Load unpacked).

## Keeping in sync with the web app

Two things are copies of app code, not imports (a Chrome bundle can't reach
across the project root), so they drift silently:

- `src/shared/positionCategories.js` — a verbatim copy of
  `src/utils/positionCategories.js` between the marker comments, plus an
  extension-only board filter. `test/shared/positionCategories.sync.test.js`
  fails if the two diverge; resync by replacing the whole marked block.
- `src/panel/appSearchUrl.js` — must keep emitting `gk=<group_key>`; `/app`
  resolves that key to one company, while a bare `search=` re-runs a fuzzy
  name search and can open a different legal entity.

Rules the app applies that this panel must mirror: a dissolved company has no
*current* officers (BORME never ceases the seats individually), and the graph
shows governance roles only, with non-board seats reported as a count.

## Release

1. `npm test` (all green) and `npm run build`
2. Bump `version` in `public/manifest.json` **and** `package.json` together
3. `cd dist && zip -r ../mapasocietario-extension-v<version>.zip .`
4. Upload the zip to the Chrome Web Store dashboard

## Automated verification

**Build:** exit code 0 — `dist/` gets manifest.json, background.js, panel.js,
chunk-messages.js, src/panel/index.html, icons/.

**Test suite (v0.2.0):** 79 tests across 13 files, all passing.

## Manual check the maintainer still owes

Chrome's side panel can't be driven by page-level automation, so load `dist/`
unpacked and confirm by hand: right-click a selected company name → panel opens
→ match list → card + graph → the profile link lands on the right company.
Note the API is unreachable from Chrome on the maintainer's own network during
LaLiga windows (ISP-level Cloudflare IP filtering) — test from another network
if the panel shows the error state while `curl` works.
