# Feedback Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent, bilingual (EN/ES) feedback tab to the `/app` graph tool that lets visitors send a quick reaction + optional comment, delivered by email via Cloudflare Email Routing.

**Architecture:** A new `FeedbackWidget` React component (bottom-right fixed tab → expandable card) posts JSON to a new Cloudflare Pages Function (`/feedback`). Pure validation/email-building logic lives in `src/utils/feedbackSubmission.js` so it's covered by the existing `vitest` setup (which only scans `src/**/*.test.js` — logic living solely under `functions/` would not be covered). The function is a thin HTTP handler that calls that shared logic and sends via the `env.SEND_EMAIL` binding.

**Tech Stack:** React 19, MUI 5, Cloudflare Pages Functions, Cloudflare Email Routing (`send_email` binding), Vitest.

## Global Constraints

- Feedback destination address: `mapasocietario@ncdata.eu` (confirmed by the user — do not use any other address).
- Sending address: `feedback@mapasocietario.es`.
- Server-side comment cap: 2000 characters, truncated (not rejected) if exceeded.
- Client-side comment cap: 500 characters (enforced via `maxLength`-style truncation on input).
- A submission must be rejected (400) unless it has a `reaction` or a non-empty `comment` — never send a fully empty email.
- A filled honeypot field must produce a `200 { ok: true }` response with **no** email sent (silent drop — do not reveal the check to a bot).
- Widget mounts only on the `/app` route (inside `src/App.jsx`), not on the landing page, DD reports, or SEO pages.
- Bilingual strings (`en`/`es`) follow the existing `{ en: {...}, es: {...} }` object pattern used by `IBEX_STRINGS` in `src/components/Ibex35MarketCardBody.jsx`.
- No new npm dependencies.

---

### Task 1: Shared feedback validation + email-building logic

**Files:**
- Create: `src/utils/feedbackSubmission.js`
- Test: `src/utils/feedbackSubmission.test.js`

**Interfaces:**
- Produces: `validateFeedbackPayload(body: { reaction?: string, comment?: string, lang?: string, page?: string, honeypot?: string }): { ok: true, payload: { reaction: 'bad'|'neutral'|'good'|null, comment: string, lang: 'en'|'es', page: string } } | { ok: false, reason: 'honeypot' | 'empty' }`
- Produces: `buildFeedbackEmail(payload: { reaction: string|null, comment: string, lang: string, page: string }, opts: { from: string, to: string, timestamp: string }): { subject: string, body: string, raw: string }` — `raw` is a full MIME message string suitable for Cloudflare's `EmailMessage(from, to, raw)`.
- Produces: exported constant `MAX_COMMENT_LENGTH = 2000` (Task 2 does not need this directly, but tests reference it).

- [ ] **Step 1: Write the failing tests**

