/**
 * Was this person a deputy, or IS one — and over what period?
 *
 * The panel used to decide with `!!d.FECHABAJA` on the matcher's primary row.
 * That is wrong twice over.
 *
 * FECHABAJA records an EARLY departure — death, resignation, incompatibility.
 * A deputy who serves to the natural end of a legislature and does not stand
 * again has no FECHABAJA at all, so "completed their term" read as "still
 * sitting". ACEBES PANIAGUA ANGEL JESUS (legislatures VI-IX, last ended 2011)
 * was published as "27/03/1996 — present" in 2026.
 *
 * And the primary row is chosen by pickPrimaryRow for having party info, not
 * for being current, so its FECHABAJA describes an arbitrary legislature.
 *
 * A person is a sitting deputy only if some row belongs to the CURRENT
 * legislature (LEGISLATURAACTUAL === 'S') and they have not left it early.
 * Saying someone currently holds public office when they left fifteen years
 * ago is a claim about a named living person, so the test is positive
 * evidence of a current seat — never the absence of an exit record.
 */

const parseEsDate = (value) => {
  if (!value) return 0;
  const parts = String(value).split('/');
  if (parts.length === 3) return Date.parse(`${parts[2]}-${parts[1]}-${parts[0]}`) || 0;
  return Date.parse(value) || 0;
};

export function deputyTenure(rows) {
  const all = Array.isArray(rows) ? rows.filter(Boolean) : [];
  // Two sources, two schemas. The historical file (?source=all) carries every
  // deputy ever and marks the current legislature with LEGISLATURAACTUAL. The
  // active file (DiputadosActivos) lists ONLY sitting deputies and is the only
  // one carrying FORMACIONELECTORAL — so a party field is itself evidence of a
  // current seat. The matcher uses the historical file when it can and falls
  // back to active-only, so both markers have to count or a sitting deputy
  // would read as former in the fallback path.
  const sittingRow = all.find(
    (r) => (r.LEGISLATURAACTUAL === 'S' || r.FORMACIONELECTORAL) && !r.FECHABAJA,
  ) || null;

  const starts = all.map((r) => r.FECHAINICIOLEGISLATURA).filter(Boolean);
  // FECHABAJA is the fallback: an early exit ends a term just as a legislature's
  // close does, and old legislatures may carry only one of the two.
  const ends = all.map((r) => r.FECHAFINLEGISLATURA || r.FECHABAJA).filter(Boolean);

  return {
    isFormer: !sittingRow,
    sittingLegislature: sittingRow ? sittingRow.LEGISLATURA || null : null,
    earliest: [...starts].sort((a, b) => parseEsDate(a) - parseEsDate(b))[0] || null,
    latest: [...ends].sort((a, b) => parseEsDate(b) - parseEsDate(a))[0] || null,
  };
}

export default deputyTenure;
