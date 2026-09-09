/**
 * GET /verificacion  (add ?lang=en for English)
 *
 * The public front door: the page a company lands on because a bank, a client
 * or a partner told it to get its registry data verified, plus the form that
 * records its request.
 *
 * THE ONE INDEXABLE MEMBER of the /verificacion/* family. Its siblings keep
 * robots out per response; this one simply omits that header, which is why no
 * exception is carved in public/_headers or public/robots.txt. A page nobody
 * can find cannot be cited, and being citable is this page's whole job — it is
 * the URL an institution pastes into its own supplier email.
 *
 * Three orderings here are load-bearing, not layout taste:
 *
 *   1. What the verification is NOT comes before what it is. The reader arrives
 *      with an inflated idea of what "verified" means and the honest thing is to
 *      deflate it in the first screenful.
 *   2. Administradores mancomunados are excluded ABOVE the form. Learning it
 *      after filling one in is a broken promise, not a validation error.
 *   3. The corporate-domain rule is stated above the form and checked as the
 *      user types, sharing ONE list with the server (src/verify/emailDomain.js).
 *      A great many real Spanish SLs run on Gmail; they get a way through
 *      rather than a dead end.
 *
 * The form GRANTS NOTHING. It writes one row into the operator's queue. Every
 * claim on the page lives in src/copy/verificacion.js, where it is unit-tested.
 */
import { COPY, TURNSTILE_SITEKEY, PRIVACY_PATH } from '../../src/copy/verificacion.js';
import { CONSUMER_DOMAINS } from '../../src/verify/emailDomain.js';

const SITE = 'https://mapasocietario.es';
const PATH = '/verificacion';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// JSON destined for an inline <script>. Escaping "<" is what stops a "</script>"
// inside any copy string from ending the block early.
const json = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

/** A prose section: heading, an optional emphasised summary, then bullets. */
const section = (id, block, { summary } = {}) => `
<section aria-labelledby="${id}">
  <h2 id="${id}">${esc(block.heading)}</h2>
  ${summary && block.summary ? `<p class="summary">${esc(block.summary)}</p>` : ''}
  <ul>${block.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
</section>`;

/**
 * One form control. `name` IS the endpoint's contract - these strings are read
 * verbatim by validateRequestPayload, so a typo here is a silent 400 the user
 * cannot explain.
 *
 * `prominent` gives a field the same panel treatment the prose blocks get. Only
 * referrer_note uses it, and not for decoration: that answer is how we learn
 * which institutions are actually sending companies here, which is the pilot's
 * whole distribution thesis. At the visual weight of an optional NIF it gets
 * skipped, so it is drawn as a question rather than as another blank.
 */
function field(name, spec, { required = false, type = 'text', textarea = false,
                            prominent = false, t }) {
  const mark = required
    ? `<span class="mark req">${esc(t.form.requiredMark)}</span>`
    : `<span class="mark">${esc(t.form.optionalMark)}</span>`;
  const control = textarea
    ? `<textarea id="f-${name}" name="${name}" rows="4" aria-describedby="h-${name}"
        placeholder="${esc(spec.placeholder || '')}"></textarea>`
    : `<input id="f-${name}" name="${name}" type="${type}" aria-describedby="h-${name}"
        ${required ? 'required' : ''} placeholder="${esc(spec.placeholder || '')}"
        autocomplete="${type === 'email' ? 'email' : 'off'}">`;
  return `
<div class="field${prominent ? ' ask' : ''}" data-field="${name}">
  <label for="f-${name}">${esc(spec.label)} ${mark}</label>
  <p class="hint" id="h-${name}">${esc(spec.hint)}</p>
  ${control}
  <p class="err" id="e-${name}" role="alert" hidden></p>
</div>`;
}

