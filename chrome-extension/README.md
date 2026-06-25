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

## Manual E2E results

| Page | Selection | Result |
|------|-----------|--------|
| (to be filled in by maintainer) | | |

## Automated verification

**Build:**
- Exit code: 0
- Dist files: manifest.json, background.js, panel.js, chunk-messages.js, src/panel/index.html, icons/

**Test suite:**
- All 25 tests passed across 10 test files
  - test/api/client.company.test.js (3 tests)
  - test/api/client.resolve.test.js (4 tests)
  - test/shared/buildGraph.test.js (4 tests)
  - test/background.test.js (3 tests)
  - test/panel/MatchList.test.jsx (3 tests)
  - test/panel/CompanyCard.test.jsx (1 test)
  - test/panel/App.test.jsx (1 test)
  - test/panel/i18n.test.js (3 tests)
  - test/panel/empresaUrl.test.js (2 tests)
  - test/panel/CompanyGraph.test.jsx (1 test)
