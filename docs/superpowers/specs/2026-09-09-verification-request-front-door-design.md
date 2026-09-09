# Verification Request Front Door — Design

**Date:** 2026-09-09
**Status:** Design approved; this is the build target
**Amends:** [2026-09-08 Company Attestation Pilot](./2026-09-08-company-attestation-pilot-design.md) — reverses one line of its §12 and adds the surfaces below. Everything else in that document stands unchanged, including every assurance claim in its §4.
**Related:** [[project_acquisition_strategy]], [[project_company_context_layer]], [[user_analyst_not_salesman]], [[feedback_published_components_need_verification]]

---

## 1. What this amends, and why

The pilot design put a **self-serve claim flow** out of scope (§12), for a stated reason: it "adds the entire *who may claim this page* attack surface for no pilot value."

That objection was aimed at a flow that **grants authority** — where clicking a button on a company page yields a token and an acceptance form. This document does not build that. It builds an inbound **request**, which grants nothing: no token, no page, no authority, not even a draft. A request is a lead in the operator's console. Every gate in the original design stands exactly where it was.

The pilot value the original exclusion could not see has since become clear. The acquisition path for this product runs through institutions telling their counterparties to obtain a verification, and that conversation cannot be had without a URL to name. **The deliverable of this work is a credible URL to put in an institution's hands** — not a volume of inbound requests.

## 2. What we are building, in one sentence

A public, indexable page at `/verificacion` that explains the verification to a company which has just been told to obtain one, plus a form that records that company's request for manual review — where the strongest consequence a request can have is a row in the operator's queue.

## 3. The three parties, and the verb each one owns

| Party | Verb | Controls | Touches the system? |
|---|---|---|---|
| Institution (bank, corporate, fund) | **requests it of its counterparties** | Whether it asks, and whether it accepts the result | **No.** Reached by conversation, never by software |
| Company (the subject) | **declares** | Whether to participate, and what it states | Yes — this page, then the existing acceptance flow |
| Operator (Nürnberg Consulting) | **reviews and publishes** | The standard, the check, publish/reject | Yes — the console |

These verbs must stay separate in every surface and in both languages. The institution never "verifies", and no copy may let it believe it did. This is the audited-accounts pattern: a bank does not audit its counterparty, it requires audited accounts, and the independent sign-off is portable to every other bank. Portability is the entire value; a per-institution check would produce fifty supplier questionnaires, which is the status quo this exists to replace.

**Only the company may request verification of its own data.** Third-party requests — an institution naming a supplier for us to chase — are refused. They would mean emailing a stranger on the word of an anonymous submitter, and they invert the model: the burden of obtaining a verification belongs to the company that benefits from holding one.

## 4. Why §12's objection does not apply

The invariant this design preserves, stated so it can be tested:

> **No path exists from public input to an invitation token without an operator action that records `representation_basis`, `identification_note` and `email_domain_basis`.**

Those three fields are, by §6 of the pilot design, things the system cannot infer. They remain hand-entered. Consequently:

- A forged request naming Telefónica achieves one row in a queue and nothing else.
- The request form is not an oracle: its response is identical for a real company, a fictional one, and one that already holds a live attestation. During `VERIFY_VISIBILITY=private` this matters; after it, it costs nothing to keep.
- The email address in a request is a **candidate** contact, not a delivery channel for a token. The operator confirms the address and records why that domain belongs to that company, exactly as today.

## 5. Decisions taken

