// Human-readable labels for BORME position codes.
//
// The registry publishes cargos as abbreviations — "MBRO.COM.AUD",
// "PRE.CONS.REC" — and until now the page printed them verbatim apart from nine
// hand-written entries. This composes a label from the two halves the classifier
// already recognises: WHO holds the seat (presidente / secretario / miembro…)
// and WHICH organ it sits on (auditoría, nombramientos y retribuciones…).
//
// Composition rather than a flat table of 1,045 entries, because the vocabulary
// drifts: the registry spells one committee a dozen ways (PRECOMAUDIT,
// PTE. C. AUD., PRE.COMS.AUD) and coins new variants, all of which this handles
// without a new entry. Codes where composition would be wrong get an explicit
// override.
//
// WHAT THIS DELIBERATELY DOES NOT DO: invent a name for a committee we cannot
// identify. About 200 organ codes name ad-hoc committees (PRE.COM.SCI,
// COM.GERENCIA) whose meaning is not recoverable from the abbreviation and for
// which we have no primary source. Those render as "Presidente de una comisión
// (PRE.COM.SCI)" — the role we can read, the organ left unnamed, and the code
// kept so a reader can check it against the BORME entry. Guessing the expansion
// would put words in the registry's mouth.
//
// (bormeparser, the libreborme upstream, publishes a partial table — 51% of our
// vocabulary, a third of its committee expansions still abbreviated, and GPLv3.
// Not used here.)
import { organKindFor, ORGAN_KINDS } from './organKinds.js';

// Exact codes whose label composition cannot reach. The first nine were the
// page's entire label map before this module existed.
const OVERRIDES = {
  'ADM. UNICO': { es: 'Administrador único', en: 'Sole director' },
  'ADM. SOLIDARIO': { es: 'Administrador solidario', en: 'Joint and several director' },
  'ADM. MANCOMUNADO': { es: 'Administrador mancomunado', en: 'Joint director' },
  'CON.DELEGADO': { es: 'Consejero delegado', en: 'Managing director (CEO)' },
  'CONS.EJECUTI': { es: 'Consejero ejecutivo', en: 'Executive director' },
  'CONS.EXTERNO': { es: 'Consejero externo', en: 'Non-executive director' },
  'CONS.EXT.IND': { es: 'Consejero externo independiente', en: 'Independent non-executive director' },
  'SECRENOCONSJ': { es: 'Secretario no consejero', en: 'Secretary (non-director)' },
  'VICESECR': { es: 'Vicesecretario', en: 'Deputy secretary' },
  // Consejero Delegado Mancomunado y Solidario — an office, not a commission.
  // Corroborated by bormeparser and by earelin/mercator independently, and by
  // the filing that named one man under both labels (ISLALINK SUBMARINE CABLES
  // SL, BORME 2014-06-05).
  'CO.DE.MA.SO': { es: 'Consejero delegado mancomunado y solidario', en: 'Joint and several managing director' },
};

// WHO holds the seat. Order matters: every vice- form must be tested before the
// office it deputises for, or "VICESECRET." reads as a secretary.
const ROLE_PREFIXES = [
  [/^(VICEPRESIDEN|VICEPRESID|VICEPRESI|VICEPRE|VICEPR|VICPRES|VICPRE|VICPR|VICPTE|VICEPTE|VPDTE|V-PRE|V-PR|V-P\b|V-P\.|VCP|VPRE|VPTE|VPR|VP)/, { es: 'Vicepresidente', en: 'Deputy chair' }],
  [/^(VICESECRETAR|VICESECRET|VICESEC|VICSEC|VICES|V-SEC|V-SE|VSECR|VSEC|VCSEC|VCS|VSE|VS)/, { es: 'Vicesecretario', en: 'Deputy secretary' }],
  [/^COPRE/, { es: 'Copresidente', en: 'Co-chair' }],
  [/^(PRESIDENT|PRESID|PRESI|PRES|PRE|PTE|PDTE|PR|P[.\s])/, { es: 'Presidente', en: 'Chair' }],
  [/^(SECRETARI|SECRET|SECRE|SECR|SEC|SCRT|SCR|SCT|SE[.\s]|S[.\s])/, { es: 'Secretario', en: 'Secretary' }],
  [/^(V-TES|VICETES|VTES)/, { es: 'Vicetesorero', en: 'Deputy treasurer' }],
  [/^(TESORER|TESOR|TESR|TESO|TES)/, { es: 'Tesorero', en: 'Treasurer' }],
  [/^(VOCAL|VOC|VOTI|VOSU|VO[.\s])/, { es: 'Vocal', en: 'Member' }],
  [/^(SUPLENT|SUPL|SUP)/, { es: 'Suplente', en: 'Alternate' }],
  [/^(MIEMBRO|MIEM|MIE|MMBR|MBRO|MRO|MI|ME|M[.\s])/, { es: 'Miembro', en: 'Member' }],
];

