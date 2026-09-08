/**
 * The two-lane timeline: registry filings against attestations, on one axis.
 *
 * This is the product's thesis drawn literally. A company's dated statements
 * run alongside the immutable record that can contradict them, and the moment
 * the lanes cross is the moment a statement stopped being current. A gap in the
 * attestation lane is as legible as a filing in the registry lane.
 *
 * Pure: builds a model and an inline SVG string. No DOM, no fetch.
 */

const DAY = 86_400_000;
const parse = (d) => Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? `${d}T00:00:00Z` : d);

// BORME event_types is a list of {category, type}; the type is what a reader
// recognises. Falls back to the flags when the list is absent.
function eventLabel(event) {
  const types = Array.isArray(event.event_types) ? event.event_types : [];
  const named = types.map((t) => t && t.type).filter(Boolean);
  if (named.length) return named.slice(0, 2).join(' · ');
  if (event.has_dissolution) return 'Disolución';
  if (event.is_concurso) return 'Concurso';
  if (event.has_officer_changes) return 'Cambio de administradores';
  if (event.has_address_change) return 'Cambio de domicilio';
  if (event.has_capital_change) return 'Cambio de capital';
  return 'Asiento registral';
}

/**
 * One ordered model for both lanes. `points` carry a fractional x in [0,1] so
 * the renderer never has to know about dates.
 */
export function buildTimeline({ events = [], history = [], acceptedAt, nowMs = Date.now() }) {
  const registry = events
    .map((e) => ({ lane: 'registry', at: parse(e.event_date), label: eventLabel(e) }))
    .filter((p) => Number.isFinite(p.at));

  const attestation = history
    .map((h) => ({ lane: 'attestation', at: parse(h.created_at), label: h.summary }))
    .filter((p) => Number.isFinite(p.at));

  const all = [...registry, ...attestation].sort((a, b) => a.at - b.at);
  if (!all.length) return { points: [], min: null, max: null, span: 0 };

  // Always include today, so a stale attestation shows the gap since its last
  // point rather than ending flush against the right edge looking current.
  const min = all[0].at;
  const max = Math.max(all[all.length - 1].at, nowMs);
  const span = Math.max(max - min, DAY);

  return {
    points: all.map((p) => ({ ...p, x: (p.at - min) / span })),
    min, max, span,
    acceptedX: Number.isFinite(parse(acceptedAt))
      ? Math.min(1, Math.max(0, (parse(acceptedAt) - min) / span))
      : null,
  };
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const year = (ms) => new Date(ms).getUTCFullYear();

const LANE_Y = { registry: 34, attestation: 78 };
const LABELS = {
  es: { registry: 'Registro (BORME)', attestation: 'Declaraciones', today: 'hoy', empty: 'Sin datos para la línea temporal.' },
  en: { registry: 'Registry (BORME)', attestation: 'Statements', today: 'today', empty: 'No timeline data.' },
};

/**
 * Inline SVG, theme-aware via currentColor so it works on light and dark
 * without a second palette. Width is viewBox-relative, so it scales.
 */
export function renderTimelineSvg(model, lang = 'es') {
  const t = LABELS[lang] || LABELS.es;
  if (!model || !model.points.length) return `<p class="tl-empty">${esc(t.empty)}</p>`;

  const W = 720, PAD = 92, INNER = W - PAD - 24;
  const x = (fx) => PAD + fx * INNER;

  const lanes = ['registry', 'attestation'].map((lane) => `
    <line x1="${PAD}" y1="${LANE_Y[lane]}" x2="${PAD + INNER}" y2="${LANE_Y[lane]}"
          stroke="currentColor" stroke-opacity=".22" stroke-width="1"/>
    <text x="0" y="${LANE_Y[lane] + 4}" font-size="11" fill="currentColor" fill-opacity=".7">${esc(t[lane])}</text>`
  ).join('');

  const marks = model.points.map((p) => {
    const cx = x(p.x).toFixed(1);
    const cy = LANE_Y[p.lane];
    const shape = p.lane === 'registry'
      ? `<circle cx="${cx}" cy="${cy}" r="4.5" fill="currentColor" fill-opacity=".55"/>`
      : `<rect x="${(cx - 4.5).toFixed(1)}" y="${cy - 4.5}" width="9" height="9"
             fill="currentColor" transform="rotate(45 ${cx} ${cy})"/>`;
    return `<g><title>${esc(p.label)} — ${esc(new Date(p.at).toISOString().slice(0, 10))}</title>${shape}</g>`;
  }).join('');

  // The acceptance moment, drawn across both lanes: everything to its right is
  // what the registry has done SINCE the statement was made.
  const accepted = model.acceptedX === null ? '' : `
    <line x1="${x(model.acceptedX).toFixed(1)}" y1="18" x2="${x(model.acceptedX).toFixed(1)}" y2="94"
          stroke="currentColor" stroke-opacity=".35" stroke-dasharray="3 3"/>`;

  return `<svg class="tl" viewBox="0 0 ${W} 116" role="img" preserveAspectRatio="xMidYMid meet"
       aria-label="${esc(t.registry)} / ${esc(t.attestation)}">
    ${lanes}${accepted}${marks}
    <text x="${PAD}" y="110" font-size="10" fill="currentColor" fill-opacity=".6">${year(model.min)}</text>
    <text x="${PAD + INNER}" y="110" font-size="10" text-anchor="end"
          fill="currentColor" fill-opacity=".6">${esc(t.today)}</text>
  </svg>`;
}
