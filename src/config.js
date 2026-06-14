// Central API base URLs.
//
// Production defaults are baked in and used by the deployed build (which sets
// no Vite env vars). To point a local dev build at a branch backend, override
// per-environment via Vite env vars in `.env.local` (gitignored), e.g.:
//
//   VITE_API_URL=http://localhost:5005
//   VITE_PAYMENTS_API=http://localhost:8787
//
// `API_URL`      → the bormes/DD Flask API (prod: api.ncdata.eu, fronted by the
//                  local-rag api-proxy CORS Worker).
// `PAYMENTS_API` → the Stripe/Google-Play fulfillment service (prod:
//                  payments.ncdata.eu). Hard to run locally; for DD testing hit
//                  `${API_URL}/bormes/dd-report/company` directly and skip it.
export const API_URL = import.meta.env.VITE_API_URL ?? 'https://api.ncdata.eu';
export const PAYMENTS_API = import.meta.env.VITE_PAYMENTS_API ?? 'https://payments.ncdata.eu';