Create `src/utils/feedbackSubmission.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { validateFeedbackPayload, buildFeedbackEmail, MAX_COMMENT_LENGTH } from './feedbackSubmission';

describe('validateFeedbackPayload', () => {
  it('rejects a payload with neither a reaction nor a comment', () => {
    const result = validateFeedbackPayload({ reaction: null, comment: '   ', lang: 'en', page: '/app' });
    expect(result).toEqual({ ok: false, reason: 'empty' });
  });

  it('accepts a reaction-only payload', () => {
    const result = validateFeedbackPayload({ reaction: 'good', comment: '', lang: 'en', page: '/app' });
    expect(result.ok).toBe(true);
    expect(result.payload).toEqual({ reaction: 'good', comment: '', lang: 'en', page: '/app' });
  });

  it('accepts a comment-only payload', () => {
    const result = validateFeedbackPayload({ reaction: null, comment: 'Love the graph!', lang: 'es', page: '/app' });
    expect(result.ok).toBe(true);
    expect(result.payload).toEqual({ reaction: null, comment: 'Love the graph!', lang: 'es', page: '/app' });
  });

  it('ignores an unrecognized reaction value', () => {
    const result = validateFeedbackPayload({ reaction: 'excellent', comment: 'still counts', lang: 'en', page: '/app' });
    expect(result.ok).toBe(true);
    expect(result.payload.reaction).toBeNull();
  });

  it('defaults lang to "en" when missing or unrecognized', () => {
    const result = validateFeedbackPayload({ reaction: 'good', comment: '', lang: 'fr', page: '/app' });
    expect(result.payload.lang).toBe('en');
  });

  it('silently flags a filled honeypot regardless of other fields', () => {
    const result = validateFeedbackPayload({ reaction: 'good', comment: 'hi', lang: 'en', page: '/app', honeypot: 'i am a bot' });
    expect(result).toEqual({ ok: false, reason: 'honeypot' });
  });

  it('truncates a comment longer than MAX_COMMENT_LENGTH instead of rejecting it', () => {
    const longComment = 'a'.repeat(MAX_COMMENT_LENGTH + 500);
    const result = validateFeedbackPayload({ reaction: null, comment: longComment, lang: 'en', page: '/app' });
    expect(result.ok).toBe(true);
    expect(result.payload.comment).toHaveLength(MAX_COMMENT_LENGTH);
  });

  it('handles a completely empty body without throwing', () => {
    expect(validateFeedbackPayload({})).toEqual({ ok: false, reason: 'empty' });
  });
});

describe('buildFeedbackEmail', () => {
  const opts = { from: 'feedback@mapasocietario.es', to: 'mapasocietario@ncdata.eu', timestamp: '2026-07-07T10:00:00.000Z' };

  it('includes the reaction, language, page, and comment in the body', () => {
    const payload = { reaction: 'good', comment: 'Great tool!', lang: 'en', page: '/app' };
    const { body } = buildFeedbackEmail(payload, opts);
    expect(body).toContain('Great tool!');
    expect(body).toContain('/app');
    expect(body).toContain('2026-07-07T10:00:00.000Z');
  });

  it('labels a null reaction as no reaction selected', () => {
    const payload = { reaction: null, comment: 'Just a comment', lang: 'es', page: '/app' };
    const { body } = buildFeedbackEmail(payload, opts);
    expect(body).toContain('(no reaction selected)');
  });

  it('produces a raw MIME string with From/To/Subject headers and a blank line before the body', () => {
    const payload = { reaction: 'bad', comment: 'Needs work', lang: 'en', page: '/app' };
    const { raw, subject } = buildFeedbackEmail(payload, opts);
    expect(raw).toContain(`From: ${opts.from}`);
    expect(raw).toContain(`To: ${opts.to}`);
    expect(raw).toContain(`Subject: ${subject}`);
    expect(raw).toContain('\r\n\r\n');
  });

  it('strips newlines from header-bound values to prevent header injection', () => {
    const payload = { reaction: 'good', comment: 'irrelevant', lang: 'en', page: '/app\ninjected: true' };
    const { raw } = buildFeedbackEmail(payload, opts);
    expect(raw).not.toContain('injected: true\r\n');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/feedbackSubmission.test.js`
Expected: FAIL — `Cannot find module './feedbackSubmission'` (or similar import error), since the module doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `src/utils/feedbackSubmission.js`:

```javascript
export const MAX_COMMENT_LENGTH = 2000;

const VALID_REACTIONS = ['bad', 'neutral', 'good'];

const REACTION_LABEL = {
  bad: '🙁 Not good',
  neutral: '😐 Neutral',
  good: '🙂 Good',
};

// Strips newlines and trims — used for any value that ends up inside a MIME
// header (Subject/From/To) or inline in a header-adjacent line, so a comment
// or page path can never inject an extra header/line into the raw message.
function sanitizeLine(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

export function validateFeedbackPayload(body) {
  const honeypot = typeof body?.honeypot === 'string' ? body.honeypot.trim() : '';
  if (honeypot) {
    return { ok: false, reason: 'honeypot' };
  }

  const reaction = VALID_REACTIONS.includes(body?.reaction) ? body.reaction : null;
  const comment = typeof body?.comment === 'string'
    ? body.comment.trim().slice(0, MAX_COMMENT_LENGTH)
    : '';
  const lang = body?.lang === 'es' ? 'es' : 'en';
  const page = sanitizeLine(body?.page).slice(0, 500);

  if (!reaction && !comment) {
    return { ok: false, reason: 'empty' };
  }

  return { ok: true, payload: { reaction, comment, lang, page } };
}

export function buildFeedbackEmail(payload, { from, to, timestamp }) {
  const reactionLabel = REACTION_LABEL[payload.reaction] || '(no reaction selected)';
  const subject = sanitizeLine(`Mapa Societario feedback (${payload.lang}) — ${reactionLabel}`);
  const body = [
    `Reaction: ${reactionLabel}`,
    `Language: ${payload.lang}`,
    `Page: ${payload.page || '(unknown)'}`,
    `Time: ${timestamp}`,
    '',
    'Comment:',
    payload.comment || '(none)',
  ].join('\n');

  const raw = [
    `From: ${sanitizeLine(from)}`,
    `To: ${sanitizeLine(to)}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].join('\r\n');

  return { subject, body, raw };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/feedbackSubmission.test.js`
Expected: PASS — all 13 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/feedbackSubmission.js src/utils/feedbackSubmission.test.js
git commit -m "feat: add feedback validation and email-building logic"
```

