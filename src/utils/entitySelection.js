/**
 * How a picked autocomplete row should be plotted on the graph.
 *
 * Two backends feed the dropdown, and between them a row can mean three
 * different things:
 *
 *   - a COMPANY DOC (directory `source: "v3"`, mapped to type "company"): its
 *     `id` is a real group_key and the company search can fetch everything;
 *   - an OWNER-ONLY entity (directory `source: "sole_shareholder"`, type
 *     "sole_shareholder"): the registry knows it only as a socio único, there
 *     is no company doc, and `id` is just the name. Usually a private
 *     individual; sometimes a foreign parent with no Spanish company doc;
 *   - an OFFICER (officers-autocomplete): a person, or a corporate officer.
 *
 * Neither backend says whether an entity is a person or a company, so the KIND
 * is read off the name (isCorporateName: legal-form suffix, or exact equality
 * with a curated listed entity — BORME prints "BANCO SANTANDER" with no form)
 * while the TYPE decides which search can actually return something.
 *
 * Reading `type === 'sole_shareholder'` as "a company owns things" plotted
 * PICON OTERO ALBERTO — a man who is sole shareholder and sole administrator
 * of EQUILATERO SOLUCIONES ESTRATEGICAS SL — as a company node. Every lookup
 * that followed searched the registry for a company by his name, found nothing,
 * and left him alone on the canvas. Reading `is_sole_shareholder` on a company
 * row the same way did the mirror image: SANITAS HOLDING SL, a company with a
 * group_key and 96 current officers, became a lone person node.
 */
import { isCorporateName } from './legalEntity';

/**
 * Normalize the directory's `owns` payload to `{ name, groupKey }`.
 *
 * The directory hands us the owned companies inline, each with its stable
 * group_key — everything needed to plot them without a second round trip.
 * That matters beyond speed: `/bormes/sole-shareholder-companies` answers 0
 * companies for names the directory answers with one, so re-querying loses
 * the very company the user came for.
 *
 * @param {Array<{group_key?: string, id?: string, name?: string, company_name?: string}>} owns
 * @returns {Array<{name: string, groupKey: string|null}>}
 */
export const ownedCompaniesFromHint = owns => {
  if (!Array.isArray(owns)) return [];

  const seen = new Set();
  const result = [];

  for (const entry of owns) {
    const name = (entry?.name || entry?.company_name || '').trim();
    if (!name) continue;

    const key = name.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const groupKey = (entry.group_key || entry.id || '').trim();
    result.push({ name, groupKey: groupKey || null });
  }

  return result;
};

/**
 * Classify a picked suggestion into a plot route.
 *
 * route:
 *   'officer'     — run the officer search: it plots the person together with
 *                   every company they hold a cargo in.
 *   'shareholder' — plot a bare node and stage the participadas behind the
 *                   confirmation pill (an owner with no cargos of its own, so
 *                   the officer search would return nothing).
 *   'company'     — the ordinary company search.
 *
 * A person who both owns and administers takes the officer route: it is the
 * one that actually fetches companies. `owns` rides along so the caller can
 * draw the ownership edges on top, with no extra request.
 *
 * @param {Object|null} suggestion - a row from the unified autocomplete.
 * @returns {{name: string, entityKind: 'person'|'company', route: 'officer'|'shareholder'|'company', owns: Array, ownsTotal: number, isShareholderRow: boolean}}
 */
export const classifyEntitySelection = suggestion => {
  const row = suggestion || {};
  const name = (row.name || row.value || row.label || '').trim();
  const entityKind = isCorporateName(name) ? 'company' : 'person';

  const owns = ownedCompaniesFromHint(row.owns);
  const ownsTotal = Number(row.owns_total) || owns.length;

  // The directory answers in two shapes, and the difference is what decides the
  // route:
  //   source "v3"               → a real company doc; `id` IS its group_key and
  //                               `is_sole_shareholder` is only a display flag
  //   source "sole_shareholder" → the registry knows this entity ONLY as an
  //                               owner; there is no company doc and `id` is the
  //                               bare name
  // The service maps the first to type "company" and the second to type
  // "sole_shareholder", so the type carries that distinction.
  const type = row.type || 'company';
  const isOfficerRow = type === 'officer' || type === 'officer_sole_shareholder';
  const hasCompanyDoc = type === 'company';
  // Owner-only: nothing to search in the company index, by name or by key.
  const isOwnerOnlyRow = type === 'sole_shareholder';
  const isShareholderRow =
    isOwnerOnlyRow || type === 'officer_sole_shareholder' || !!row.is_sole_shareholder;

  // An officer twin means officers-autocomplete listed this same entity, so the
  // officer search has something to return. `company_count` is that twin's
  // cargo count, carried over when the two rows were folded into one.
  const hasCargos = Number(row.company_count) > 0 || !!row.has_officer_twin;

  const route = (() => {
    // A nameless row can't be searched as anything; leave it on the inert
    // default rather than firing an officer lookup for "".
    if (!name) return 'company';

    // A company doc always wins: the company search plots its officers, its
    // profile and what it owns. Owning something is no reason to fall back to a
    // bare node — and a registered name carrying no recognizable legal form is
    // no reason to treat the row as a person.
    if (hasCompanyDoc) return 'company';

    if (isOfficerRow) return 'officer';

    if (isOwnerOnlyRow) {
      // A person who also holds a cargo: the officer search is the one that
      // fetches companies, and the ownership edges ride along from `owns`.
      if (entityKind === 'person' && hasCargos) return 'officer';
      // Otherwise stage the participadas: there is no company doc to search, so
      // the pill is the only thing that can plot them.
      if (ownsTotal > 0) return 'shareholder';
      return entityKind === 'person' ? 'officer' : 'company';
    }

    return 'company';
  })();

  return { name, entityKind, route, owns, ownsTotal, isShareholderRow };
};

export default classifyEntitySelection;