| Decision | Choice | Rationale |
|---|---|---|
| Who may request | The company, about itself, only | §3. Third-party requests invert the burden and would have us cold-emailing named strangers |
| Entry point | A standalone `/verificacion` page | It is the URL an institution pastes into its own supplier email. `/empresa`'s audience is investigators, not companies, so a badge there shows the offer mainly to people who cannot act on it |
| Indexing | Public and indexable, framed as a pilot | The one member of the `/verificacion/*` family that is not `noindex`. A page nobody can find cannot be cited |
| Implementation | Pages Function, mirroring `functions/verificacion/privacidad.js` | Prose plus one form. Keeps the family together, needs no SPA route, no prerender change, and no exception carved in robots or `_headers` |
| Copy location | `src/copy/verificacion.js` | Matches `registryScale.js` / `CONFIRMATION_I18N`; makes the copy property-testable |
| Email domain | Corporate domains only during the pilot, hard reject with an escape hatch | §9 |
| Spam control | Honeypot **and** Turnstile siteverify in the Function | `functions/feedback.js` gets away with a honeypot because it only mails the operator; this writes a durable row naming a real company |
| Acknowledgement email to the requester | None | It would be a send-to-arbitrary-address surface for no gain; the page confirms on screen |
| Notification to the operator | Yes, reusing the Cloudflare Email Sending call in `functions/feedback.js` | Otherwise the console must be polled |
| Conversion to an invitation | Manual, through the existing invite flow | §4. The request prefills a search; it never prefills authority |

## 6. The page — `GET /verificacion`

`functions/verificacion/index.js`, following `privacidad.js` in shape and in its `?lang=en` handling, with two deliberate differences:

1. It does **not** call `privateHeaders()`. The `noindex` on this family is applied per response, not by a blanket `_headers` or robots rule, so an indexable member requires no exception anywhere — it simply omits the header. Verified: `public/_headers` and `public/robots.txt` carry no `/verificacion` rule today.
2. It is styled to be credible to a company deciding whether to trust this, since it is a page an institution will cite. Brand tokens are inlined; the page loads nothing from the SPA bundle.

Routing: there is no `functions/verificacion/index.js` today, and the siblings (`g/[token].js`, `privacidad.js`) are more specific paths, so adding it introduces no collision.

## 7. Copy requirements

The page must state, in ES and EN:

1. **What it is** — a dated, attributable statement by a person holding a registry-recorded position, checked against BORME and reviewed by a named person.
2. **What it is not** — not identity verification, not a certificate that the information is true, not an official registry document. The §4.1 wording of the pilot design, reaching a public surface for the first time.
3. **Who may do it** — only a representative with registry-recorded representation power. Joint administrators (*mancomunados*) are excluded from the pilot, stated **before** the form rather than discovered after it.
4. **Who may ask** — the company itself, about its own data (§3).
5. **What it costs** — free during the pilot; roughly twenty minutes of a representative's time; several days end to end.
6. **Pilot framing** — limited places, every request reviewed by a person, not every request accepted.

The single persuasive line, and the only one: **do this once, not once per counterparty.**

### 7.1 The pilot-tier paragraph

A company will ask why it should sign the weak version now. The answer is truthful and must be phrased as a statement about the system's present shape, never as a roadmap promise with a date:

> Esto es un piloto. Hoy la verificación se apoya en tres cosas: un correo confirmado en el dominio de la empresa, la coincidencia con un cargo vigente en el registro, y una revisión manual firmada por una persona con nombre y apellidos. **No comprobamos su identidad y no certificamos que lo que usted declara sea cierto.**
>
> Están diseñados, y todavía no implementados, la firma con certificado electrónico cualificado del representante y el sellado de tiempo cualificado del registro. Cada declaración guarda **con qué método se hizo**, así que cuando lleguen los métodos más fuertes las declaraciones de hoy no quedan invalidadas: quedan distinguidas.

The last clause is verifiable, not aspirational: `attestations.method` in `migrations/0002_verification.sql` is already `CHECK (method IN ('email-confirmed','qes-signed'))`. The stronger tier is a value the schema anticipates, so a later upgrade distinguishes today's records rather than devaluing them.

## 8. Endpoint — `POST /api/verify/request`

Public and unauthenticated. Decision logic lives in `src/verify/request.js`, where vitest reaches it; the Function only moves data, following `functions/api/verify/_db.js`.

**Body:** `company_query` (name or NIF, free text), `nif` (optional), `contact_name`, `contact_role` (their position in the company), `contact_email`, `referrer_note` (optional), `note` (optional), `website` (honeypot), `turnstileToken`.

`referrer_note` is prompted as **"¿Le ha pedido algún banco, cliente o socio que verifique sus datos registrales?"** — answered by the company about itself. It is the distribution thesis instrumented in one input: it tells us which institutions are actually driving traffic. It is prominent on the form, not buried.