---

### Task 2: Cloudflare Pages Function + Email Routing binding

**Files:**
- Create: `functions/feedback.js`
- Modify: `wrangler.toml`

**Interfaces:**
- Consumes: `validateFeedbackPayload` and `buildFeedbackEmail` from `src/utils/feedbackSubmission.js` (Task 1).
- Produces: `onRequestPost({ request, env })` — the Cloudflare Pages Functions entry point for `POST /feedback`. Responds with JSON `{ ok: boolean, error?: string }` and status 200/400/502.

- [ ] **Step 1: Add the `send_email` binding to `wrangler.toml`**

`wrangler.toml` currently reads:

```toml
name = "mapasocietario"
compatibility_date = "2024-12-01"
pages_build_output_dir = "dist"
```

Change it to:

```toml
name = "mapasocietario"
compatibility_date = "2024-12-01"
pages_build_output_dir = "dist"

[[send_email]]
name = "SEND_EMAIL"
destination_address = "mapasocietario@ncdata.eu"
```

**Note for whoever deploys this:** Email Routing must be enabled for the `mapasocietario.es` zone in the Cloudflare dashboard, and `mapasocietario@ncdata.eu` must be added and verified as a destination address on that account, before this binding will actually deliver mail in production. `wrangler pages dev` will not send real emails locally — Task 5's manual verification covers the client-side flow up to the network call; the actual email delivery can only be confirmed after deployment with Email Routing enabled.

- [ ] **Step 2: Create the Pages Function**

Create `functions/feedback.js`:

```javascript
/**
 * POST /feedback — receives the FeedbackWidget submission and emails it via
 * the Cloudflare Email Routing `send_email` binding (see wrangler.toml).
 * All validation/formatting logic lives in ../src/utils/feedbackSubmission.js
 * so it's covered by the vitest suite (vitest only scans src/**\/*.test.js).
 */
import { EmailMessage } from 'cloudflare:email';
import { validateFeedbackPayload, buildFeedbackEmail } from '../src/utils/feedbackSubmission.js';

const FEEDBACK_FROM = 'feedback@mapasocietario.es';
const FEEDBACK_TO = 'mapasocietario@ncdata.eu';

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }

  const result = validateFeedbackPayload(body);

  if (!result.ok && result.reason === 'honeypot') {
    // Pretend success to whatever filled the honeypot — no email sent, and
    // no signal given that the check exists.
    return jsonResponse({ ok: true }, 200);
  }

  if (!result.ok) {
    return jsonResponse({ ok: false, error: result.reason }, 400);
  }

  const { raw } = buildFeedbackEmail(result.payload, {
    from: FEEDBACK_FROM,
    to: FEEDBACK_TO,
    timestamp: new Date().toISOString(),
  });

  try {
    const message = new EmailMessage(FEEDBACK_FROM, FEEDBACK_TO, raw);
    await env.SEND_EMAIL.send(message);
  } catch (err) {
    console.error('[feedback] send failed:', err.message);
    return jsonResponse({ ok: false, error: 'send_failed' }, 502);
  }

  return jsonResponse({ ok: true }, 200);
}
```

- [ ] **Step 3: Run the full test suite to make sure nothing broke**

Run: `npm test`
Expected: PASS — all existing tests plus Task 1's new tests are green. (`functions/feedback.js` itself is not covered by vitest — it has no logic of its own beyond wiring, consistent with the rest of `functions/`.)

- [ ] **Step 4: Commit**

```bash
git add functions/feedback.js wrangler.toml
git commit -m "feat: add /feedback Pages Function using Cloudflare Email Routing"
```

---

### Task 3: FeedbackWidget component

**Files:**
- Create: `src/components/FeedbackWidget.jsx`

