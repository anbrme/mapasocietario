// Shared logic for deciding whether a graph link is DIRECTIONAL (officer→company
// appointment/cese, or owner→owned ownership), used by both the arrowhead drawing
// and the particle-flow gate in SpanishCompanyNetworkGraph so the two never
// disagree about which edges get directional treatment.
import { effectiveCategoryFromEvents } from './officerLinkStatus';

// BORME section names a role-link's category can resolve to. Also used (in the
// graph component) to strip section-name text from edge labels.
export const BORME_SECTION_NAMES = new Set([
  'nombramientos', 'reelecciones', 'ceses_dimisiones', 'ceses', 'revocaciones',
  'dimisiones', 'cargo no especificado',
]);

// Resolve a link's effective category the same way the renderer colors it:
// prefer the latest event's category (role-filtered at enrichment time,
// preferring an appointment over a same-date cessation on a board renewal),
// falling back to the build-time link.category. A user-amended link's category
// is authoritative and is never overridden by events.
export const getLinkEffectiveCategory = link => {
  if (!link || link.userAmended) return link?.category;
  return effectiveCategoryFromEvents(link.events, link.category);
};

// A link is DIRECTIONAL (gets an arrowhead + particle flow) when it represents
// an officer→company appointment/cese or an owner→owned ownership tie. In the
// MAIN graph view, officer→company edges are built with a resolved BORME
// section category (e.g. category: 'nombramientos') rather than
// type: 'officer-company' — that type is only stamped by the officer-expand
// paths (assembleOfficerGraph etc). So the gate must also recognize the
// resolved category, not just the type field. Resolve the category the same
// way the renderer colors the link (getLinkEffectiveCategory) so arrows and
// particles never disagree with what's drawn/colored on screen.
export const isDirectionalLink = link => {
  if (!link) return false;
  if (link.type === 'officer-company' || link.type === 'ownership') return true;
  const cat = (getLinkEffectiveCategory(link) || '').toLowerCase();
  if (BORME_SECTION_NAMES.has(cat)) return true;
  if (cat.startsWith('socio')) return true;
  return false;
};
