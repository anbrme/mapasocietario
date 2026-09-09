# Verification Request Front Door — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a company that has just been told to obtain a verification a page that explains it and a form that records its request — where the strongest thing a request can cause is a row in the operator's queue.

**Architecture:** A public, indexable Pages Function at `/verificacion` (the one member of that family that is not `noindex`), a Turnstile-gated `POST /api/verify/request` whose decision logic is pure and unit-tested, one new table strictly upstream of the existing invitation flow, and a Solicitudes section in the console that converts a request through the invite flow that already exists.

**Tech Stack:** Cloudflare Pages Functions, D1 (`VERIFY_DB` = `mapasocietario-verify`), Cloudflare Email Sending REST API, Turnstile, vitest.

**Spec:** `docs/superpowers/specs/2026-09-09-verification-request-front-door-design.md`

## Global Constraints

- **Only the company may request verification of its own data.** Third-party requests — an institution naming a supplier for us to chase — are refused. Copy must say so.
- **A request GRANTS NOTHING.** The invariant: *no path exists from public input to an invitation token without an operator action that records `representation_basis`, `identification_note` and `email_domain_basis`.* Nothing in this plan may weaken that.
- **The success response is byte-identical** for a real company, a fictional one, and one that already holds a live attestation. The form is never an oracle.
- **The corporate-domain rule is a NEGATIVE check.** It establishes that an address is not a known consumer mailbox and nothing about affiliation. It does **not** satisfy `email_domain_basis`. No copy may present it as evidence.
- **No acknowledgement email to the requester** — that would be a send-to-arbitrary-address surface for no gain. The operator is notified; the page confirms on screen.
- **Page copy must** carry the *no identity / no truth* pair and the *mancomunados* exclusion; must never say "verificado"/"verified" of the requester's company; must state **no delivery date** for QES.
- `/verificacion` is the **only indexable** member of its family: it must NOT call `privateHeaders()` and must NOT set a `noindex` robots tag. Its siblings keep theirs.
- Turnstile **fails closed**: a missing secret rejects the submission rather than waving it through.
- Contact email: `mapasocietario@ncdata.eu`. Turnstile sitekey (public, shared with existing widgets): `0x4AAAAAADp3WnZGNiZai_32`.
- Run the suite with `npm test`. **Baseline: vitest 1108, node 321.** Report both totals every time; if vitest is not baseline + the tests you added, something was overwritten.
- Commit with `git -c commit.gpgsign=false commit`. Migrations apply `--local` only during implementation.

---

### Task 1: The pure validation layer

**Files:**
- Create: `src/verify/emailDomain.js`, `src/verify/emailDomain.test.js`
- Create: `src/verify/request.js`, `src/verify/request.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `classifyEmailDomain(email)` → `'invalid' | 'consumer' | 'corporate'`
  - `isCorporateEmailDomain(email)` → boolean
  - `validateRequestPayload(body)` → `{ ok: true, payload }` or `{ ok: false, reason, field? }`, where `reason` is `'honeypot'`, `'<field>_required'`, `'contact_email_invalid'` or `'contact_email_not_corporate'`
  - `buildRequestEmail(payload, { from, to, timestamp, id })` → `{ to, from, subject, text }`
  - `MAX` — the per-field length caps

  Task 2 consumes all four.

**Three outcomes, not two:** the domain classifier separates *invalid* from *consumer* so the form can say which thing is wrong. A real company told "that address is malformed" when it is merely Gmail would be sent chasing the wrong problem.

- [ ] **Step 1: Write the failing domain tests**

Create `src/verify/emailDomain.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { classifyEmailDomain, isCorporateEmailDomain } from './emailDomain.js';

describe('classifyEmailDomain', () => {
  it('accepts a corporate domain', () => {
    expect(classifyEmailDomain('ana@acme.es')).toBe('corporate');
  });

  it('rejects the unambiguous consumer providers', () => {
    for (const address of [
      'a@gmail.com', 'a@googlemail.com', 'a@outlook.com', 'a@hotmail.es',
      'a@live.com', 'a@msn.com', 'a@yahoo.es', 'a@ymail.com', 'a@icloud.com',
      'a@me.com', 'a@aol.com', 'a@gmx.es', 'a@mail.com', 'a@protonmail.com',
      'a@proton.me', 'a@yandex.ru', 'a@zoho.com',
    ]) {
      expect(classifyEmailDomain(address)).toBe('consumer');
    }
  });

  it('rejects the Spanish ISP mailboxes', () => {
    for (const address of ['a@terra.es', 'a@telefonica.net', 'a@wanadoo.es',
                           'a@ono.com', 'a@movistar.es', 'a@orange.es']) {
      expect(classifyEmailDomain(address)).toBe('consumer');
    }
  });

  it('rejects a subdomain of a consumer domain', () => {
    expect(classifyEmailDomain('a@foo.gmail.com')).toBe('consumer');
  });

  it('does not reject a corporate domain that merely ENDS in a consumer name', () => {
    // "notgmail.com" is a different domain from "gmail.com" - only a dot
    // boundary counts as a subdomain.
    expect(classifyEmailDomain('a@notgmail.com')).toBe('corporate');
  });

  it('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(classifyEmailDomain('  Ana@GMAIL.com ')).toBe('consumer');
    expect(classifyEmailDomain(' Ana@Acme.ES ')).toBe('corporate');
  });

  it('calls a malformed address invalid, not consumer', () => {
    for (const bad of ['', null, undefined, 'ana', 'ana@', '@acme.es',
                       'ana@acme', 'ana@.es', 'ana@acme.', 'a b@acme.es',
                       'ana@192.168.0.1', 'ana@[192.168.0.1]']) {
      expect(classifyEmailDomain(bad)).toBe('invalid');
    }
  });
});