**Interfaces:**
- Consumes: nothing new from earlier tasks (calls `fetch('/feedback', ...)` directly, matching Task 2's contract: `{ reaction, comment, lang, page, honeypot }` in, `{ ok, error? }` out).
- Produces: default export `FeedbackWidget({ lang: 'en' | 'es' })` — a self-contained React component with no required props beyond `lang`, mounted by Task 4.

- [ ] **Step 1: Create the component**

Create `src/components/FeedbackWidget.jsx`:

```jsx
import React from 'react';
import { Box, Paper, IconButton, TextField, Typography, CircularProgress, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const STRINGS = {
  en: {
    tabLabel: 'Feedback',
    title: 'How are we doing?',
    placeholder: 'What would you improve?',
    submit: 'Send',
    thanks: 'Thanks! 🎉',
    error: "Couldn't send — try again.",
    close: 'Close',
    reactions: [
      { value: 'bad', emoji: '🙁', label: 'Not good' },
      { value: 'neutral', emoji: '😐', label: 'Neutral' },
      { value: 'good', emoji: '🙂', label: 'Good' },
    ],
  },
  es: {
    tabLabel: 'Opinión',
    title: '¿Qué te parece?',
    placeholder: '¿Qué mejorarías?',
    submit: 'Enviar',
    thanks: '¡Gracias! 🎉',
    error: 'No se pudo enviar — inténtalo de nuevo.',
    close: 'Cerrar',
    reactions: [
      { value: 'bad', emoji: '🙁', label: 'No muy bien' },
      { value: 'neutral', emoji: '😐', label: 'Neutral' },
      { value: 'good', emoji: '🙂', label: 'Bien' },
    ],
  },
};

const CLIENT_MAX_COMMENT_LENGTH = 500;
const THANKS_DISPLAY_MS = 2000;
const WIDGET_Z_INDEX = 1300;

// Bottom-right (not right-edge-centered) so it never collides with the
// existing full-height right-anchored panels (Ibex35MarketSidebar,
// ApoderadosSidebar), which only appear conditionally.
const FIXED_POSITION_SX = {
  position: 'fixed',
  right: 'calc(16px + env(safe-area-inset-right))',
  bottom: 'calc(16px + env(safe-area-inset-bottom))',
  zIndex: WIDGET_Z_INDEX,
};

const FeedbackWidget = ({ lang = 'en' }) => {
  const t = STRINGS[lang === 'es' ? 'es' : 'en'];
  const [open, setOpen] = React.useState(false);
  const [reaction, setReaction] = React.useState(null);
  const [comment, setComment] = React.useState('');
  const [honeypot, setHoneypot] = React.useState('');
  const [status, setStatus] = React.useState('idle'); // idle | submitting | submitted | error

  React.useEffect(() => {
    if (status !== 'submitted') return undefined;
    const timer = setTimeout(() => {
      setOpen(false);
      setStatus('idle');
      setReaction(null);
      setComment('');
    }, THANKS_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const canSubmit = Boolean(reaction || comment.trim());

  const handleSubmit = async () => {
    if (!canSubmit || status === 'submitting') return;
    setStatus('submitting');
    try {
      const res = await fetch('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reaction,
          comment: comment.trim(),
          lang,
          page: window.location.pathname,
          honeypot,
        }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setStatus('submitted');
    } catch {
      setStatus('error');
    }
  };

  if (!open) {
    return (
      <Button
        variant="contained"
        onClick={() => setOpen(true)}
        sx={{
          ...FIXED_POSITION_SX,
          borderRadius: '20px',
          textTransform: 'none',
          fontWeight: 600,
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
        }}
      >
        {t.tabLabel}
      </Button>
    );
  }

  return (
    <Paper
      elevation={8}
      sx={{
        ...FIXED_POSITION_SX,
        width: 300,
        maxWidth: 'calc(100vw - 32px)',
        p: 2,
        borderRadius: '12px',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {t.title}
        </Typography>
        <IconButton size="small" aria-label={t.close} onClick={() => setOpen(false)}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {status === 'submitted' ? (
        <Typography variant="body2" sx={{ py: 2, textAlign: 'center' }}>
          {t.thanks}
        </Typography>
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 1.5 }}>
            {t.reactions.map(r => (
              <IconButton
                key={r.value}
                aria-label={r.label}
                onClick={() => setReaction(r.value)}
                sx={{
                  fontSize: '1.5rem',
                  border: '2px solid',
                  borderColor: reaction === r.value ? 'primary.main' : 'transparent',
                  bgcolor: reaction === r.value ? 'action.selected' : 'transparent',
                }}
              >
                {r.emoji}
              </IconButton>
            ))}
          </Box>

          <TextField
            multiline
            minRows={2}
            maxRows={4}
            fullWidth
            placeholder={t.placeholder}
            value={comment}
            onChange={e => setComment(e.target.value.slice(0, CLIENT_MAX_COMMENT_LENGTH))}
            size="small"
            sx={{ mb: 1 }}
          />

          {/* Honeypot: visually hidden off-screen, not display:none/type=hidden
              (the first things bots skip). Left blank by a human; a filled
              value tells the server to silently drop the submission. */}
          <Box
            component="input"
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={e => setHoneypot(e.target.value)}
            sx={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            aria-hidden="true"
          />

          {status === 'error' && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
              {t.error}
            </Typography>
          )}

          <Button
            fullWidth
            variant="contained"
            disabled={!canSubmit || status === 'submitting'}
            onClick={handleSubmit}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {status === 'submitting' ? <CircularProgress size={16} color="inherit" /> : t.submit}
          </Button>
        </>
      )}
    </Paper>
  );
};

export default FeedbackWidget;
```

- [ ] **Step 2: Run the full test suite to make sure nothing broke**

Run: `npm test`
Expected: PASS — this component has no pure logic to unit test (per `vitest.config.js`'s comment: "Canvas/UX behavior is verified by running the app, not here"); Task 5 covers it manually.

- [ ] **Step 3: Commit**

```bash
git add src/components/FeedbackWidget.jsx
git commit -m "feat: add FeedbackWidget component"
```

---

### Task 4: Mount the widget in the app

**Files:**
- Modify: `src/App.jsx:8` (imports), `src/App.jsx:248-255` (render)

**Interfaces:**
- Consumes: `FeedbackWidget` default export from Task 3, and the existing `language` state already declared in `App.jsx` (`const [language, setLanguage] = React.useState(getInitialLanguage);`).

- [ ] **Step 1: Add the import**

In `src/App.jsx`, after line 8 (`import SpanishCompanyNetworkGraph from './components/SpanishCompanyNetworkGraph';`), add:

```javascript
import FeedbackWidget from './components/FeedbackWidget';
```

- [ ] **Step 2: Mount the widget**

In `src/App.jsx`, the render currently ends with (lines 248–254):

```jsx
      <SpanishCompanyNetworkGraph
        visible={true}
        embedded={true}
        initialCompanyName={initialSearch}
        language={language}
      />
    </Box>
  );
```

Change it to:

```jsx
      <SpanishCompanyNetworkGraph
        visible={true}
        embedded={true}
        initialCompanyName={initialSearch}
        language={language}
      />
      <FeedbackWidget lang={language} />
    </Box>
  );
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — no logic changed, only composition.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: mount FeedbackWidget on the /app graph tool"
```

---

### Task 5: Manual verification

No files change in this task — it's a browser-driven check per the `verify` skill, since this is a real user-facing flow (open → select/type → submit → thank-you), not just a function with a return value.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify the closed-tab state**

Open `http://localhost:5173/app` (or the port Vite reports) in a browser. Confirm:
- A "Feedback" pill button is fixed to the bottom-right corner, above the graph.
- It does not overlap or get hidden by any other UI on initial load.

- [ ] **Step 3: Verify the open/expand flow**

Click the tab. Confirm:
- The card expands showing the title, three emoji reactions, a comment box, and a Send button.
- Send button is disabled until either a reaction is picked or text is typed.
- Clicking a reaction highlights it (border/background change); clicking a different one moves the highlight, not adds to it.
- The close (X) icon collapses the card back to the tab without submitting.

- [ ] **Step 4: Verify submission (network layer)**

With the card open, pick a reaction and/or type a comment, then click Send. Using the browser's network tab, confirm:
- A `POST /feedback` request fires with the expected JSON body (`reaction`, `comment`, `lang`, `page`, `honeypot: ''`).
- Locally (`npm run dev` / Vite, no Pages Functions runtime) this request will 404 or fail since `functions/feedback.js` only runs under `wrangler pages dev` or on an actual Pages deployment — confirm the widget's error state ("Couldn't send — try again.") displays gracefully in that case, and that the typed comment/selected reaction are still present (not cleared) after the error.

- [ ] **Step 5: Verify against the Pages Functions runtime**

Run: `npx wrangler pages dev dist --compatibility-date=2024-12-01` (after `npm run build`), or equivalent per the project's existing deploy tooling.
Confirm a `POST /feedback` with a valid body returns `{ "ok": true }` with status 200, and that a payload with neither `reaction` nor `comment` returns `{ "ok": false, "error": "empty" }` with status 400. (Real email delivery cannot be confirmed until Email Routing is enabled and deployed per Task 2's note — that final check happens after deploy, not here.)

- [ ] **Step 6: Verify Spanish copy**

Reload with `?lang=es` (or toggle the in-app language switcher). Confirm the tab label, title, placeholder, reactions' `aria-label`s, and both success/error messages all render in Spanish, not English.

- [ ] **Step 7: Verify the widget is absent elsewhere**

Visit the landing page (`/`) and a Due Diligence report page. Confirm the Feedback tab does **not** appear on either — it should only be on `/app`.
