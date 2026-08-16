# Demand-indexed company pages

Company pages remain `noindex, follow` until real product usage proves that a
company is worth adding to the search index. This avoids generating a thin page
for every BORME entity while still expanding coverage automatically.

## Promotion rules

A company is promoted when either condition is met:

- one real click on a full-profile link; or
- two deduplicated search observations (distinct browser, or distinct day).

The browser id lives in `localStorage`, not `sessionStorage` — the latter is
scoped per TAB, so a second tab would mint a second identity and let one person
satisfy the two-observation rule alone.

The browser sends only the resolved company identity and stable v3 `group_key`.
It does not send or store the user's search query. Events are deduplicated by
event type, company, session and day.

Three limits bound what this can do:

- **Rate limit** — `MAX_REQUESTS_PER_DAY` per calling address, enforced in D1
  *before* any upstream request, so the endpoint cannot be used to amplify
  traffic against api.ncdata.eu.
- **Daily promotion cap** — `MAX_PROMOTIONS_PER_DAY` (250) bounds how fast the
  indexable surface can grow, whatever the traffic.
- **One owner per URL** — `nameToSlug` is lossy (ñ becomes n, & becomes y) and a
  company can span several hojas, so two `group_key`s can produce one slug.
  Uniqueness is enforced over promoted rows only; a second identity is refused
  the URL rather than colliding on insert.

## Verification lifecycle

The BORME API is consulted only where it changes an outcome:

- a candidate that has just crossed the promotion threshold (retried at most
  once every 24h on failure, so a company that cannot be verified backs off);
- a promoted page whose last check is older than 30 days.

Ordinary search traffic for an already-promoted company costs D1 writes only.
A promoted page that stops verifying — dissolved, renamed, or gone — is demoted
back to `candidate`. Independently, `/empresa/:slug` re-checks at render time
that the live company name still round-trips to the slug, and serves `noindex`
if it does not, so a rename cannot leave a stale URL asserting itself as
canonical.

## Cloudflare D1 setup

Create one D1 database and bind it to the Pages project as `SEO_DB`:

```sh
npx wrangler d1 create mapasocietario-seo
```

Copy the returned `database_id` into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "SEO_DB"
database_name = "mapasocietario-seo"
database_id = "<returned-database-id>"
migrations_dir = "migrations"
```

Apply the schema before deploying the Pages Functions:

```sh
npx wrangler d1 migrations apply mapasocietario-seo --remote
```

If the binding is absent, the signal endpoint safely returns HTTP 202 without
recording anything and existing company-page behavior is unchanged.

## Resulting routes

- `POST /api/company-demand` records and validates product-demand signals.
- `/empresa/:slug` and `/en/company/:slug` become `index, follow` once promoted.
- `/sitemap-demand.xml` lists the demand sitemap chunks.
- `/sitemaps/companies/:page` lists both language variants with reciprocal
  hreflang annotations.

Do not send simulated profile views. A search render and a user clicking the
full-profile link are deliberately separate signals.

## Turning the sitemap on

`/sitemap-demand.xml` 404s until the first company is promoted, and a 404 child
inside the sitemap index is a Search Console error — so `sitemap.xml` does not
reference it by default. Once the endpoint returns 200, rebuild with the flag:

```sh
DEMAND_SITEMAP_PUBLISHED=1 npm run build
```

Check it first:

```sh
curl -sI https://mapasocietario.es/sitemap-demand.xml | head -1
```
