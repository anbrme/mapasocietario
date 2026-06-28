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

const I18N = {
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
  },
};

// Decaying, registry-anchored confirmation panel. '' when there is nothing to show.
export function renderConfirmationBlock(rec, lang = 'es', nowMs = Date.now()) {
  if (!rec || !rec.confirmedAt || !rec.representative) return '';
  const st = confirmationStatus(rec.confirmedAt, nowMs);
  if (!st) return '';
  const t = I18N[lang] || I18N.es;

  const line =
    st.level === 'fresh'
      ? t.fresh(esc(rec.representative), esc(rec.role || ''), st.ageDays)
      : t.aged(st.ageDays);

  const facts = (rec.affirms || [])
    .map((f) => {
      const chip =
        f.status === 'none'
          ? `<span class="cc-chip cc-none">${t.chipNone}</span>`
          : `<span class="cc-chip cc-cur">${t.chipCurrent}</span>`;
      return `<li>${esc(f.label)} ${chip}</li>`;
    })
    .join('');

  return `<section class="cc cc-${st.level}" aria-label="${esc(t.title)}">
    <div class="cc-head"><span class="cc-dot"></span><strong>${esc(t.title)}</strong></div>
    <p class="cc-line">${line}</p>
    ${facts ? `<p class="cc-asof">${t.asOf(fmtDate(rec.confirmedAt, lang))}</p><ul class="cc-facts">${facts}</ul>` : ''}
    <p class="cc-prov">${esc(t.disclaimer)}</p>
  </section>`;
}