export function onRequestGet({ request }) {
  const url = new URL(request.url);
  const requested = (url.searchParams.get('lang') || '').toLowerCase();
  // Deliberately NOT negotiated on Accept-Language: this response is cached
  // shared (public, s-maxage=3600) and Cloudflare only honours Accept-Encoding
  // on Vary, so an Accept-Language-based body would leak across visitors and
  // the canonical link would tell Google the front door duplicates itself.
  // No lang parameter always means Spanish; English lives at ?lang=en only.
  const lang = requested === 'en' ? 'en' : 'es';
  const t = COPY[lang];
  const canonical = lang === 'en' ? `${SITE}${PATH}?lang=en` : `${SITE}${PATH}`;
  const other = lang === 'en' ? PATH : `${PATH}?lang=en`;

  const html = `<!doctype html><html lang="${lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.description)}">
<link rel="canonical" href="${canonical}">
<link rel="alternate" hreflang="es" href="${SITE}${PATH}">
<link rel="alternate" hreflang="en" href="${SITE}${PATH}?lang=en">
<link rel="alternate" hreflang="x-default" href="${SITE}${PATH}">
<meta property="og:title" content="${esc(t.title)}">
<meta property="og:description" content="${esc(t.description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:type" content="website">
<style>
  :root {
    color-scheme: light dark;
    --bg: #ffffff; --fg: #14181c; --muted: #57626c; --line: #dbe1e6;
    --card: #f6f8f9; --accent: #0f766e; --accent-fg: #ffffff;
    --flag-bg: #fdf6e3; --flag-line: #d9bf6a; --err: #b91c1c;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f1417; --fg: #e6ecef; --muted: #98a3ab; --line: #283137;
      --card: #151b1f; --accent: #2dd4bf; --accent-fg: #06201d;
      --flag-bg: #241f10; --flag-line: #5f5325; --err: #f87171;
    }
  }
  * { box-sizing: border-box; }
  body { font: 16px/1.62 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         margin: 0; padding: 2.5rem 1.15rem 4rem; background: var(--bg); color: var(--fg);
         -webkit-font-smoothing: antialiased; }
  main { max-width: 44rem; margin: 0 auto; }
  a { color: inherit; text-underline-offset: 2px; }
  .kicker { text-transform: uppercase; letter-spacing: .09em; font-size: .74rem;
            font-weight: 600; color: var(--accent); margin: 0 0 .6rem; }
  h1 { font-size: clamp(1.6rem, 4.5vw, 2.1rem); line-height: 1.2; margin: 0 0 1rem;
       letter-spacing: -.015em; }
  h2 { font-size: 1.08rem; margin: 2.6rem 0 .6rem; letter-spacing: -.005em; }
  h3 { font-size: 1rem; margin: 0 0 .4rem; }
  .lead { font-size: 1.06rem; color: var(--fg); margin: 0 0 1.4rem; }
  .once { font-size: 1.06rem; font-weight: 600; margin: 0 0 2rem;
          border-left: 3px solid var(--accent); padding: .1rem 0 .1rem .85rem; }
  ul { padding-left: 1.15rem; margin: .5rem 0; }
  li { margin-bottom: .55rem; }
  .summary { font-weight: 600; margin: .2rem 0 .7rem; }
  .panel { background: var(--card); border: 1px solid var(--line); border-radius: 10px;
           padding: 1.05rem 1.15rem; margin-top: .7rem; }
  .panel p { margin: 0 0 .7rem; } .panel p:last-child { margin-bottom: 0; }
  .flag { background: var(--flag-bg); border-color: var(--flag-line); }
  .muted { color: var(--muted); font-size: .9rem; }
  form { margin-top: 1rem; }
  .field { margin-bottom: 1.5rem; }
  label { display: block; font-weight: 600; margin-bottom: .15rem; }
  .mark { font-weight: 400; font-size: .74rem; text-transform: uppercase;
          letter-spacing: .06em; color: var(--muted); }
  .mark.req { color: var(--accent); }
  .hint { color: var(--muted); font-size: .88rem; margin: 0 0 .45rem; }
  /* The one question the pilot actually needs answered, drawn as a question. */
  .field.ask { background: var(--card); border: 1px solid var(--line);
               border-left: 3px solid var(--accent); border-radius: 10px;
               padding: 1.05rem 1.15rem; }
  .field.ask label { font-size: 1.02rem; }
  .field.ask .hint { color: var(--fg); opacity: .78; }
  input, textarea { font: inherit; width: 100%; padding: .6rem .7rem; color: inherit;
                    background: var(--bg); border: 1px solid var(--line); border-radius: 8px; }
  textarea { resize: vertical; }
  input:focus-visible, textarea:focus-visible, button:focus-visible, a:focus-visible {
    outline: 2px solid var(--accent); outline-offset: 2px; border-color: var(--accent); }
  .err { color: var(--err); font-size: .9rem; margin: .4rem 0 0; }
  .field.invalid input, .field.invalid textarea { border-color: var(--err); }
  button { font: inherit; font-weight: 600; padding: .7rem 1.3rem; border-radius: 8px;
           border: 1px solid var(--accent); background: var(--accent); color: var(--accent-fg);
           cursor: pointer; }
  button[disabled] { opacity: .55; cursor: progress; }
  /* Honeypot. Off-screen rather than display:none, which some bots skip. */
  .hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
  .done { border: 1px solid var(--accent); border-radius: 10px; padding: 1.15rem;
          margin-top: 1rem; }
  footer { margin-top: 3rem; border-top: 1px solid var(--line); padding-top: 1.1rem;
           font-size: .9rem; color: var(--muted); }
  footer a { color: var(--muted); }
</style>
<noscript><style>#req{display:none}</style></noscript>
</head><body><main>

<p class="kicker">${esc(t.kicker)}</p>
<h1>${esc(t.h1)}</h1>
<p class="lead">${esc(t.lead)}</p>
<p class="once">${esc(t.once)}</p>

${section('not-what', t.notWhat, { summary: true })}
${section('what', t.what)}
${section('who', t.who)}
${section('cost', t.cost)}

<section aria-labelledby="pilot">
  <h2 id="pilot">${esc(t.pilot.heading)}</h2>
  <div class="panel">
    ${t.pilot.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}
  </div>
</section>

<section aria-labelledby="domain">
  <h2 id="domain">${esc(t.domainRule.heading)}</h2>
  <div class="panel flag">
    <p>${esc(t.domainRule.body)}</p>
    <p><strong>${esc(t.domainRule.escape)}</strong></p>
  </div>
</section>

<section aria-labelledby="form-heading">
  <h2 id="form-heading">${esc(t.form.heading)}</h2>
  <p class="muted">${esc(t.form.intro)}</p>
  <noscript><p class="panel flag">${esc(t.noscript)}</p></noscript>

  <form id="req" novalidate>
    ${field('company_query', t.form.fields.company_query, { required: true, t })}
    ${field('nif', t.form.fields.nif, { t })}
    ${field('contact_name', t.form.fields.contact_name, { required: true, t })}
    ${field('contact_role', t.form.fields.contact_role, { required: true, t })}
    ${field('contact_email', t.form.fields.contact_email, { required: true, type: 'email', t })}
    ${field('referrer_note', t.form.fields.referrer_note, { prominent: true, t })}
    ${field('note', t.form.fields.note, { textarea: true, t })}

    <div class="hp" aria-hidden="true">
      <input id="f-website" name="website" type="text" tabindex="-1" autocomplete="off">
    </div>

    <div class="cf-turnstile" data-sitekey="${TURNSTILE_SITEKEY}"></div>
    <p class="err" id="e-form" role="alert" hidden></p>
    <p style="margin-top:1rem"><button type="submit" id="send">${esc(t.form.submit)}</button></p>
  </form>

  <div class="done" id="done" hidden>
    <h3>${esc(t.form.success.heading)}</h3>
    <p style="margin:0">${esc(t.form.success.body)}</p>
  </div>
</section>

<footer>
  <p><a href="${esc(PRIVACY_PATH)}${lang === 'en' ? '?lang=en' : ''}">${esc(t.privacyLink)}</a>
     · <a href="${esc(other)}">${esc(t.langSwitch)}</a></p>
  <p>${esc(t.contactLine)}</p>
</footer>

<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script>
// The SAME consumer list the endpoint uses, serialised from
// src/verify/emailDomain.js so the two cannot drift apart. This check is a
// courtesy, not a gate: the server decides.
var CONSUMER = ${json(CONSUMER_DOMAINS)};
var ERRORS = ${json(t.errors)};
var SENDING = ${json(t.form.sending)};
var SUBMIT = ${json(t.form.submit)};

var form = document.getElementById('req');
var button = document.getElementById('send');
var formErr = document.getElementById('e-form');
var email = document.getElementById('f-contact_email');

// Mirrors classifyEmailDomain(): 'invalid' | 'consumer' | 'corporate'.
function classify(value) {
  var v = String(value == null ? '' : value).trim().toLowerCase();
  if (!v || /\\s/.test(v)) return 'invalid';
  var at = v.lastIndexOf('@');
  if (at < 1 || at === v.length - 1) return 'invalid';
  var domain = v.slice(at + 1);
  if (domain.indexOf('.') === -1 || domain.charAt(0) === '.'
      || domain.charAt(domain.length - 1) === '.') return 'invalid';
  if (/^\\d{1,3}(\\.\\d{1,3}){3}$/.test(domain) || domain.charAt(0) === '[') return 'invalid';
  for (var i = 0; i < CONSUMER.length; i++) {
    if (domain === CONSUMER[i] || domain.slice(-(CONSUMER[i].length + 1)) === '.' + CONSUMER[i]) {
      return 'consumer';
    }
  }
  return 'corporate';
}

function setFieldError(name, message) {
  var node = document.getElementById('e-' + name);
  var wrap = document.querySelector('[data-field="' + name + '"]');
  if (!node) return;
  node.textContent = message || '';
  node.hidden = !message;
  if (wrap) wrap.classList.toggle('invalid', !!message);
}

function clearErrors() {
  var nodes = form.querySelectorAll('.err');
  for (var i = 0; i < nodes.length; i++) { nodes[i].textContent = ''; nodes[i].hidden = true; }
  var wraps = form.querySelectorAll('.field');
  for (var j = 0; j < wraps.length; j++) wraps[j].classList.remove('invalid');
  formErr.textContent = ''; formErr.hidden = true;
}

// As you type, never sprung at submit. Only the consumer verdict fires on
// input - half-typed addresses are "invalid" and saying so mid-word is noise.
function checkEmail(strict) {
  var kind = classify(email.value);
  if (!email.value.trim()) { setFieldError('contact_email', ''); return; }
  if (kind === 'consumer') {
    setFieldError('contact_email', ERRORS.contact_email_not_corporate);
  } else if (kind === 'invalid' && strict) {
    setFieldError('contact_email', ERRORS.contact_email_invalid);
  } else {
    setFieldError('contact_email', '');
  }
}
email.addEventListener('input', function () { checkEmail(false); });
email.addEventListener('blur', function () { checkEmail(true); });

function value(name) {
  var el = document.getElementById('f-' + name);
  return el ? el.value : '';
}

function turnstileToken() {
  try {
    return (window.turnstile && window.turnstile.getResponse) ? (window.turnstile.getResponse() || '') : '';
  } catch (e) { return ''; }
}

form.addEventListener('submit', function (event) {
  event.preventDefault();
  clearErrors();
  button.disabled = true;
  button.textContent = SENDING;

  var body = {
    company_query: value('company_query'),
    nif: value('nif'),
    contact_name: value('contact_name'),
    contact_role: value('contact_role'),
    contact_email: value('contact_email'),
    referrer_note: value('referrer_note'),
    note: value('note'),
    website: value('website'),
    turnstileToken: turnstileToken()
  };

  fetch('/api/verify/request', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  }).then(function (response) {
    return response.json().catch(function () { return {}; });
  }).then(function (data) {
    if (data && data.ok) {
      form.hidden = true;
      document.getElementById('done').hidden = false;
      document.getElementById('done').scrollIntoView({ block: 'center' });
      return;
    }
    var message = (data && ERRORS[data.error]) || ERRORS.unknown;
    if (data && data.field) {
      setFieldError(data.field, message);
      var el = document.getElementById('f-' + data.field);
      if (el) el.focus();
    } else {
      formErr.textContent = message;
      formErr.hidden = false;
    }
    if (window.turnstile && window.turnstile.reset) { try { window.turnstile.reset(); } catch (e) {} }
  }).catch(function () {
    formErr.textContent = ERRORS.network;
    formErr.hidden = false;
    if (window.turnstile && window.turnstile.reset) { try { window.turnstile.reset(); } catch (e) {} }
  }).then(function () {
    button.disabled = false;
    button.textContent = SUBMIT;
  });
});
</script>
</main></body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
