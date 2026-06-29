/**
 * Currency-confirmation logic + rendering for the public company pages.
 * Self-contained (own esc/i18n) so it stays unit-testable and never imports
 * from _lib.js (which imports this — a cycle). The `_` prefix means Cloudflare
 * Pages does not route this file.
 */

const DAY_MS = 86_400_000;

// Age (whole days, never negative) of a 'YYYY-MM-DD' confirmation at nowMs,
// mapped to a decay level. null if the date can't be parsed.
export function confirmationStatus(confirmedAt, nowMs = Date.now()) {
  const t = Date.parse(`${confirmedAt}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  const ageDays = Math.max(0, Math.floor((nowMs - t) / DAY_MS));
  const level = ageDays <= 90 ? 'fresh' : ageDays <= 365 ? 'aging' : 'stale';
  return { ageDays, level };
}

// Accent/punctuation-insensitive uppercase word tokens.
export function tokens(name) {
  return (name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// True if every token of repName appears in at least one officer's token set.
export function nameIsOfficer(repName, officerNames) {
  const rep = tokens(repName);
  if (!rep.length) return false;
  return (officerNames || []).some((o) => {
    const set = new Set(tokens(o));
    return rep.every((tk) => set.has(tk));
  });
}

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(d, lang) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
  if (!m) return d || '';
  const [, y, mo, day] = m;
  return lang === 'en' ? `${day} ${EN_MONTHS[parseInt(mo, 10) - 1]} ${y}` : `${day}/${mo}/${y}`;
}

export const CONFIRMATION_I18N = {
  es: {
    title: 'Confirmación de vigencia',
    fresh: (rep, role, n) =>
      `Confirmado actual por ${rep}${role ? `, ${role}` : ''} (verificado en el registro), hace ${n} ${n === 1 ? 'día' : 'días'}`,
    aged: (n) => `Última confirmación hace ${n} ${n === 1 ? 'día' : 'días'}`,
    asOf: (date) => `La empresa confirma, a fecha ${date}:`,
    chipCurrent: 'vigente',
    chipNone: 'sin constancia',
    disclaimer:
      'Declaración de un representante cuya autoridad ha sido verificada contra el registro público. Mapa Societario verifica la autoridad del representante, no la veracidad de cada afirmación.',
    methods: {
      'email-from-tied-address': 'Verificado por confirmación desde el email de la empresa',
      'registry-officer-match': 'Autoridad verificada contra el registro público',
    },
  },
  en: {
    title: 'Currency confirmation',
    fresh: (rep, role, n) =>
      `Confirmed current by ${rep}${role ? `, ${role}` : ''} (registry-verified), ${n} ${n === 1 ? 'day' : 'days'} ago`,
    aged: (n) => `Last confirmed ${n} ${n === 1 ? 'day' : 'days'} ago`,
    asOf: (date) => `As of ${date}, the company confirms:`,
    chipCurrent: 'current',
    chipNone: 'none on record',
    disclaimer: `Statement by a representative whose authority was verified against the public registry. Mapa Societario verifies the representative's authority, not the truth of each statement.`,
    methods: {
      'email-from-tied-address': "Verified by confirmation from the company’s email",
      'registry-officer-match': 'Authority verified against the public registry',
    },
  },
};

// Render-ready view model shared by the SEO HTML renderer and the in-app React
// card. Strings are UNESCAPED (React escapes; the HTML renderer escapes at its
// sink). null when there is nothing to show.
export function confirmationViewModel(rec, lang = 'es', nowMs = Date.now()) {
  if (!rec || !rec.confirmedAt || !rec.representative) return null;
  const st = confirmationStatus(rec.confirmedAt, nowMs);
  if (!st) return null;
  const t = CONFIRMATION_I18N[lang] || CONFIRMATION_I18N.es;

  const statusLine =
    st.level === 'fresh'
      ? t.fresh(rec.representative, rec.role || '', st.ageDays)
      : t.aged(st.ageDays);

  const facts = (rec.affirms || []).map((f) => ({
    label: f.label,
    status: f.status === 'none' ? 'none' : 'current',
    chipLabel: f.status === 'none' ? t.chipNone : t.chipCurrent,
  }));

  return {
    title: t.title,
    level: st.level,
    statusLine,
    verifiedVia: rec.verification ? (t.methods[rec.verification] || null) : null,
    asOf: facts.length ? t.asOf(fmtDate(rec.confirmedAt, lang)) : null,
    facts,
    disclaimer: t.disclaimer,
  };
}

// Decaying, registry-anchored confirmation panel. '' when there is nothing to show.
export function renderConfirmationBlock(rec, lang = 'es', nowMs = Date.now()) {
  const vm = confirmationViewModel(rec, lang, nowMs);
  if (!vm) return '';

  const facts = vm.facts
    .map((f) => {
      const cls = f.status === 'none' ? 'cc-chip cc-none' : 'cc-chip cc-cur';
      return `<li>${esc(f.label)} <span class="${cls}">${esc(f.chipLabel)}</span></li>`;
    })
    .join('');

  return `<section class="cc cc-${vm.level}" aria-label="${esc(vm.title)}">
    <div class="cc-head"><span class="cc-dot"></span><strong>${esc(vm.title)}</strong></div>
    <p class="cc-line">${esc(vm.statusLine)}</p>
    ${vm.verifiedVia ? `<p class="cc-method">${esc(vm.verifiedVia)}</p>` : ''}
    ${vm.asOf ? `<p class="cc-asof">${esc(vm.asOf)}</p><ul class="cc-facts">${facts}</ul>` : ''}
    <p class="cc-prov">${esc(vm.disclaimer)}</p>
  </section>`;
}
