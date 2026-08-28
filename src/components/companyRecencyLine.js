/**
 * One line of recency for the inspector card: what the last filing WAS, when,
 * and how many there have been.
 *
 * The panel used to carry this as two grid cells — a "first — last" range and a
 * separate publication count — which spent two boxes repeating one date. The
 * event TYPE is what makes the line interesting rather than merely recent; the
 * count is what makes the record feel alive.
 *
 * Neither carries severity. This card states what a company IS, never whether
 * something is wrong with it: interpretation needs room to justify itself —
 * the filing it came from, why it is worth noting — and that room is on
 * /empresa and in the report, not here. A compressed verdict is either a wall
 * or an alarm, and a bare count is anxiety without information.
 */
import { formatDate } from '../utils/formatDate';

const COPY = {
  es: { lead: 'Última publicación', total: 'en total', since: 'desde' },
  en: { lead: 'Last filing', total: 'in total', since: 'since' },
};

export function companyRecencyLine({
  lastEventType = null,
  lastSeen = null,
  firstSeen = null,
  eventCount = 0,
  lang = 'es',
} = {}) {
  if (!lastSeen) return null;
  const t = COPY[lang] || COPY.es;

  const head = [lastEventType, formatDate(lastSeen, lang)].filter(Boolean).join(' · ');
  const parts = [`${t.lead}: ${head}`];

  if (Number(eventCount) > 0) {
    const year = String(firstSeen || '').slice(0, 4);
    parts.push(/^\d{4}$/.test(year)
      ? `${eventCount} ${t.total} ${t.since} ${year}`
      : `${eventCount} ${t.total}`);
  }
  return parts.join(' · ');
}

export default companyRecencyLine;
