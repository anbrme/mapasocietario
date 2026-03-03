# Mapa Societario

Frontend application for exploring relationships between Spanish companies and officers.

## API Integration

This project consumes the public BORME API hosted at `https://api.ncdata.eu`.

- API repository: https://github.com/anbrme/borme-public-api
- OpenAPI contract: https://raw.githubusercontent.com/anbrme/borme-public-api/main/openapi.yaml

Primary integration file:
- `src/services/spanishCompaniesService.js`

## Endpoints Used By This App

- `GET /bormes/working-search`
- `GET /bormes/companies/directory`
- `GET /bormes/companies/directory/autocomplete`
- `GET /bormes/companies/directory/{id}`
- `GET /bormes/pg/expand-company`
- `GET /bormes/pg/expand-officer`
- `POST /bormes/officers-autocomplete`

## Local Development

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```