describe('isCorporateEmailDomain', () => {
  it('is true only for the corporate case', () => {
    expect(isCorporateEmailDomain('ana@acme.es')).toBe(true);
    expect(isCorporateEmailDomain('ana@gmail.com')).toBe(false);
    expect(isCorporateEmailDomain('nonsense')).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/verify/emailDomain.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the classifier**

Create `src/verify/emailDomain.js`:

```js
/**
 * Is this address on a corporate domain?
 *
 * A NEGATIVE check, and the distinction is the whole point: it establishes that
 * an address is not a KNOWN CONSUMER MAILBOX. It establishes nothing whatsoever
 * about affiliation with any company - anyone can buy a domain in minutes. It
 * therefore does NOT satisfy `email_domain_basis`, which the operator still
 * records by hand, and no copy may present it as evidence of anything.
 *
 * It will also reject real companies: a large share of legitimate Spanish SLs
 * run on Gmail. That is why the rule is stated ABOVE the form and its rejection
 * carries a way through. It is a pilot rule, labelled as one, so relaxing it
 * later is a planned step rather than a climbdown.
 */

// Unambiguous consumer mailboxes only. A domain in doubt is left OUT: a false
// accept costs one row in a queue, a false reject costs a real lead.
const CONSUMER_DOMAINS = [
  'gmail.com', 'googlemail.com',
  'outlook.com', 'outlook.es', 'hotmail.com', 'hotmail.es', 'hotmail.co.uk',
  'live.com', 'live.es', 'msn.com',
  'yahoo.com', 'yahoo.es', 'yahoo.co.uk', 'ymail.com', 'rocketmail.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'gmx.com', 'gmx.es', 'gmx.net', 'mail.com',
  'protonmail.com', 'proton.me', 'pm.me',
  'yandex.com', 'yandex.ru', 'tutanota.com', 'zoho.com',
  // Spanish ISP mailboxes - the local equivalent of the list above.
  'terra.es', 'telefonica.net', 'wanadoo.es', 'ono.com', 'movistar.es',
  'orange.es', 'vodafone.es', 'euskaltel.net', 'telecable.es', 'ya.com',
  // Disposable: a SHORT list on purpose. Turnstile and operator review handle
  // the long tail, and chasing it is a losing game.
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'yopmail.com',
  'temp-mail.org', 'throwawaymail.com', 'sharklasers.com',
];

const CONSUMER = new Set(CONSUMER_DOMAINS);
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * 'invalid' | 'consumer' | 'corporate' - three outcomes, not two, so the form
 * can say WHICH thing is wrong. Telling a real company its address is malformed
 * when it is merely Gmail sends it chasing the wrong problem.
 */
export function classifyEmailDomain(email) {
  const value = String(email == null ? '' : email).trim().toLowerCase();
  if (!value || /\s/.test(value)) return 'invalid';

  const at = value.lastIndexOf('@');
  if (at < 1 || at === value.length - 1) return 'invalid';

  const domain = value.slice(at + 1);
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) return 'invalid';
  if (IPV4.test(domain) || domain.startsWith('[')) return 'invalid';

  if (CONSUMER.has(domain)) return 'consumer';
  // Only a DOT boundary counts as a subdomain, so "notgmail.com" stays
  // corporate while "foo.gmail.com" does not.
  for (const entry of CONSUMER_DOMAINS) {
    if (domain.endsWith(`.${entry}`)) return 'consumer';
  }
  return 'corporate';
}

export const isCorporateEmailDomain = (email) => classifyEmailDomain(email) === 'corporate';
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/verify/emailDomain.test.js`
Expected: PASS.

- [ ] **Step 5: Write the failing payload tests**

Create `src/verify/request.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { validateRequestPayload, buildRequestEmail, MAX } from './request.js';

const good = (o = {}) => ({
  company_query: 'ACME SOLUCIONES SL',
  nif: 'b12345678',
  contact_name: 'Ana Gómez',
  contact_role: 'Administradora única',
  contact_email: 'ana@acme.es',
  referrer_note: 'Nos lo pidió nuestro banco',
  note: 'Preferimos que nos escriban en español.',
  ...o,
});

describe('validateRequestPayload', () => {
  it('accepts a complete request and normalises it', () => {
    const r = validateRequestPayload(good({ contact_email: '  ANA@Acme.ES ', nif: ' b12345678 ' }));
    expect(r.ok).toBe(true);
    expect(r.payload.contact_email).toBe('ana@acme.es');
    expect(r.payload.nif).toBe('B12345678');
  });

  it('treats a filled honeypot as a honeypot, before anything else', () => {
    // Deliberately also missing every required field: the honeypot must win,
    // so a bot learns nothing from the response.
    const r = validateRequestPayload({ website: 'http://spam' });
    expect(r).toEqual({ ok: false, reason: 'honeypot' });
  });

  it('names the missing field so the form can point at it', () => {
    for (const field of ['company_query', 'contact_name', 'contact_role', 'contact_email']) {
      const r = validateRequestPayload(good({ [field]: '   ' }));
      expect(r.ok).toBe(false);
      expect(r.reason).toBe(`${field}_required`);
      expect(r.field).toBe(field);
    }
  });

  it('separates a malformed address from a consumer one', () => {
    expect(validateRequestPayload(good({ contact_email: 'nonsense' })).reason)
      .toBe('contact_email_invalid');
    expect(validateRequestPayload(good({ contact_email: 'ana@gmail.com' })).reason)
      .toBe('contact_email_not_corporate');
  });

  it('caps every field rather than rejecting a long one', () => {
    const r = validateRequestPayload(good({
      company_query: 'x'.repeat(500), note: 'y'.repeat(5000),
    }));
    expect(r.ok).toBe(true);
    expect(r.payload.company_query).toHaveLength(MAX.company_query);
    expect(r.payload.note).toHaveLength(MAX.note);
  });

  it('collapses newlines in single-line fields', () => {
    const r = validateRequestPayload(good({ contact_name: 'Ana\r\nGómez' }));
    expect(r.payload.contact_name).toBe('Ana Gómez');
  });

  it('keeps newlines in the note, which may legitimately have paragraphs', () => {
    const r = validateRequestPayload(good({ note: 'Primera linea.\n\nSegunda linea.' }));
    expect(r.payload.note).toBe('Primera linea.\n\nSegunda linea.');
  });

  it('nulls the optional fields when blank, rather than storing empty strings', () => {
    const r = validateRequestPayload(good({ nif: '', referrer_note: '  ', note: '' }));
    expect(r.payload.nif).toBeNull();
    expect(r.payload.referrer_note).toBeNull();
    expect(r.payload.note).toBeNull();
  });
});

describe('buildRequestEmail', () => {
  const built = () => buildRequestEmail(validateRequestPayload(good()).payload, {
    from: 'verificacion@ncdata.eu', to: 'mapasocietario@ncdata.eu',
    timestamp: '2026-09-10T08:00:00Z', id: 'req_abc',
  });

  it('carries the company, the person and who prompted them', () => {
    const text = built().text;
    expect(text).toContain('ACME SOLUCIONES SL');
    expect(text).toContain('ana@acme.es');
    expect(text).toContain('Nos lo pidió nuestro banco');
    expect(text).toContain('req_abc');
  });

  it('puts the company in the subject so the inbox is scannable', () => {
    expect(built().subject).toContain('ACME SOLUCIONES SL');
  });

  it('never lets a newline break out of a header field', () => {
    // Deliberately NOT routed through validateRequestPayload: that strips the
    // newline first, and this test would then pass with the sanitiser deleted -
    // re-testing the validator while pretending to guard the email builder.
    const raw = {
      company_query: 'ACME\r\nBcc: x@y.z', nif: null, contact_name: 'Ana',
      contact_role: 'Adm', contact_email: 'a@b.c', referrer_note: null, note: null,
    };
    const mail = buildRequestEmail(raw, { from: 'a@b.c', to: 'd@e.f',
                                          timestamp: 't', id: 'req_1' });
    expect(mail.subject).not.toMatch(/[\r\n]/);
    expect(mail.subject).toContain('ACME Bcc: x@y.z');
  });
});
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npx vitest run src/verify/request.test.js`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement the validator**

Create `src/verify/request.js`:

```js
/**
 * Validation and formatting for an inbound verification request.
 *
 * A request GRANTS NOTHING - it is a lead in the operator's queue. The path to
 * an invitation runs through a person who records representation_basis,
 * identification_note and email_domain_basis by hand, none of which the system
 * can infer. Keep it that way.
 *
 * Lives here rather than in the Function so vitest can reach it, matching the
 * split used by the rest of src/verify/.
 */
import { classifyEmailDomain } from './emailDomain.js';

export const MAX = {
  company_query: 200,
  nif: 20,
  contact_name: 120,
  contact_role: 120,
  contact_email: 254,   // RFC 5321 maximum path length
  referrer_note: 500,
  note: 2000,
};

const REQUIRED = ['company_query', 'contact_name', 'contact_role', 'contact_email'];

// Single-line fields render into an email subject and an operator table, so a
// newline in them is noise at best.
const line = (v) => String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim();

export function validateRequestPayload(body) {
  // The honeypot is checked FIRST and reported alone: a bot that also omitted
  // required fields must learn nothing from which complaint comes back.
  if (line(body?.website)) return { ok: false, reason: 'honeypot' };

  const payload = {
    company_query: line(body?.company_query).slice(0, MAX.company_query),
    nif: line(body?.nif).slice(0, MAX.nif).toUpperCase() || null,
    contact_name: line(body?.contact_name).slice(0, MAX.contact_name),
    contact_role: line(body?.contact_role).slice(0, MAX.contact_role),
    contact_email: line(body?.contact_email).slice(0, MAX.contact_email).toLowerCase(),
    referrer_note: line(body?.referrer_note).slice(0, MAX.referrer_note) || null,
    // The only multi-line field: a note may legitimately have paragraphs.
    note: String(body?.note == null ? '' : body.note).trim().slice(0, MAX.note) || null,
  };

  for (const field of REQUIRED) {
    if (!payload[field]) return { ok: false, reason: `${field}_required`, field };
  }

  const domain = classifyEmailDomain(payload.contact_email);
  if (domain === 'invalid') {
    return { ok: false, reason: 'contact_email_invalid', field: 'contact_email' };
  }
  if (domain === 'consumer') {
    return { ok: false, reason: 'contact_email_not_corporate', field: 'contact_email' };
  }

  return { ok: true, payload };
}

/**
 * The operator notification. Mirrors buildFeedbackEmail's shape for
 * Cloudflare's Email Sending REST API: plain `from`/`to` strings, a subject and
 * a text body.
 */
export function buildRequestEmail(payload, { from, to, timestamp, id }) {
  const subject = line(`Solicitud de verificación — ${payload.company_query}`);
  const text = [
    `Empresa:   ${payload.company_query}`,
    `NIF:       ${payload.nif || '(no indicado)'}`,
    `Contacto:  ${payload.contact_name} — ${payload.contact_role}`,
    `Correo:    ${payload.contact_email}`,
    `Se lo pidió: ${payload.referrer_note || '(no indicado)'}`,
    `Recibida:  ${timestamp}`,
    `Id:        ${id}`,
    '',
    'Nota:',
    payload.note || '(ninguna)',
    '',
    'Esto es una SOLICITUD, no una invitación. Nadie ha recibido ningún enlace.',
    'Resuelva la empresa y emita la invitación desde /admin/verificacion.',
  ].join('\n');

  return { to, from, subject, text };
}
```

- [ ] **Step 8: Run the suite and commit**

```bash
npm test
git add src/verify/emailDomain.js src/verify/emailDomain.test.js src/verify/request.js src/verify/request.test.js
git -c commit.gpgsign=false commit -m "feat(verify): validation for an inbound verification request

The domain check is a NEGATIVE one: it establishes that an address is not
a known consumer mailbox and nothing about affiliation, so it does not
satisfy email_domain_basis. It also rejects real companies - plenty of
Spanish SLs run on Gmail - which is why it reports 'not corporate'
separately from 'malformed' and why the copy carries a way through.

The honeypot is checked first and reported alone, so a bot that also
omitted required fields learns nothing from which complaint comes back."
```

---

### Task 2: The request endpoint

**Files:**
- Create: `migrations/0005_verification_requests.sql`
- Create: `functions/api/verify/request.js`
- Create: `functions/api/verify/request.test.js`

**Interfaces:**
- Consumes: `validateRequestPayload`, `buildRequestEmail` (Task 1); `newId` from `src/verify/ids.js`.
- Produces: the `verification_requests` table and `POST /api/verify/request`. Tasks 4 and 5 read that table.

**Turnstile fails closed.** A missing `VERIFY_TURNSTILE_SECRET` rejects the submission. An unprotected public write that silently degrades open is worse than an outage you can see.

- [ ] **Step 1: Write the migration**

Create `migrations/0005_verification_requests.sql`:

```sql
-- VERIFY_DB - inbound requests from companies asking to be verified.
-- Spec: docs/superpowers/specs/2026-09-09-verification-request-front-door-design.md
--
-- A request GRANTS NOTHING: it is a lead. The path to an invitation runs
-- through the operator, who records representation_basis, identification_note
-- and email_domain_basis by hand - none of which the system can infer. This
-- table is strictly UPSTREAM of /api/verify/admin/invite and touches nothing in
-- the trust model, the audit chain or the reconciliation loop.
--
-- contact_email is a CANDIDATE contact, never an automatic recipient of an
-- invitation token. The operator confirms the address and records why that
-- domain belongs to that company, exactly as before.
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

CREATE INDEX idx_verification_requests_status
  ON verification_requests(status, created_at);

-- The 90-day purge of spam/ineligible rows scans by date across statuses.
CREATE INDEX idx_verification_requests_created_at
  ON verification_requests(created_at);
```

- [ ] **Step 2: Write the failing endpoint tests**

Create `functions/api/verify/request.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onRequestPost } from './request.js';

const body = (o = {}) => JSON.stringify({
  company_query: 'ACME SOLUCIONES SL',
  contact_name: 'Ana Gómez',
  contact_role: 'Administradora única',
  contact_email: 'ana@acme.es',
  turnstileToken: 'tok',
  ...o,
});

const post = (b) => new Request('https://mapasocietario.es/api/verify/request', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: b,
});

function fakeEnv() {
  const writes = [];
  return {
    writes,
    VERIFY_TURNSTILE_SECRET: 'secret',
    CLOUDFLARE_EMAIL_API_TOKEN: 'mail-token',
    VERIFY_DB: {
      prepare(sql) {
        return { bind: (...args) => ({ run: async () => { writes.push({ sql, args }); return {}; } }) };
      },
    },
  };
}

beforeEach(() => {
  globalThis.fetch = vi.fn(async (url) => {
    if (String(url).includes('siteverify')) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    return new Response('{}', { status: 200 }); // the mail send
  });
});
afterEach(() => { vi.restoreAllMocks(); });

describe('POST /api/verify/request', () => {
  it('records a valid request and acknowledges it', async () => {
    const env = fakeEnv();
    const res = await onRequestPost({ request: post(body()), env });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(env.writes).toHaveLength(1);
    expect(env.writes[0].sql).toContain('INSERT INTO verification_requests');
  });

  it('is not an oracle: the response is identical for a fictional company', async () => {
    const real = await onRequestPost({ request: post(body()), env: fakeEnv() });
    const made = await onRequestPost({
      request: post(body({ company_query: 'EMPRESA QUE NO EXISTE SL' })), env: fakeEnv() });
    expect(await real.text()).toBe(await made.text());
    expect(real.status).toBe(made.status);
  });

  it('writes nothing when Turnstile fails', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ success: false }), { status: 200 }));
    const env = fakeEnv();
    const res = await onRequestPost({ request: post(body()), env });
    expect(res.status).toBe(400);
    expect(env.writes).toHaveLength(0);
  });

  it('fails CLOSED when the Turnstile secret is missing', async () => {
    const env = fakeEnv();
    delete env.VERIFY_TURNSTILE_SECRET;
    const res = await onRequestPost({ request: post(body()), env });
    expect(res.status).toBe(400);
    expect(env.writes).toHaveLength(0);
  });

  it('pretends success for a filled honeypot, and writes nothing', async () => {
    const env = fakeEnv();
    const res = await onRequestPost({ request: post(body({ website: 'spam' })), env });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(env.writes).toHaveLength(0);
  });

  it('reports a consumer domain distinctly so the form can point at the field', async () => {
    const env = fakeEnv();
    const res = await onRequestPost({
      request: post(body({ contact_email: 'ana@gmail.com' })), env });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('contact_email_not_corporate');
    expect(data.field).toBe('contact_email');
    expect(env.writes).toHaveLength(0);
  });

  it('rejects a malformed body', async () => {
    const res = await onRequestPost({ request: post('not json'), env: fakeEnv() });
    expect(res.status).toBe(400);
  });

  it('still records the request when the notification mail fails', async () => {
    globalThis.fetch = vi.fn(async (url) => String(url).includes('siteverify')
      ? new Response(JSON.stringify({ success: true }), { status: 200 })
      : new Response('nope', { status: 500 }));
    const env = fakeEnv();
    const res = await onRequestPost({ request: post(body()), env });
    // The row is what matters; a failed notification must not lose the lead.
    expect(res.status).toBe(200);
    expect(env.writes).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run functions/api/verify/request.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the endpoint**

Create `functions/api/verify/request.js`:

```js
/**
 * POST /api/verify/request - a company asks to be verified.
 *
 * PUBLIC and unauthenticated, and the strongest thing it can cause is one row
 * in the operator's queue. It issues no token, creates no subject and sends the
 * requester nothing. The path to an invitation still runs through a person who
 * records representation_basis, identification_note and email_domain_basis by
 * hand.
 *
 * The success response is IDENTICAL for a real company, a fictional one and one
 * that already holds a live attestation: the form must never become an oracle
 * against a private pilot.
 *
 * All decision logic lives in src/verify/request.js where vitest reaches it;
 * this file moves data and sends one mail.
 */
import { validateRequestPayload, buildRequestEmail } from '../../../src/verify/request.js';
import { newId } from '../../../src/verify/ids.js';

// Not sensitive: visible in the dashboard URL and in `wrangler whoami`.
const CLOUDFLARE_ACCOUNT_ID = 'e0f6d4652827b154cc920fd53ed54101';
const MAIL_FROM = 'verificacion@ncdata.eu';
const MAIL_TO = 'mapasocietario@ncdata.eu';
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

/**
 * Fails CLOSED. A missing secret rejects the submission rather than waving it
 * through: an unprotected public write that degrades open silently is worse
 * than one that stops visibly.
 */
async function turnstilePassed(token, env, ip) {
  if (!env.VERIFY_TURNSTILE_SECRET || !token) return false;
  try {
    const form = new FormData();
    form.append('secret', env.VERIFY_TURNSTILE_SECRET);
    form.append('response', token);
    if (ip) form.append('remoteip', ip);
    const res = await fetch(SITEVERIFY, { method: 'POST', body: form,
                                          signal: AbortSignal.timeout(8000) });
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    return data.success === true;
  } catch {
    return false;
  }
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const result = validateRequestPayload(body);

  // Pretend success, write nothing, send nothing - and give no signal that the
  // check exists. Checked BEFORE Turnstile so a bot cannot distinguish the two.
  if (!result.ok && result.reason === 'honeypot') return json({ ok: true }, 200);

  if (!result.ok) {
    return json({ ok: false, error: result.reason, field: result.field || null }, 400);
  }

  const ip = request.headers.get('cf-connecting-ip') || '';
  if (!(await turnstilePassed(body?.turnstileToken, env, ip))) {
    return json({ ok: false, error: 'turnstile_failed' }, 400);
  }

  const id = newId('req');
  const p = result.payload;

  try {
    await env.VERIFY_DB.prepare(
      `INSERT INTO verification_requests
        (id, company_query, nif, contact_name, contact_role, contact_email,
         referrer_note, note)
       VALUES (?,?,?,?,?,?,?,?)`)
      .bind(id, p.company_query, p.nif, p.contact_name, p.contact_role,
            p.contact_email, p.referrer_note, p.note).run();
  } catch (e) {
    console.error('[verify-request] insert failed:', e.message);
    return json({ ok: false, error: 'store_failed' }, 502);
  }

  // Best-effort. The row is the record; losing the notification costs the
  // operator a console visit, losing the lead costs the pilot a company.
  try {
    const mail = buildRequestEmail(p, {
      from: MAIL_FROM, to: MAIL_TO, timestamp: new Date().toISOString(), id,
    });
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/email/sending/send`,
      { method: 'POST',
        headers: { Authorization: `Bearer ${env.CLOUDFLARE_EMAIL_API_TOKEN}`,
                   'Content-Type': 'application/json' },
        body: JSON.stringify(mail) });
    if (!res.ok) console.error('[verify-request] mail failed:', res.status, await res.text());
  } catch (e) {
    console.error('[verify-request] mail failed:', e.message);
  }

  // Says nothing about the company. Never "found", never "already verified".
  return json({ ok: true }, 200);
}
```

- [ ] **Step 5: Run the tests, apply the migration locally, run the suite**

```bash
npx vitest run functions/api/verify/request.test.js
npx wrangler d1 execute mapasocietario-verify --local --file=migrations/0005_verification_requests.sql
npm test
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add migrations/0005_verification_requests.sql functions/api/verify/request.js functions/api/verify/request.test.js
git -c commit.gpgsign=false commit -m "feat(verify): a company can ask to be verified

Public and unauthenticated, and the strongest thing it can cause is one
row in the operator's queue. No token, no subject, nothing sent to the
requester.

The success response is identical for a real company, a fictional one and
one that already holds an attestation - the form must never become an
oracle against a private pilot. Turnstile fails closed, and the honeypot
is checked before it so a bot cannot tell the two apart."
```

---

### Task 3: The public page

**Files:**
- Create: `src/copy/verificacion.js`
- Create: `src/copy/verificacion.test.js`
- Create: `functions/verificacion/index.js`

**Interfaces:**
- Consumes: nothing from earlier tasks at build time; the page POSTs to `/api/verify/request` (Task 2).
- Produces: `COPY` (ES/EN) and `TURNSTILE_SITEKEY` from `src/copy/verificacion.js`.

**This is the one indexable member of `/verificacion/*`.** It must not call `privateHeaders()` and must not emit a `noindex` robots tag. `public/_headers` and `public/robots.txt` carry no `/verificacion` rule, so no exception is needed anywhere — verify that remains true before finishing.

- [ ] **Step 1: Write the failing copy tests**

Create `src/copy/verificacion.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { COPY, TURNSTILE_SITEKEY } from './verificacion.js';

const langs = ['es', 'en'];
const flat = (lang) => JSON.stringify(COPY[lang]);

describe('the verification request page copy', () => {
  it('exists in both languages', () => {
    for (const l of langs) expect(COPY[l]).toBeTruthy();
  });

  it('says we do not verify identity and do not certify truth', () => {
    expect(flat('es')).toContain('No comprobamos su identidad');
    expect(flat('es')).toContain('no certificamos');
    expect(flat('en')).toContain('do not verify your identity');
    expect(flat('en')).toContain('do not certify');
  });

  it('excludes mancomunados up front, not after the form', () => {
    expect(flat('es')).toContain('mancomunados');
    expect(flat('en')).toContain('mancomunados');
  });

  it('says only the company may ask, about its own data', () => {
    expect(flat('es')).toMatch(/solo la (propia )?empresa/i);
    expect(flat('en')).toMatch(/only the company/i);
  });

  it('never calls the requester\'s company verified', () => {
    for (const l of langs) {
      expect(flat(l)).not.toMatch(/\bverificad[oa]s?\b/i);
      expect(flat(l)).not.toMatch(/\bis verified\b/i);
    }
  });

  it('promises no date for the stronger methods', () => {
    for (const l of langs) {
      expect(flat(l)).not.toMatch(/20\d\d/);
      expect(flat(l)).not.toMatch(/\bQ[1-4]\b/);
    }
  });

  it('carries the corporate-domain rule and a way through it', () => {
    for (const l of langs) expect(flat(l)).toContain('mapasocietario@ncdata.eu');
  });

  it('uses the shared public sitekey', () => {
    expect(TURNSTILE_SITEKEY).toBe('0x4AAAAAADp3WnZGNiZai_32');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/copy/verificacion.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the copy module**

Create `src/copy/verificacion.js`. Follow the shape of `src/copy/studies.js` (a plain data module, no Node imports). It must contain, per language, at minimum: `title`, `h1`, `lead`, `what` (what it is), `notWhat` (the no-identity / no-truth pair), `who` (only the company, about itself; mancomunados excluded), `cost` (free during the pilot, ~20 minutes of a representative's time, several days end to end), `pilot` (the §7.1 pilot-tier paragraph — designed, not yet implemented, and each declaration records which method was used), `domainRule` (corporate domains only during the pilot, with `mapasocietario@ncdata.eu` as the way through), the form field labels including the prompt **"¿Le ha pedido algún banco, cliente o socio que verifique sus datos registrales?"**, the submit label, the success message, and an `errors` map keyed by the endpoint's `error` values (`contact_email_not_corporate`, `contact_email_invalid`, `*_required`, `turnstile_failed`, `store_failed`).

The one persuasive line, and the only one: **"Hágalo una vez, no una vez por cada cliente."** / **"Do it once, not once per counterparty."**

Also export:

```js
// Public by design - a Turnstile sitekey is meant to be in the page. Shared
// with the existing widgets; the matching secret is a Pages project secret.
export const TURNSTILE_SITEKEY = '0x4AAAAAADp3WnZGNiZai_32';
```

Take the ES wording for the pilot-tier paragraph verbatim from §7.1 of the spec, and mirror it in English.

- [ ] **Step 4: Run the copy tests**

Run: `npx vitest run src/copy/verificacion.test.js`
Expected: PASS. If the "never calls the company verified" test trips on a legitimate use (e.g. the noun "verificación"), the assertion is checking the wrong thing — narrow the regex to the adjective, do not weaken it to nothing.

- [ ] **Step 5: Write the page**

Create `functions/verificacion/index.js`, modelled on `functions/verificacion/privacidad.js` — same `esc()` helper, same `?lang=` negotiation, same self-contained `<style>`. Four deliberate differences:

1. **No `noindex`.** Do not emit `<meta name="robots">` and do not set `x-robots-tag`. Its response headers are:
```js
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=3600',
    },
```
2. Loads Turnstile: `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>` and renders `<div class="cf-turnstile" data-sitekey="${TURNSTILE_SITEKEY}"></div>`.
3. **The form's field names are the endpoint's contract — get these exactly right, a typo here is a silent 400 the user cannot explain.** The JSON body posted must use precisely these keys, which are what `validateRequestPayload` reads:

```
company_query   (required, text)      contact_email  (required, email)
nif             (optional, text)      referrer_note  (optional, text)
contact_name    (required, text)      note           (optional, textarea)
contact_role    (required, text)      website        (HONEYPOT - visually hidden, never labelled)
                                      turnstileToken (from window.turnstile.getResponse())
```

The page carries the form and an inline `<script>` that POSTs that JSON to `/api/verify/request`, reads `window.turnstile.getResponse()` for `turnstileToken`, includes a visually-hidden `website` honeypot input, disables the submit button while in flight, renders `COPY[lang].errors[error]` on failure and the success message on success. Follow `functions/admin/verificacion.js` for how a Pages Function embeds client JS in a template literal — nested backticks and `${` are escaped `` \` `` and `\${`.
4. Styling should look credible to a company deciding whether to trust this; it is the URL an institution will cite. Self-contained CSS, system font stack, `color-scheme: light dark`, max-width around 44rem, and a visible focus state on every input.

The corporate-domain rule must be stated **above** the form and validated as the user types (a `blur`/`input` handler on the email field is enough), never sprung at submit.

- [ ] **Step 6: Verify the page is genuinely indexable**

```bash
grep -n "verific" public/_headers public/robots.txt || echo "no /verificacion rule — good"
grep -n "noindex\|privateHeaders" functions/verificacion/index.js || echo "no noindex in the page — good"
```
Both must report the "good" line.

- [ ] **Step 7: Run the suite and commit**

```bash
npm test
git add src/copy/verificacion.js src/copy/verificacion.test.js functions/verificacion/index.js
git -c commit.gpgsign=false commit -m "feat(verify): the public page a company lands on

The one indexable member of /verificacion/*, and the URL an institution
can paste into its own supplier email. It states what the verification is
not before it states what it is, excludes mancomunados before the form
rather than after it, and promises no date for the stronger methods.

The corporate-domain rule sits above the form and validates as you type,
with a way through for the many real Spanish SLs running on Gmail."
```

---

### Task 4: The Solicitudes queue in the console

**Files:**
- Create: `functions/api/verify/admin/requests.js`
- Create: `functions/api/verify/admin/requests.test.js`
- Modify: `functions/admin/verificacion.js`
- Modify: `functions/admin/verificacion.test.js` (**it exists, with 10 tests — EXTEND it**)

**Interfaces:**
- Consumes: `verification_requests` (Task 2); the console's existing `api()` helper and invite search.
- Produces: `GET /api/verify/admin/requests?status=` and `POST /api/verify/admin/requests` (decide).

- [ ] **Step 1: Write the failing endpoint tests**

Create `functions/api/verify/admin/requests.test.js` following the shape of `functions/api/verify/admin/checks.test.js`. Cover: 401 without the admin bearer token on both GET and POST; 400 when the decide call omits `id` or sends a `status` outside `('new','contacted','invited','ineligible','declined','spam')`; and that a valid GET returns the rows the fake DB yields.

- [ ] **Step 2: Implement the endpoint**

Create `functions/api/verify/admin/requests.js`:

```js
/**
 * GET  /api/verify/admin/requests?status=   - the inbound queue.
 * POST /api/verify/admin/requests           - set a row's status and note.
 *
 * A request is a LEAD. Nothing here issues a token: converting one means the
 * operator resolves the company and goes through /api/verify/admin/invite,
 * which still demands representation_basis, identification_note and
 * email_domain_basis by hand.
 */
import { requireAdmin, jsonResponse } from '../_db.js';

const STATUSES = ['new', 'contacted', 'invited', 'ineligible', 'declined', 'spam'];
const DEFAULT_LIMIT = 100;

export async function onRequestGet({ request, env }) {
  if (!requireAdmin(request, env)) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  const status = (new URL(request.url).searchParams.get('status') || '').trim();
  const filtered = STATUSES.includes(status);

  const { results } = await (filtered
    ? env.VERIFY_DB.prepare(
        `SELECT * FROM verification_requests WHERE status = ?
          ORDER BY created_at DESC LIMIT ?`).bind(status, DEFAULT_LIMIT)
    : env.VERIFY_DB.prepare(
        `SELECT * FROM verification_requests
          ORDER BY created_at DESC LIMIT ?`).bind(DEFAULT_LIMIT)).all();

  return jsonResponse({ ok: true, count: (results || []).length, items: results || [] });
}

export async function onRequestPost({ request, env }) {
  if (!requireAdmin(request, env)) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ ok: false, error: 'invalid_json' }, 400); }

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const status = typeof body.status === 'string' ? body.status : '';
  if (!id) return jsonResponse({ ok: false, error: 'id_required' }, 400);
  if (!STATUSES.includes(status)) {
    return jsonResponse({ ok: false, error: 'invalid_status', allowed: STATUSES }, 400);
  }

  const note = typeof body.operator_note === 'string' ? body.operator_note.trim() : null;
  const res = await env.VERIFY_DB.prepare(
    `UPDATE verification_requests SET status = ?, operator_note = ?, updated_at = ?
      WHERE id = ?`).bind(status, note, new Date().toISOString(), id).run();

  // The row count is checked: a mistyped id matched nothing and the operator
  // would otherwise be told the request was filed.
  if (!res?.meta?.changes) return jsonResponse({ ok: false, error: 'not_found' }, 404);
  return jsonResponse({ ok: true, id, status });
}
```

- [ ] **Step 3: Add the console section**

In `functions/admin/verificacion.js`, add a **Solicitudes** section as the FIRST section inside `<div id="app">`, above "Cadena de auditoría" — an inbound queue the operator should see before anything else:

```html
  <h2>Solicitudes recibidas</h2>
  <p class="muted">Una solicitud no concede nada: es un aviso. Para convertirla, busque la
    empresa abajo y emita la invitación como siempre, anotando cómo ha identificado a la
    persona y por qué ese dominio es suyo.</p>
  <div id="requests"></div>
```

Render each row with: company text, NIF, contact name/role/email, `referrer_note`, date, status; a **Buscar** button that fills the existing `#q` input with `company_query` and triggers the existing search; and status buttons for `contacted` / `ineligible` / `declined` / `spam` plus a note input. Load it in the existing `load()` function alongside the other sections. Follow the file's delegated-listener convention (`data-` attributes, not inline `onclick` with interpolated ids) for the per-row buttons.

- [ ] **Step 4: Extend the console tests**

Add to `functions/admin/verificacion.test.js` (10 tests → 13): the rendered HTML contains the Solicitudes heading; the emitted script still parses (the existing `new Function` test covers this — confirm it passes); and the Buscar button fills `#q` and calls the search, exercised through the file's existing script-execution harness.

- [ ] **Step 5: Run the suite and commit**

```bash
npm test
git add functions/api/verify/admin/requests.js functions/api/verify/admin/requests.test.js functions/admin/verificacion.js functions/admin/verificacion.test.js
git -c commit.gpgsign=false commit -m "feat(verify): the inbound request queue in the console

First section on the page, because an unanswered request is the one thing
that goes stale. Converting one still runs through the existing invite
flow: the queue prefills a search, never authority."
```

---

### Task 5: Purge spam and ineligible requests after 90 days

**Files:**
- Modify: `src/verify/request.js`, `src/verify/request.test.js`
- Modify: `workers/verification-reconciler/src/index.js`

**Interfaces:**
- Consumes: `verification_requests` (Task 2).
- Produces: `REQUEST_RETENTION_DAYS` (90) and `requestRetentionCutoff(nowMs)` from `src/verify/request.js`.

A request that became an invitation is retained under the attestation record's terms; only `spam` and `ineligible` rows are purged. The reconciler already holds a daily cron and a `VERIFY_DB` binding — no new worker, no new schedule.

- [ ] **Step 1: Write the failing test**

Append to `src/verify/request.test.js`:

```js
describe('requestRetentionCutoff', () => {
  it('is ninety days before now, as an ISO string', () => {
    const now = Date.parse('2026-12-10T04:15:00Z');
    expect(REQUEST_RETENTION_DAYS).toBe(90);
    expect(requestRetentionCutoff(now)).toBe(new Date(now - 90 * 86_400_000).toISOString());
  });
});
```

Add both names to that file's import.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/verify/request.test.js`
Expected: FAIL — not a function.

- [ ] **Step 3: Implement**

Append to `src/verify/request.js`:

```js
// Only spam and ineligible rows are purged. A request that became an invitation
// is retained under the attestation record's terms (spec section 9 of the pilot
// design), because it is then part of that record's provenance.
export const REQUEST_RETENTION_DAYS = 90;

export const requestRetentionCutoff = (nowMs = Date.now()) =>
  new Date(nowMs - REQUEST_RETENTION_DAYS * 86_400_000).toISOString();
```

- [ ] **Step 4: Purge in the daily job**

In `workers/verification-reconciler/src/index.js`, leave the existing import from `../../../src/verify/reconcile.js` **completely alone** — it already carries `checkFact, nextStatus, isExpired, buildRunRow, runRetentionCutoff, RUN_RETENTION_DAYS` and dropping any of them breaks the daily job in ways the unit tests cannot see. Add a **separate** import line:

```js
import { requestRetentionCutoff, REQUEST_RETENTION_DAYS } from '../../../src/verify/request.js';
```

Add `purgedRequests: 0` to the `report` initialiser in `reconcileAll`, and immediately after the existing `reconciliation_runs` purge block insert:

```js
  // Requests that never became anything. Best-effort, for the same reason as
  // the run purge: a storage cost must not cost a day of checks.
  try {
    const purge = await env.VERIFY_DB.prepare(
      `DELETE FROM verification_requests
        WHERE status IN ('spam','ineligible') AND created_at < ?`)
      .bind(requestRetentionCutoff()).run();
    report.purgedRequests = purge?.meta?.changes || 0;
  } catch (e) {
    report.failures.push({ id: 'verification_requests_purge', error: String(e.message || e) });
  }
```

Add a line to the daily mail's `lines` array, immediately after the existing purge line:

```js
    `Requests purged (spam/ineligible older than ${REQUEST_RETENTION_DAYS} days): ${report.purgedRequests}`,
```

- [ ] **Step 5: Run the suite and commit**

```bash
npm test
git add src/verify/request.js src/verify/request.test.js workers/verification-reconciler/src/index.js
git -c commit.gpgsign=false commit -m "feat(verify): purge spam and ineligible requests after ninety days

Only those two statuses. A request that became an invitation is part of
that attestation's provenance and keeps the attestation record's terms."
```

---

## Deployment

Not part of any task — run once, after all tasks are reviewed and merged.

- [ ] **Set the Turnstile secret on the Pages project.** `VERIFY_TURNSTILE_SECRET` must be the secret paired with sitekey `0x4AAAAAADp3WnZGNiZai_32`. **The endpoint fails closed without it** — every submission returns 400 and no request is ever recorded. This is the one gate that silently makes the whole feature inert, so set it before announcing the URL.
- [ ] Apply the migration to the remote database:
```bash
npx wrangler d1 execute mapasocietario-verify --remote --file=migrations/0005_verification_requests.sql
```
- [ ] Redeploy the reconciler Worker (it deploys manually, not through CI):
```bash
cd workers/verification-reconciler && npx wrangler deploy
```
- [ ] Let the Pages deploy run through its GitHub Action — never `wrangler pages deploy` from a laptop.
- [ ] Submit one real request through the live form and confirm: the operator mail arrives, the row appears in the console, and a Gmail address is rejected with the escape-hatch message.
- [ ] Decide whether `/verificacion` is linked from the site navigation while `VERIFY_VISIBILITY` is `private`, or left findable only by citation and search (spec §16, open question 3).