// WHICH organ. Tested in the same order as organKinds' committee patterns, for
// the same reason — "auditoría y control" is an audit committee.
const COMMITTEE_NAMES = [
  [/AUD|AUCNT|AUCUM/, { es: 'Auditoría', en: 'Audit' }],
  [/NOM|NYR|RETRIB|C\.RET|COM\.RET|CMS\.RET|ANR|AYR|NRGC/, { es: 'Nombramientos y Retribuciones', en: 'Nominations and Remuneration' }],
  [/EJEC|EJCR|COM\.EJ|COMS\.EJ|C\.EJ|COMEJ/, { es: 'Ejecutiva', en: 'Executive' }],
  [/RIESG|RIES|COM\.RI|COMS\.RI|C\.RIESGO/, { es: 'Riesgos', en: 'Risk' }],
  [/ESTRATEG|COMS\.EST|COM\.EST/, { es: 'Estrategia', en: 'Strategy' }],
  [/COM[S]?\.DEL|COMDEL|C\.DEL|CTE\.DEL|CO\.DE\.IN/, { es: 'Delegada', en: 'Delegated' }],
  [/SOSTE|SOSGC/, { es: 'Sostenibilidad', en: 'Sustainability' }],
  [/GOB|GYR/, { es: 'Gobierno Corporativo', en: 'Corporate Governance' }],
];

// Organs that are not committees of the board. `g` is the Spanish gender, which
// decides "de la Comisión" against "del Consejo".
const OTHER_ORGAN_NAMES = {
  [ORGAN_KINDS.CONTROL]: { es: 'Comisión de Control', en: 'Control Committee', g: 'f' },
  [ORGAN_KINDS.LIQUIDATION]: { es: 'Comisión Liquidadora', en: 'Liquidation Committee', g: 'f' },
  [ORGAN_KINDS.CREDITORS]: { es: 'Comisión de Acreedores', en: 'Creditors’ Committee', g: 'f' },
};

// The governing body itself, which after the grouping change appears on the
// board table — where a raw code reads worst.
const GOVERNING_BODY_NAMES = [
  // "Junta Rectora" before "Consejo Rector": both exist, and JTA.RECT names the
  // feminine one.
  [/(JTA|JUNTA|JUN)\.?\s?RE[CT]/, { es: 'Junta Rectora', en: 'Governing Board', g: 'f' }],
  [/REC[TG]?\b|\.REC|CON[S]?\.?\s?RE/, { es: 'Consejo Rector', en: 'Governing Council', g: 'm' }],
  [/JTA\.?\s?ADM|J\.\s?ADM|JUN\.ADM|CONADM|CJO\.ADM/, { es: 'Junta de Administración', en: 'Administrative Board', g: 'f' }],
  [/JTA|JUNTA|JUN\.|J\.DIR|J\.D\b|JDIR|JT\.DI/, { es: 'Junta Directiva', en: 'Executive Board', g: 'f' }],
  [/ASAMBL/, { es: 'Asamblea', en: 'General Assembly', g: 'f' }],
  [/CONSASE|CJO\.ASE|COM\.ASE/, { es: 'Consejo Asesor', en: 'Advisory Board', g: 'm' }],
  [/CON[S]?[.\s]?GO/, { es: 'Consejo de Gobierno', en: 'Governing Board', g: 'm' }],
];

