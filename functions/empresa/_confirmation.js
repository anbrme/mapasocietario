/**
 * The attestation panel on the public company pages.
 *
 * Renders a REAL attestation read from VERIFY_DB (see _attestation.js), not a
 * hand-authored record. The wording is deliberately narrower than the map this
 * replaces, which said "La empresa confirma" on the strength of a name matching
 * an officer row:
 *
 *   - never "identity verified" - we check a registry POSITION, not a person;
 *   - never "was accurate" - we record acceptance and consistency with the
 *     evidence checked at the time, not truth;
 *   - never "as of right now" - the check is daily, so the panel names the last
 *     SUCCESSFUL check instead.
 *
 * statusLine and the fact labels come from src/verify/render.js so the panel and
 * the attestation permalink can never drift apart in their wording.
 *
 * Self-contained escaping so it never imports from _lib.js (which imports this).
 * The `_` prefix means Cloudflare Pages does not route this file.
 */
import { statusLine } from '../../src/verify/render.js';

const DAY_MS = 86_400_000;

// Age of an ISO timestamp in whole days, never negative. null when unparseable.
export function confirmationStatus(acceptedAt, nowMs = Date.now()) {
  const t = Date.parse(acceptedAt);
  if (Number.isNaN(t)) return null;
  const ageDays = Math.max(0, Math.floor((nowMs - t) / DAY_MS));
  const level = ageDays <= 90 ? 'fresh' : ageDays <= 180 ? 'aging' : 'stale';
  return { ageDays, level };
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const CONFIRMATION_I18N = {
  es: {
    title: 'Confirmación de vigencia',
    outdatedTitle: 'Confirmación superada',
    rep: 'Representante',
    reviewed: (who, when) => `Autoridad revisada por ${who} el ${when}.`,
    disclaimer: 'Mapa Societario deja constancia de quién hizo esta declaración y de que su autoridad fue revisada. No verifica su identidad ni certifica que la declaración sea cierta.',
  },
  en: {
    title: 'Currency confirmation',
    outdatedTitle: 'Confirmation superseded',
    rep: 'Representative',
    reviewed: (who, when) => `Authority reviewed by ${who} on ${when}.`,
    disclaimer: 'Mapa Societario records who made this statement and that their authority was reviewed. It does not verify their identity, and it does not certify that the statement is true.',
  },
};

const day = (iso) => (typeof iso === 'string' ? iso.slice(0, 10) : '');

/**
 * View model shared by the SEO panel and the in-app card, so the two can never
 * disagree. null when there is nothing to show.
 */
export function confirmationViewModel(attestation, lang = 'es', nowMs = Date.now()) {
  if (!attestation || !attestation.accepted_at || !attestation.representative) return null;
  const st = confirmationStatus(attestation.accepted_at, nowMs);
  if (!st) return null;
  const t = CONFIRMATION_I18N[lang] || CONFIRMATION_I18N.es;

  return {
    title: attestation.status === 'outdated' ? t.outdatedTitle : t.title,
    level: attestation.status === 'outdated' ? 'stale' : st.level,
    statusLine: statusLine(attestation, lang),
    representative: `${attestation.representative.name}${
      attestation.representative.position ? ` — ${attestation.representative.position}` : ''}`,
    repLabel: t.rep,
    reviewed: attestation.reviewer
      ? t.reviewed(attestation.reviewer, day(attestation.reviewed_at || attestation.approved_at))
      : null,
    disclaimer: t.disclaimer,
    ageDays: st.ageDays,
  };
}

// '' when there is nothing to show, so the page renders unchanged.
export function renderConfirmationBlock(attestation, lang = 'es', nowMs = Date.now()) {
  const vm = confirmationViewModel(attestation, lang, nowMs);
  if (!vm) return '';
  return `<section class="cc cc-${esc(vm.level)}" aria-label="${esc(vm.title)}">
    <div class="cc-head"><span class="cc-dot"></span><strong>${esc(vm.title)}</strong></div>
    <p class="cc-line">${esc(vm.statusLine)}</p>
    <p class="cc-rep"><strong>${esc(vm.repLabel)}:</strong> ${esc(vm.representative)}</p>
    ${vm.reviewed ? `<p class="cc-method">${esc(vm.reviewed)}</p>` : ''}
    <p class="cc-prov">${esc(vm.disclaimer)}</p>
  </section>`;
}