**Behaviour:**

- Honeypot filled → HTTP 200, no write, no mail. Follows `functions/feedback.js`.
- Turnstile siteverify fails → 400, no write. New secret `VERIFY_TURNSTILE_SECRET`; the sitekey may be shared with the existing widgets.
- Validation failure → 400 with a field-level reason, so the form can point at the field.
- Consumer email domain → 400 with the escape-hatch message (§9), distinct from a malformed-address error so the message is right.
- Success → insert one `verification_requests` row with `status='new'`, mail the operator, return a neutral acknowledgement.

**The acknowledgement is identical in every success case.** It never states whether the company was found, whether it is eligible, or whether it already holds an attestation.

## 9. The corporate-domain rule

`src/verify/emailDomain.js` exports `isCorporateEmailDomain(email)`. It rejects a conservative, explicit list of unambiguous consumer mailboxes: the global providers (`gmail`, `googlemail`, `outlook`, `hotmail`, `live`, `msn`, `yahoo`, `ymail`, `icloud`, `me.com`, `mac.com`, `aol`, `protonmail`, `proton.me`, `gmx`, `mail.com`, `yandex`, `tutanota`, `zoho.com`), the Spanish ISP mailboxes (`terra.es`, `telefonica.net`, `wanadoo.es`, `ono.com`, `movistar.es`, `orange.es`, `vodafone.es`, `euskaltel.net`, `telecable.es`), and a short disposable list. Matching is case-insensitive against the exact domain **and** any subdomain of a listed one, so `x@foo.gmail.com` cannot slip through. A malformed address, a domain with no dot, and an IP literal are rejected as *invalid*, which is a different error from *consumer domain*.

Three properties of this rule belong in the design, not in a later post-mortem:

**It is a negative check.** It establishes that an address is not a known consumer mailbox. It establishes nothing whatsoever about affiliation with the company — anyone can buy a domain in minutes. It therefore **does not satisfy `email_domain_basis`**, which the operator continues to record by hand. No copy may present the rule as evidence of anything.

**It will reject real companies.** A large share of legitimate Spanish SLs run on Gmail. The rule is therefore stated *above* the form and validated as the user types, never sprung at submit, and its rejection carries a way through:

> Durante el piloto solo podemos aceptar solicitudes desde un dominio corporativo. Si ese no es su caso, escríbanos a mapasocietario@ncdata.eu.

That keeps the lead instead of losing it silently.

**It is labelled a pilot rule**, so relaxing it later is a planned step rather than a climbdown.

## 10. Data model — migration `0003_verification_requests.sql`

```sql
-- Inbound requests from companies asking to be verified. A request GRANTS
-- NOTHING: it is a lead. The path to an invitation runs through the operator,
-- who records representation_basis, identification_note and email_domain_basis
-- by hand. contact_email is a CANDIDATE contact, never an automatic recipient
-- of an invitation token.
CREATE TABLE verification_requests (
  id            TEXT PRIMARY KEY,
  company_query TEXT NOT NULL,          -- exactly what they typed
  nif           TEXT,
  contact_name  TEXT NOT NULL,
  contact_role  TEXT NOT NULL,          -- their position in the company
  contact_email TEXT NOT NULL,
  referrer_note TEXT,                   -- who prompted them: the demand signal
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'new' CHECK (status IN
                  ('new','contacted','invited','ineligible','declined','spam')),
  subject_id    TEXT REFERENCES subjects(subject_id),  -- set when resolved
  invitation_id TEXT REFERENCES invitations(id),       -- set when converted
  operator_note TEXT,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT
);
CREATE INDEX idx_verification_requests_status ON verification_requests(status, created_at);
```

The table is strictly upstream of `/api/verify/admin/invite`. It touches no existing table, and nothing in the trust model, the audit chain, or the reconciliation loop.

## 11. Operator console

A **Solicitudes** section at the top of `/admin/verificacion`, served by two new admin endpoints behind the existing `requireAdmin` bearer check:

- `GET /api/verify/admin/requests?status=` — newest first.
- `POST /api/verify/admin/requests/decide` — set `status` and `operator_note`.

