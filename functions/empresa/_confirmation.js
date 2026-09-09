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

/**
 * A registry gap of a few months is ordinary and says nothing. The line only
 * earns its place when the distance is the story.
 */
const MIN_GAP_YEARS = 1;
const YEAR_MS = 365.25 * DAY_MS;

export const CONFIRMATION_I18N = {
  es: {
    title: 'Confirmación de vigencia',
    outdatedTitle: 'Confirmación superada',
    rep: 'Representante',
    // The leading sentence. The SUBJECT is always the company: it says who
    // stated what, on what date, and never that we established it.
    claim: {
      live: (d) => `La empresa confirmó el ${d} que estos datos registrales seguían vigentes.`,
      outdated: (d) => `La empresa confirmó estos datos registrales el ${d}, pero el registro ha publicado algo posterior.`,
      expired: (d) => `La confirmación de la empresa, del ${d}, ha superado su periodo de validez.`,
      under_review: (d) => `La empresa confirmó estos datos registrales el ${d}. Una comprobación quedó pendiente.`,
      disputed: (d) => `La empresa confirmó estos datos registrales el ${d}. La declaración está en revisión.`,
    },
    gap: (d, years) => `Última publicación en el BORME: ${d} — ${years} ${years === 1 ? 'año' : 'años'} antes de la confirmación.`,
    reviewed: (who, when) => `Autoridad revisada por ${who} el ${when}.`,
    disclaimer: 'Mapa Societario deja constancia de quién hizo esta declaración y de que su autoridad fue revisada. No certifica que la declaración sea cierta.',
  },
  en: {
    title: 'Currency confirmation',
    outdatedTitle: 'Confirmation superseded',
    rep: 'Representative',
    claim: {
      live: (d) => `The company confirmed on ${d} that this registry data was still current.`,
      outdated: (d) => `The company confirmed this registry data on ${d}, but the register has published something since.`,
      expired: (d) => `The company's confirmation, from ${d}, has passed its validity period.`,
      under_review: (d) => `The company confirmed this registry data on ${d}. A check could not be completed.`,
      disputed: (d) => `The company confirmed this registry data on ${d}. The statement is under review.`,
    },
    gap: (d, years) => `Last BORME publication: ${d} — ${years} ${years === 1 ? 'year' : 'years'} before the confirmation.`,
    reviewed: (who, when) => `Authority reviewed by ${who} on ${when}.`,
    disclaimer: 'Mapa Societario records who made this statement and that their authority was reviewed. It does not certify that the statement is true.',
  },
};

const day = (iso) => (typeof iso === 'string' ? iso.slice(0, 10) : '');

/**
 * Whole years between the last registry filing and the confirmation, or null
 * when the distance is not worth a line: no registry date, a registry that
 * moved AFTER the confirmation (that is a supersession, which the status
 * already carries, not a gap), or a gap under MIN_GAP_YEARS.
 */
function registryGapYears(registryLastSeen, acceptedAt) {
  const from = Date.parse(registryLastSeen);
  const to = Date.parse(acceptedAt);
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return null;
  const years = Math.floor((to - from) / YEAR_MS);
  return years >= MIN_GAP_YEARS ? years : null;
}

/**
 * View model shared by the SEO panel and the in-app card, so the two can never
 * disagree. null when there is nothing to show.
 *
 * `claim` leads and `detail` is small print. The badge previously opened with
 * "Esta declaración se aceptó el X y era coherente con la evidencia registral
 * comprobada en ese momento" — our hedge, ahead of the fact — followed by two
 * more caveats at near-equal weight. Nothing has been dropped: statusLine is
 * carried VERBATIM into `detail`, so the badge and the attestation permalink
 * still cannot drift on the load-bearing wording.
 *
 * Dates stay ISO here. The reader this page is written for is a foreign
 * professional, for whom 2026-09-09 is unambiguous and 09/09/2026 is not, and
 * mixing formats between the claim and the small print would read worse than
 * either format used consistently.
 *
 * `opts.registryLastSeen` is optional: without it the gap line is simply absent.
 */
export function confirmationViewModel(attestation, lang = 'es', opts = {}) {
  // The third argument USED to be a bare nowMs. A number destructures to all
  // defaults instead of throwing, so a missed call site would silently swap a
  // frozen test clock for the real one and only surface months later as a
  // level assertion flipping fresh->aging. Fail at the call instead.
  if (typeof opts !== 'object' || opts === null) {
    throw new TypeError('confirmationViewModel: third argument is an options object, e.g. { nowMs, registryLastSeen }');
  }
  if (!attestation || !attestation.accepted_at || !attestation.representative) return null;
  const { nowMs = Date.now(), registryLastSeen = null } = opts;
  const st = confirmationStatus(attestation.accepted_at, nowMs);
  if (!st) return null;
  const t = CONFIRMATION_I18N[lang] || CONFIRMATION_I18N.es;
  const accepted = day(attestation.accepted_at);

  const gapYears = registryLastSeen
    ? registryGapYears(registryLastSeen, attestation.accepted_at)
    : null;

  const reviewed = attestation.reviewer
    ? t.reviewed(attestation.reviewer, day(attestation.reviewed_at || attestation.approved_at))
    : null;

  return {
    title: attestation.status === 'outdated' ? t.outdatedTitle : t.title,
    level: attestation.status === 'outdated' ? 'stale' : st.level,
    claim: (t.claim[attestation.status] || t.claim.live)(accepted),
    gap: gapYears === null ? null : t.gap(day(registryLastSeen), gapYears),
    representative: `${attestation.representative.name}${
      attestation.representative.position ? ` — ${attestation.representative.position}` : ''}`,
    repLabel: t.rep,
    // Demoted, never removed. Order: what the check established, then who
    // reviewed the authority.
    detail: [statusLine(attestation, lang), reviewed].filter(Boolean),
    disclaimer: t.disclaimer,
    ageDays: st.ageDays,
  };
}

// '' when there is nothing to show, so the page renders unchanged.
export function renderConfirmationBlock(attestation, lang = 'es', opts = {}) {
  const vm = confirmationViewModel(attestation, lang, opts);
  if (!vm) return '';
  return `<section class="cc cc-${esc(vm.level)}" aria-label="${esc(vm.title)}">
    <div class="cc-head"><span class="cc-dot"></span><strong>${esc(vm.title)}</strong></div>
    <p class="cc-claim">${esc(vm.claim)}</p>
    ${vm.gap ? `<p class="cc-gap">${esc(vm.gap)}</p>` : ''}
    <p class="cc-rep"><strong>${esc(vm.repLabel)}:</strong> ${esc(vm.representative)}</p>
    <div class="cc-detail">
      ${vm.detail.map((d) => `<p>${esc(d)}</p>`).join('')}
      <p>${esc(vm.disclaimer)}</p>
    </div>
  </section>`;
}
