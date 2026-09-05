/**
 * Decide how an embedded graph behaves on a compact/mobile surface.
 *
 * The empty /app workspace must keep its search controls. As soon as a result
 * exists, the same surface becomes the compact graph. Automatic desktop panels
 * are disabled for the whole compact surface, including during that transition.
 */
export function mobileGraphMode({
  embedded,
  compactViewport,
  forceCompactMode,
  initialCompanyName,
  nodeCount,
}) {
  const surface = Boolean(embedded && (compactViewport || forceCompactMode));
  const active = Boolean(surface && (initialCompanyName || nodeCount > 0));

  return {
    surface,
    active,
    allowAutomaticPanels: !surface,
  };
}