const firstMatch = (patterns, text) => {
  for (const [pattern, label] of patterns) if (pattern.test(text)) return label;
  return null;
};

/** "Secretario de la Comisión de Auditoría" / "Secretary, Audit Committee". */
const joinRoleAndOrgan = (role, organName, gender, lang) => {
  if (!role) return organName;
  const roleName = role[lang] || role.es;
  if (lang === 'en') return `${roleName}, ${organName}`;
  return `${roleName} ${gender === 'm' ? 'del' : 'de la'} ${organName}`;
};

/** A single all-caps word is a code only in its casing — "APODERADO" is already
 *  the word. Restoring sentence case is formatting, not interpretation, so it
 *  is safe where expanding an abbreviation would not be. */
const sentenceCase = word => word.charAt(0) + word.slice(1).toLowerCase();

/**
 * A readable label for a raw registry position.
 *
 * Returns the code itself when nothing better can be said — never a guess.
 *
 * @param {string} pos - raw registry position ("MBRO.COM.AUD").
 * @param {'es'|'en'} [lang]
 * @returns {string}
 */
export const positionLabelFor = (pos, lang = 'es') => {
  const raw = (pos || '').trim();
  if (!raw) return '';
  const p = raw.toUpperCase();
  const pick = label => label[lang] || label.es;

  const override = OVERRIDES[p];
  if (override) return pick(override);

  const kind = organKindFor(p);
  if (!kind) return /^[A-ZÁÉÍÓÚÑ]+$/.test(p) ? sentenceCase(p) : raw;

  // A bare vocal names no organ: "Vocal 3" is already the whole label.
  if (kind === ORGAN_KINDS.PLAIN_VOCAL) {
    const ordinal = p.match(/\d+/);
    const suplente = /SUPLEN/.test(p);
    return `${pick({ es: 'Vocal', en: 'Board member' })}${ordinal ? ` ${ordinal[0]}` : ''}${
      suplente ? pick({ es: ' suplente', en: ' (alternate)' }) : ''}`;
  }

  const role = firstMatch(ROLE_PREFIXES, p);

  if (kind === ORGAN_KINDS.GOVERNING_BODY) {
    const organ = firstMatch(GOVERNING_BODY_NAMES, p);
    if (!organ) return raw;
    return joinRoleAndOrgan(role, pick(organ), organ.g, lang);
  }

  const other = OTHER_ORGAN_NAMES[kind];
  if (other) return joinRoleAndOrgan(role, pick(other), other.g, lang);

  if (kind === ORGAN_KINDS.BOARD_COMMITTEE) {
    const committee = firstMatch(COMMITTEE_NAMES, p);
    if (committee) {
      // "Comisión Ejecutiva" and "Comisión Delegada" are adjectival and take no
      // "de"; the rest are "Comisión de X".
      const organName = lang === 'en'
        ? `${pick(committee)} Committee`
        : /^(Ejecutiva|Delegada)$/.test(committee.es)
        ? `Comisión ${committee.es}`
        : `Comisión de ${committee.es}`;
      return joinRoleAndOrgan(role, organName, 'f', lang);
    }
  }

  // An organ we cannot name. Say what we can read, keep the code so the reader
  // can check it against the BORME entry, and claim nothing about which
  // committee it is.
  if (!role) return `${lang === 'en' ? 'Committee' : 'Comisión'} (${raw})`;
  const roleName = role[lang] || role.es;
  return lang === 'en'
    ? `${roleName} of a committee (${raw})`
    : `${roleName} de una comisión (${raw})`;
};