Each row shows what they typed, who they are and their claimed position, who prompted them, the date, and the status. A **Buscar** action prefills the existing invite search with `company_query`, so converting a request is the flow that already exists: pick company → pick officer from the registry list → fill the three manual fields → issue invitation. On success the request row records the `invitation_id`, which is the loop closing.

**Optional hint, to be confirmed during implementation:** if the company record carries a website domain from the enrichment layer, show whether the request's email domain matches it. Labelled a hint, never the basis — `email_domain_basis` stays hand-written.

## 12. Abuse and privacy

- **Turnstile plus the honeypot are the in-code controls.** Turnstile is the real defence: a per-submission proof of humanity, which is what an automated submitter cannot cheaply produce.
- **Rate limiting is a deployment step, not code.** A WAF rate-limiting rule on `POST /api/verify/request`, configured at the zone. Cloudflare's `ratelimit` binding went GA for Workers in September 2025, but the Pages Functions bindings documentation does not list it, so this design does not assume it is available here. If it proves to be, it is a strictly better home and the WAF rule can be retired.
- The endpoint reveals nothing about company existence or attestation status (§8).
- `contact_email`, `referrer_note` and `note` are personal data of a business contact. They fall under the existing verification privacy policy, which gains a paragraph covering requests that never become attestations, and a retention rule: **a request in `spam` or `ineligible` is deleted after 90 days**; one that becomes an invitation is retained under the attestation record's terms (§9 of the pilot design). **The purge runs in `workers/verification-reconciler`**, which already holds a daily cron (`15 4 * * *`) and a `VERIFY_DB` binding — no new worker and no new schedule.
- The page carries no analytics beyond the site's existing page-view event, and the form's contents are never sent to GA4.

## 13. Testing

| Level | Assertion |
|---|---|
| `src/verify/emailDomain.test.js` | Accepts a corporate domain; rejects each listed provider and any subdomain of one; distinguishes invalid from consumer; case-insensitive |
| `src/verify/request.test.js` | Rejects missing/over-long fields with field-level reasons; normalises whitespace; honeypot yields a no-write success |
| `functions/api/verify/request.test.js` | Turnstile failure writes nothing; a valid request writes exactly one `new` row; **the success response is byte-identical for a real and a fictional company** |
| `functions/api/verify/admin/requests.test.js` | Listing and decide both refuse without the admin bearer token |
| Copy property test | The page contains the *no identity / no truth* pair and the *mancomunados* exclusion; never says "verificado"/"verified" of the requester's company; states no delivery date for QES |

## 14. Out of scope

Institutional accounts, CSV or bulk submission, a requester-facing status page, any automatic invitation, a public "is this company verified?" lookup, a self-serve draft before operator review, an `/empresa` entry point (a natural follow-on once this page exists), and any payment.

## 15. Success criteria

Ordered by strength of evidence:

1. **An institution cites the URL in its own supplier or onboarding communication.** This is the criterion the work exists for.
2. A company arrives through such a citation and completes an attestation. `referrer_note` is what makes this observable.
3. A request converts to an invitation entirely through the console, with no manual database work.
4. The page is indexed while the rest of `/verificacion/*` remains `noindex`.

**Inbound request volume is not a success criterion.** Volume will be near zero until an institution pushes, because `/empresa`'s audience is investigators rather than companies. Reading low volume as failure of the page would be reading it as failure of a demand channel that has not yet been opened.

## 16. Open questions

1. Whether a rejected request should be told it was rejected, and in what words. Inherits the same tension as §14.3 of the pilot design; current assumption is yes, with a reason.
2. Whether the corporate-domain rule survives contact with real pilot companies, or whether the escape hatch becomes the main path. The escape-hatch volume is the measurement.
3. Whether `/verificacion` should be linked from the site navigation while `VERIFY_VISIBILITY=private`, or remain findable only by citation and search.
4. **Whether the pilot is free.** §7 assumes it is, and says so on the page. This is a commercial call, not a technical one: charging would filter for seriousness but would collapse the volume a pilot needs, and it would change the page's copy materially. Flagged rather than decided.
