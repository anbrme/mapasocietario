/**
 * GET /admin/verificacion — the operator console.
 *
 * Deliberately a THIN CLIENT over the existing JSON endpoints. It adds no
 * server-side auth surface of its own: every action still carries the same
 * bearer token those endpoints already require, and this page is inert without
 * one. The token is held in sessionStorage for the tab's lifetime - never in a
 * cookie (nothing here needs ambient authority) and never in the URL (which
 * leaks through history, logs and referrers).
 *
 * That means this page is safe to serve unauthenticated: with no token it can
 * do nothing at all, and it displays nothing until a request succeeds.
 */
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function onRequestGet() {
  const html = `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Verificación — consola</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.55 system-ui, sans-serif; margin: 0; padding: 1.5rem; }
  main { max-width: 60rem; margin: 0 auto; }
  h1 { font-size: 1.3rem; } h2 { font-size: 1rem; margin-top: 2rem; }
  .card { border: 1px solid #8884; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
  table { width: 100%; border-collapse: collapse; margin: .5rem 0; }
  th, td { text-align: left; padding: .4rem .5rem; border-bottom: 1px solid #8883;
           vertical-align: top; font-size: .9rem; }
  .differs { font-weight: 600; }
  .differs td { background: #f9731622; }
  button { font: inherit; padding: .4rem .8rem; border-radius: 6px; border: 1px solid #8886;
           background: transparent; color: inherit; cursor: pointer; }
  button.primary { border-color: currentColor; font-weight: 600; }
  input, textarea { font: inherit; padding: .4rem; width: 100%; box-sizing: border-box;
                    background: transparent; color: inherit; border: 1px solid #8886;
                    border-radius: 6px; }
  .row { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; }
  .muted { opacity: .7; font-size: .85rem; }
  .ok { color: #16a34a; } .bad { color: #dc2626; }
  code { font-size: .82rem; word-break: break-all; }
</style></head><body><main>
<h1>Verificación — consola</h1>
<p class="muted">Cliente sin estado. El token vive solo en esta pestaña y nunca viaja en la URL.</p>

<div class="card">
  <div class="row">
    <input id="tok" type="password" placeholder="VERIFY_ADMIN_TOKEN" autocomplete="off">
    <button class="primary" id="save">Guardar</button>
    <button id="forget">Olvidar</button>
    <span id="who" class="muted"></span>
  </div>
</div>

<div id="app" hidden>
  <h2>Cadena de auditoría</h2>
  <div class="card" id="chain">…</div>

  <h2>Pendientes de revisión</h2>
  <div id="queue"></div>

  <h2>Declaraciones publicadas</h2>
  <p class="muted">Emita un enlace por contraparte. No se envía ningún correo: el enlace se
    muestra una sola vez y usted lo hace llegar. La etiqueta es una nota suya, nunca se muestra
    a quien lo abre, y los accesos cuentan aperturas del enlace, no lectores.</p>
  <div id="list"></div>
  <div id="grantout"></div>
</div>

<script>
const $ = (id) => document.getElementById(id);
const tokenKey = 'verify_admin_token';
let token = sessionStorage.getItem(tokenKey) || '';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

async function api(path, opts = {}) {
  const r = await fetch(path, {
    ...opts,
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json',
               ...(opts.headers || {}) },
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok && data.ok !== false, status: r.status, data };
}

function renderChain(d) {
  $('chain').innerHTML = d.intact
    ? '<span class="ok">Íntegra</span> · ' + d.events + ' eventos · cabecera <code>'
      + esc(d.head || '') + '</code><p class="muted">A prueba de manipulación evidente, no '
      + 'inmutable: la integridad depende del punto de control externo diario.</p>'
    : '<span class="bad">ROTA en seq ' + esc(d.broken_at_seq) + '</span>';
}

function renderQueue(items) {
  if (!items.length) { $('queue').innerHTML = '<p class="muted">Nada pendiente.</p>'; return; }
  $('queue').innerHTML = items.map((it) => \`
    <div class="card">
      <strong>\${esc(it.company)}</strong> · \${esc(it.representative)} —
      \${esc(it.claimed_role)} <span class="muted">(\${esc(it.representation_basis)})</span>
      <p class="muted">Aceptada \${esc(it.accepted_at)} · caduca \${esc(it.expires_at)}
        · incumbente: \${it.incumbent ? esc(it.incumbent.id) + ' (' + esc(it.incumbent.status) + ')' : 'ninguno'}</p>
      <p class="muted">Identificación: \${esc(it.identification_note)} · dominio:
        \${esc(it.email_domain_basis)}</p>
      <table><thead><tr><th>Hecho</th><th>Declarado</th><th>Registro</th></tr></thead><tbody>
        \${it.diff.map((r) => '<tr class="' + (r.differs ? 'differs' : '') + '"><td>'
          + esc(r.fact_key) + '</td><td>' + esc(r.declared) + '</td><td>'
          + esc(r.registry) + '</td></tr>').join('')}
      </tbody></table>
      <div class="row">
        <input placeholder="revisor" value="" id="rev-\${esc(it.attestation_id)}">
        <input placeholder="nota (obligatoria al rechazar)" id="note-\${esc(it.attestation_id)}">
        <button class="primary" onclick="decide('\${esc(it.attestation_id)}','approve')">Aprobar</button>
        <button onclick="decide('\${esc(it.attestation_id)}','reject')">Rechazar</button>
      </div>
      <p class="muted" id="msg-\${esc(it.attestation_id)}"></p>
    </div>\`).join('');
}

async function decide(id, decision) {
  const reviewer = $('rev-' + id).value.trim();
  const note = $('note-' + id).value.trim();
  const msg = $('msg-' + id);
  const r = await api('/api/verify/admin/decide', { method: 'POST',
    body: JSON.stringify({ attestation_id: id, decision, reviewer, note }) });
  msg.textContent = r.ok ? 'Hecho: ' + r.data.status : 'Error: ' + (r.data.error || r.status);
  msg.className = r.ok ? 'ok' : 'bad';
  if (r.ok) load();
}
window.decide = decide;

const STATUS_ES = { live: 'vigente', outdated: 'superada', under_review: 'en revisión',
                    disputed: 'en disputa', expired: 'caducada' };

function renderList(items) {
  if (!items.length) { $('list').innerHTML = '<p class="muted">Ninguna publicada todavía.</p>'; return; }
  $('list').innerHTML = items.map((a) => \`
    <div class="card">
      <strong>\${esc(a.display_name)}</strong>
      <span class="muted">— \${esc(STATUS_ES[a.status] || a.status)}</span>
      <p class="muted">\${esc(a.seat_officer_name || '')} \${esc(a.seat_position || '')} ·
        aceptada \${esc((a.accepted_at || '').slice(0,10))} ·
        caduca \${esc((a.expires_at || '').slice(0,10))} ·
        última comprobación \${esc((a.last_verified_at || '—').slice(0,10))}</p>
      \${a.status_reason ? '<p class="muted">' + esc(a.status_reason) + '</p>' : ''}
      <p class="muted"><code>\${esc(a.id)}</code></p>
      <div class="row">
        <input placeholder="etiqueta (p. ej. Banco X, onboarding)" id="lbl-\${esc(a.id)}">
        <button class="primary" onclick="issue('\${esc(a.id)}')">Emitir enlace</button>
      </div>
      \${a.grants.length ? '<table><thead><tr><th>Etiqueta</th><th>Emitido</th><th>Accesos</th>' +
        '<th></th></tr></thead><tbody>' + a.grants.map((g) =>
          '<tr><td>' + esc(g.label || '—') + '</td><td>' + esc((g.created_at||'').slice(0,10)) +
          '</td><td>' + esc(g.access_count) + (g.last_access_at ? ' (' +
            esc(g.last_access_at.slice(0,10)) + ')' : '') + '</td><td>' +
          (g.revoked_at ? '<span class="muted">revocado</span>'
            : '<button onclick="revoke(\'' + esc(a.id) + '\',\'' + esc(g.token_hash) +
              '\')">Revocar</button>') + '</td></tr>').join('') + '</tbody></table>' : ''}
    </div>\`).join('');
}

async function issue(id) {
  const r = await api('/api/verify/admin/grant', { method: 'POST',
    body: JSON.stringify({ attestation_id: id, label: $('lbl-' + id).value.trim() }) });
  $('grantout').innerHTML = r.ok
    ? '<div class="card"><p><strong>Enlace emitido — se muestra una sola vez.</strong></p>'
      + '<p>ES <code>' + esc(r.data.url) + '</code></p>'
      + '<p>EN <code>' + esc(r.data.url_en) + '</code></p>'
      + '<p class="muted">Caduca ' + esc(r.data.expires_at) + '.</p></div>'
    : '<p class="bad">' + esc(r.data.error || r.status) + '</p>';
  if (r.ok) load();
}
window.issue = issue;

async function revoke(id, hash) {
  const r = await api('/api/verify/admin/grant', { method: 'POST',
    body: JSON.stringify({ attestation_id: id, token_hash: hash, revoke: true }) });
  if (!r.ok) $('grantout').innerHTML = '<p class="bad">' + esc(r.data.error || r.status) + '</p>';
  load();
}
window.revoke = revoke;

async function load() {
  const chain = await api('/api/verify/admin/chain');
  if (!chain.ok) { $('who').textContent = 'Token no válido'; $('app').hidden = true; return; }
  $('who').textContent = 'Autenticado';
  $('app').hidden = false;
  renderChain(chain.data);
  const q = await api('/api/verify/admin/queue');
  if (q.ok) renderQueue(q.data.items || []);
  const a = await api('/api/verify/admin/attestations');
  if (a.ok) renderList(a.data.items || []);
}

$('save').onclick = () => { token = $('tok').value.trim();
  sessionStorage.setItem(tokenKey, token); $('tok').value = ''; load(); };
$('forget').onclick = () => { sessionStorage.removeItem(tokenKey); token = '';
  $('app').hidden = true; $('who').textContent = 'Olvidado'; };
if (token) load();
</script>
</main></body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'private, no-store',
      'referrer-policy': 'no-referrer',
      'x-robots-tag': 'noindex, nofollow, noarchive',
    },
  });
}
