/**
 * The act on the newest filing, in the registry's own words.
 *
 * The inspector card names what last happened to a company rather than
 * summarising whether anything is wrong with it, so this returns BORME's own
 * label untouched — no severity, no interpretation, no mapping to a friendlier
 * word that would put our reading between the reader and the record.
 *
 * "Datos registrales" rides along on nearly every entry and describes
 * bookkeeping rather than an event, so it is only reported when it is
 * genuinely all the filing says.
 */
const BOILERPLATE = /^datos registrales$/i;

const asText = (value) =>
  (typeof value === 'string' ? value : value && value.type ? value.type : '').trim();

export function latestEventType(sortedEvents) {
  const newest = (sortedEvents || [])[0];
  const named = ((newest && newest.event_types) || []).map(asText).filter(Boolean);
  if (!named.length) return null;
  return named.find((type) => !BOILERPLATE.test(type)) || named[0];
}

export default latestEventType;
