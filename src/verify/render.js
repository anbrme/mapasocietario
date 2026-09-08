/**
 * Renders an attestation for a human reader.
 *
 * The copy here is the product's most exposed surface, so the constraints from
 * the spec are enforced by test rather than by discipline:
 *
 *   - never "identity verified" or an unqualified "authority verified";
 *   - never "was accurate when made" — we never established accuracy, only that
 *     the statement was consistent with the evidence checked at the time;
 *   - never "as of right now" — a daily job cannot support it, so every status
 *     line names the last SUCCESSFUL check instead;
 *   - never "immutable".
 *
 * FORBIDDEN_PHRASES is asserted against the rendered output in every status and
 * both languages.
 */
export const FORBIDDEN_PHRASES = [
  'identity verified', 'verified identity', 'identidad verificada',
  'was accurate', 'is accurate', 'era exacta', 'es exacta',
  'as of right now', 'a día de hoy mismo',
  'immutable', 'inmutable',
  'verified company', 'empresa verificada',
];

import { factLabel, displayValue } from './factUi.js';

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const day = (iso) => (typeof iso === 'string' ? iso.slice(0, 10) : '');

const T = {
  en: {
    checked: (d) => (d ? `Last successfully checked: ${d}.`
                       : 'This statement has not been checked since it was published.'),
    live: (d) => `This statement was accepted on ${d} and was consistent with the registry evidence checked at that time.`,
    outdated: (d, why) => `This statement was accepted on ${d} and was consistent with the registry evidence checked at that time. ${why} The statement should no longer be treated as current.`,
    under_review: () => 'A verification check could not be completed. This is a process state and implies nothing about the company.',
    disputed: () => 'A registry record published before this statement was accepted appears to contradict it. This is under review.',
    expired: (d) => `This statement was accepted on ${d} and has passed its stated validity period.`,
    method: (who, when) => `Confirmed from an address at the company's domain; the representative holds the registry-recorded position stated; their authority to make this statement was reviewed by ${who} on ${when}.`,
    disclaimer: 'Mapa Societario records who made this statement and that their authority was reviewed. It does not verify their identity, and it does not certify that the statement is true.',
    headers: ['Fact', 'Declared', 'Registry at acceptance', 'Registry today'],
    history: 'History', representative: 'Representative', notChecked: 'not checked',
  },
  es: {
    checked: (d) => (d ? `Última comprobación con éxito: ${d}.`
                       : 'Esta declaración no se ha comprobado desde su publicación.'),
    live: (d) => `Esta declaración se aceptó el ${d} y era coherente con la evidencia registral comprobada en ese momento.`,
    outdated: (d, why) => `Esta declaración se aceptó el ${d} y era coherente con la evidencia registral comprobada en ese momento. ${why} La declaración ya no debe considerarse vigente.`,
    under_review: () => 'No se ha podido completar una comprobación. Es un estado de proceso y no implica nada sobre la empresa.',
    disputed: () => 'Un asiento registral publicado antes de aceptarse esta declaración parece contradecirla. En revisión.',
    expired: (d) => `Esta declaración se aceptó el ${d} y ha superado su periodo de validez declarado.`,
    method: (who, when) => `Confirmada desde una dirección del dominio de la empresa; el representante ocupa el cargo registral indicado; su autoridad para hacer esta declaración fue revisada por ${who} el ${when}.`,
    disclaimer: 'Mapa Societario deja constancia de quién hizo esta declaración y de que su autoridad fue revisada. No verifica su identidad ni certifica que la declaración sea cierta.',
    headers: ['Hecho', 'Declarado', 'Registro al aceptar', 'Registro hoy'],
    history: 'Historial', representative: 'Representante', notChecked: 'sin comprobar',
  },
};

export function statusLine(view, lang = 'es') {
  const t = T[lang] || T.es;
  const accepted = day(view.accepted_at);
  const why = view.status_reason || '';
  const body =
    view.status === 'outdated' ? t.outdated(accepted, why)
    : view.status === 'under_review' ? t.under_review()
    : view.status === 'disputed' ? t.disputed()
    : view.status === 'expired' ? t.expired(accepted)
    : t.live(accepted);
  return `${body} ${t.checked(day(view.last_verified_at))}`.trim();
}

export function renderAttestationHtml(view, companyName, lang = 'es') {
  const t = T[lang] || T.es;

  // Raw keys and raw registry tokens are not a table a counterparty can read.
  const rows = (view.facts || []).map((f) => `<tr>
      <td>${esc(factLabel(f.fact_key, lang))}</td>
      <td>${esc(displayValue(f.fact_key, f.declared_value, lang))}</td>
      <td>${esc(displayValue(f.fact_key, f.registry_value_at_issue, lang))}</td>
      <td>${esc(f.last_check_outcome || t.notChecked)}</td>
    </tr>`).join('');

  const history = (view.history || []).map((h) =>
    `<li>${esc(day(h.created_at))} — ${esc(h.summary)}</li>`).join('');

  return `<section class="att att-${esc(view.status)}">
  <h1>${esc(companyName)}</h1>
  <p class="att-status">${esc(statusLine(view, lang))}</p>
  <p class="att-rep"><strong>${esc(t.representative)}:</strong>
     ${esc(view.representative?.name)} — ${esc(view.representative?.position)}</p>
  <p class="att-method">${esc(t.method(view.reviewer, day(view.reviewed_at || view.approved_at)))}</p>
  <table class="att-facts">
    <thead><tr>${t.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <h2>${esc(t.history)}</h2>
  <ul class="att-history">${history}</ul>
  <p class="att-disclaimer">${esc(t.disclaimer)}</p>
</section>`;
}
