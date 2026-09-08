/**
 * Binds an attester to a ROW in officers_active, not to a name string.
 *
 * Matching is sorted-token EQUALITY, which is stricter than the subset match it
 * replaces and simpler than rotation handling: BORME writes surnames first, and
 * a person may introduce themselves either way, but the token multiset is the
 * same. A subset match would let "Maria Garcia" claim the seat of "GARCIA LOPEZ
 * MARIA", who is a different person.
 *
 * A match is NECESSARY to invite an attester. It is never SUFFICIENT: holding a
 * registry position is not the same as holding power to represent the company
 * (spec section 4.3), which only a reviewer establishes.
 */
export function nameTokens(name) {
  return (name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

const sortedKey = (name) => nameTokens(name).sort().join(' ');

export function matchSeat(declaredName, officersActive) {
  const key = sortedKey(declaredName);
  if (!key) return null;
  const hit = (officersActive || []).find(
    (o) => sortedKey(o.name || o.name_normalized) === key,
  );
  if (!hit) return null;
  return {
    name: hit.name || hit.name_normalized,
    position: hit.position_normalized || hit.position || null,
    appointed_date: hit.appointed_date || null,
  };
}
