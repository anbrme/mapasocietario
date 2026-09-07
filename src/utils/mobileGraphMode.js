/**
 * Decide how an embedded graph behaves on a compact/mobile surface.
 *
 * The empty /app workspace must keep its search controls. As soon as a result
 * exists, the same surface becomes the compact graph. Automatic desktop panels
 * are disabled for the whole compact surface, including during that transition.
 *
 * forceFullMode (?full=1) is the compact surface's own escape hatch: the
 * "open full application" button that promises the advanced tools. It has to
 * beat both the viewport test and the native-app override, because on a phone
 * every other signal says "compact" and the button would otherwise reopen the
 * very view the reader is trying to leave.
 */
export function mobileGraphMode({
  embedded,
  compactViewport,
  forceCompactMode,
  forceFullMode,
  initialCompanyName,
  nodeCount,
}) {
  const surface = Boolean(
    !forceFullMode && embedded && (compactViewport || forceCompactMode),
  );
  const active = Boolean(surface && (initialCompanyName || nodeCount > 0));

  return {
    surface,
    active,
    allowAutomaticPanels: !surface,
  };
}
