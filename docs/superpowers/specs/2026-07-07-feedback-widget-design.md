# Feedback widget — design spec

**Date:** 2026-07-07
**Status:** Approved, pending implementation plan

## Problem

Visitor traffic to the `/app` graph tool is growing, but there's no way to hear from visitors — whether they like it, what's confusing, what they'd want next. We need a way to collect that feedback that is polite, friendly, and unobtrusive, yet fast to use and effective at surfacing real opinions. Bilingual (English/Spanish), matching the rest of the app.

## Scope

- **In scope:** a persistent feedback tab on the `/app` graph tool (the main product surface), a quick-reaction + optional-comment form, delivery to the site owner's inbox.
- **Out of scope (this iteration):** the landing page, Due Diligence report pages, SEO/company pages, an in-app admin view of past submissions, CAPTCHA/bot-verification, reply-to-user flows.

## UX & placement

A small pill-shaped tab labeled "Feedback" (EN) / "Opinión" (ES) is fixed to the **bottom-right** of the `/app` screen, above the graph canvas. Bottom-right is chosen specifically to avoid the existing right-edge, full-height panels (`Ibex35MarketSidebar`, `ApoderadosSidebar`), which only appear conditionally and would otherwise collide with a right-edge-centered tab.

Tapping the tab expands a compact card directly above it:

- Three reaction faces — 🙁 😐 🙂 — tapping one selects it (visually highlighted); picking a reaction is optional.
- An optional multi-line text field: "What would you improve?" (EN) / "¿Qué mejorarías?" (ES). Visually capped around 500 characters; hard-capped at 2000 server-side.
- A submit button, enabled once the visitor has picked a reaction **or** entered comment text — never allows a fully empty submission.
- On successful submit, the card shows a brief confirmation ("Thanks! 🎉" / "¡Gracias!") for ~2 seconds, then auto-collapses back to the closed tab.
- No auto-show, no timed pop-up, no dismissal-tracking needed — it is purely visitor-initiated, so none of the Android auto-show suppression concerns that applied to `Ibex35MarketSidebar` apply here.
- Respects Android safe-area insets (`env(safe-area-inset-bottom)` etc.), consistent with the existing breadcrumb bar's safe-area handling in `App.jsx`.

## Frontend component

New file: `src/components/FeedbackWidget.jsx`.

- Mounted once, in `App.jsx`, alongside `<SpanishCompanyNetworkGraph>` — i.e. only on the `/app` route, not anywhere else in the app.
- Receives `lang` from `App.jsx`'s existing `language` state (already `'en' | 'es'`), and follows the established `LANG: { en: {...}, es: {...} }` strings-object pattern used by `Ibex35MarketCardBody`'s `IBEX_STRINGS`.
- Local component state only — no new context/provider:
  - `open: boolean`
  - `reaction: 'bad' | 'neutral' | 'good' | null`
  - `comment: string`
  - `status: 'idle' | 'submitting' | 'submitted' | 'error'`
- Includes one hidden honeypot input (visually hidden, not `display:none`/`type=hidden` — those are the first things bots skip — styled off-screen instead), submitted alongside the real fields.

## Backend & data flow

- New Cloudflare Pages Function: `functions/feedback.js`, exporting `onRequestPost`.
- Shared pure logic lives in `functions/_feedbackLib.js` (the `_`-prefix convention already used for unrouted, unit-testable helpers, e.g. `functions/empresa/_confirmation.js`):
  - `validateFeedbackPayload(body)` — trims strings, truncates the comment to the 2000-char cap, requires a `reaction` or non-empty `comment`, and detects a filled honeypot.
  - `buildFeedbackEmail(payload)` — builds a plaintext MIME message from a validated payload (reaction, comment, lang, source page path, timestamp).
- Request flow:
  1. Client `POST`s JSON `{ reaction, comment, lang, page, honeypot }` to `/feedback`.
  2. Function validates via `validateFeedbackPayload`. Honeypot filled → respond `200 { ok: true }` immediately, do nothing else (looks successful to a bot, no email sent). Invalid (empty of both signals, oversized) → `400`.
  3. Valid payload → build the email via `buildFeedbackEmail`, send via the Cloudflare Email Routing `send_email` binding (`env.SEND_EMAIL.send(...)`), respond `200 { ok: true }`.
  4. Any send failure → `502 { ok: false }`.

### Email transport — Cloudflare Email Routing

Chosen over a third-party provider (e.g. Resend) to avoid a new external account/API key — everything stays inside the existing Cloudflare account.

**One-time setup required before this ships (not scriptable from the repo):**
- Confirm Email Routing is enabled for the `mapasocietario.es` zone in the Cloudflare dashboard.
- Confirm/add and verify the destination address (the site owner's inbox).
- Add a `[[send_email]]` binding to `wrangler.toml` pointing at that destination.

**Fallback:** if Email Routing turns out unavailable or unsuitable for this zone, swap the transport inside `functions/_feedbackLib.js`/`functions/feedback.js` for a Resend API call. The frontend component and the `/feedback` contract do not change either way — the transport is fully isolated behind that one function.

## Anti-abuse & error handling

- Honeypot field (see above) — silent-drop, not a rejected response, so it doesn't teach bots to distinguish.
- Server-side validation truncates comment length and rejects fully-empty payloads.
- No CAPTCHA/Turnstile in this iteration: current traffic is low (~40 visits/day per existing analytics), and added friction directly conflicts with the "fast and unobtrusive" goal. This is a deliberate, revisit-if-abused trade-off, not an oversight.
- Client-side: a network or non-2xx response sets `status: 'error'` and shows an inline "Couldn't send — try again" message; the visitor's typed comment and selected reaction are preserved in state (not cleared) so retrying doesn't lose their input.

## Testing

- Unit tests (vitest) for `functions/_feedbackLib.js`:
  - Empty payload (no reaction, no comment) is rejected.
  - Comment-only and reaction-only payloads are both accepted.
  - Honeypot-filled payload is flagged for silent-drop.
  - Comment longer than the 2000-char cap is truncated to the cap rather than rejected (a visitor bypassing the client-side 500-char limit shouldn't lose their feedback outright).
  - Built email contains the right fields for both `en` and `es` payloads.
- Manual verification in the browser (per the `verify` skill) of the full open → select/type → submit → thank-you flow, in both languages, before calling this done — this is a real user-facing flow, not just a function with a return value.

## Explicitly out of scope / deferred

- Any in-app view of historical submissions (an admin tab). If email volume grows past what's manageable inline, that's a natural follow-up, not part of this iteration.
- Showing the widget on the landing page, DD reports, or SEO/company pages.
- Bot verification (Turnstile) beyond the honeypot.
