/*
 * Mapa Societario — Programa de ordenador
 * Autor: Alessandro Nurnberg
 * Todos los derechos reservados.
 */
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

// `AI_INVESTIGATION_API` → the ai-investigation worker (redeem + investigate).
export const AI_INVESTIGATION_API =
  import.meta.env.VITE_AI_INVESTIGATION_API ?? 'https://ai-investigation.anurnberg.workers.dev';

// `RAG_URL` → rag.ncdata.eu, which serves the v3 alerts endpoints.
export const RAG_URL = import.meta.env.VITE_RAG_URL ?? 'https://rag.ncdata.eu';

// `CONGRESO_PROXY_URL` / `IBEX35_API_URL` → the Congreso officer-matching proxy
// and the IBEX 35 dashboard API. Lifted out of their service modules so they
// sit behind the same mirror machinery as everything else; both are on
// Cloudflare and so are blockable on a match day like the rest.
export const CONGRESO_PROXY_URL =
  import.meta.env.VITE_CONGRESO_PROXY_URL ?? 'https://congreso-proxy.anurnberg.workers.dev';
export const IBEX35_API_URL =
  import.meta.env.VITE_IBEX35_API_URL ?? 'https://ibex35-api.ncdata.eu';

// ---------------------------------------------------------------------------
// LaLiga block mirrors
// ---------------------------------------------------------------------------
// Every origin above resolves into Cloudflare's shared anycast pool
// (104.21.0.0/16, 172.67.0.0/16). Under the Barcelona court order that runs to
// June 2027, LaLiga has Spanish ISPs null-route individual addresses out of
// exactly those two ranges during match windows, so on any given match day the
// API, checkout and alerts can all vanish for Spanish users at once.
//
// The mirrors below are the escape hatch: alternate hostnames for the same
// services on IP space LaLiga does not touch — the API's own VPS address, and
// a Bunny.net pull zone for anything static. `resilientFetch` (see
// services/originFailover.js) reroutes to them automatically when an origin
// stops answering, and drifts back once the match is over.
//
// Left empty the app behaves exactly as before, so shipping this is inert
// until the mirror hostnames exist. Set them as repo variables consumed by
// .github/workflows/deploy.yml — comma-separated, most-preferred first:
//
//   VITE_API_FALLBACK_URLS=https://api-directo.ncdata.eu
//   VITE_PAYMENTS_FALLBACK_URLS=https://payments-directo.ncdata.eu
//
// A mirror hostname must be DNS-only ("grey cloud") in Cloudflare so it
// resolves to the VPS's dedicated address rather than back into the blocked
// anycast pool, must carry its own TLS certificate, and must send CORS headers
// for https://mapasocietario.es. See docs/laliga-ip-blocks.md.
const mirrorList = value =>
  String(value ?? '')
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);

export const API_FALLBACK_URLS = mirrorList(import.meta.env.VITE_API_FALLBACK_URLS);
export const PAYMENTS_FALLBACK_URLS = mirrorList(import.meta.env.VITE_PAYMENTS_FALLBACK_URLS);
export const AI_INVESTIGATION_FALLBACK_URLS = mirrorList(
  import.meta.env.VITE_AI_INVESTIGATION_FALLBACK_URLS
);
export const RAG_FALLBACK_URLS = mirrorList(import.meta.env.VITE_RAG_FALLBACK_URLS);
export const CONGRESO_PROXY_FALLBACK_URLS = mirrorList(
  import.meta.env.VITE_CONGRESO_PROXY_FALLBACK_URLS
);
export const IBEX35_API_FALLBACK_URLS = mirrorList(import.meta.env.VITE_IBEX35_API_FALLBACK_URLS);

// Consumed by services/originFailover.js. Each entry is one logical service:
// the live origin first, then its mirrors in preference order.
export const ORIGIN_GROUPS = {
  api: [API_URL, ...API_FALLBACK_URLS],
  payments: [PAYMENTS_API, ...PAYMENTS_FALLBACK_URLS],
  aiInvestigation: [AI_INVESTIGATION_API, ...AI_INVESTIGATION_FALLBACK_URLS],
  rag: [RAG_URL, ...RAG_FALLBACK_URLS],
  congreso: [CONGRESO_PROXY_URL, ...CONGRESO_PROXY_FALLBACK_URLS],
  ibex35: [IBEX35_API_URL, ...IBEX35_API_FALLBACK_URLS],
};

// Company findings block at the top of the inspector. Ships dark; flipped to
// true by the last task of docs/superpowers/plans/2026-08-24-company-findings-panel.md.
export const FINDINGS_PANEL_ENABLED = true;
