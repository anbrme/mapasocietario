// Map a raw position string (as stored on link.relationship / officer
// position_normalized, e.g. "APO.SOL", "CON.IND.", "CONS.EXT.DOM") to one of
// ~10 canonical category labels. Shared by the graph component (filter chips +
// simplified mode) and the officer-capping service so both classify positions
// identically. The full vocabulary of registry positions lives in
// src/data/terms.json (officersPositions).
export const POSITION_CATEGORY_ORDER = [
  'Presidente',
  'Vicepresidente',
  'Consejero',
  'Administrador',
  'Secretario',
  'Liquidador',
  'Vocal / Comisión',
  'Apoderado',
  'Auditor',
  'Otros',
];

export const positionCategoryFor = pos => {
  const p = (pos || '').toUpperCase();
  if (!p) return 'Otros';
  if (p.startsWith('PRESIDENTE') || p.startsWith('PDTE') || p.startsWith('PRES.') || p.startsWith('PRE.COM')) return 'Presidente';
  if (p.startsWith('VICEPRESIDENTE') || p.startsWith('VPDTE') || p.startsWith('VICEPTE') || p.startsWith('VIC.COM') || p.startsWith('VICPTE')) return 'Vicepresidente';
  // "CON." covers the registry's S-less consejero abbreviations: CON.DEL.*,
  // CON.IND.*, CON.INTERIN., CON.JUN.ADM., … (no apoderado/auditor starts with "CON.")
  if (p.startsWith('CONSEJERO') || p.startsWith('CONS.') || p.startsWith('CONS ') || p.startsWith('CON.')) return 'Consejero';
  if (p.startsWith('ADMINISTRADOR') || p.startsWith('ADM.') || p.startsWith('ADM ')) return 'Administrador';
  if (p.startsWith('SECRETARIO') || p.startsWith('SECRET.') || p.startsWith('SRIO') || p.startsWith('SECR.')) return 'Secretario';
  if (p.startsWith('LIQUIDADOR') || p.startsWith('LIQ.') || p.startsWith('LIQ ')) return 'Liquidador';
  if (p.startsWith('VOCAL')) return 'Vocal / Comisión';
  if (/^(MIE|MBRO|MRO|MIEM|M)\.?COM/.test(p)) return 'Vocal / Comisión';
  if (p.startsWith('AUDITOR') || p.startsWith('AUD.')) return 'Auditor';
  // DTOR.APO.SUC = director apoderado de sucursal — apoderado variant.
  if (p.startsWith('APO') || p.startsWith('APD') || p.startsWith('DTOR.APO')) return 'Apoderado';
  return 'Otros';
};

// Simplified mode ("Simplificar" chip) hides ONLY these categories. This is an
// exclusion list, NOT an admission list: unknown or unmapped positions must
// stay visible, otherwise legitimate roles disappear from the graph (e.g.
// independent directors "CON.IND." on Acerinox were silently dropped when
// unmapped positions fell into a collapsible "Otros").
export const SIMPLIFIED_EXCLUDED_CATEGORIES = new Set(['Apoderado']);
