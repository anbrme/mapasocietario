// The cargo families, for the public "how we read registry positions" page.
//
// BORME publishes officer positions as non-standardised abbreviations and has
// never published an expansion table, so every provider decodes them with a
// private dictionary. This is the readable face of ours.
//
// It lists FAMILIES rather than all 1,191 codes on purpose: our labels are
// composed from the office and the qualifiers a code carries, not looked up in
// a table, so a family stays true when the registry coins a new spelling. The
// page renders each example through positionLabelFor at BUILD TIME, so the
// published expansions cannot drift from the ones the product actually shows —
// test/cargo-families.test.mjs fails if a code stops belonging to its family.
//
// `directorship` is the question readers care about most: does holding this
// make you a director of the company?
//   'yes'  — a governing-body seat, or a committee only a consejero may hold
//   'no'   — a real registry role that is not a board seat
//   'never'— an organ that looks board-like and is not; the distinction the
//            classifier exists to protect

export const CARGO_FAMILIES = [
  // --- The governing body itself ---------------------------------------
  {
    id: 'administrador',
    directorship: 'yes',
    codes: ['ADM. UNICO', 'ADM. SOLID.', 'ADM. MANCOM.', 'ADM.CONCURS.'],
    es: {
      name: 'Administrador',
      blurb: 'El órgano de administración cuando no hay consejo. La abreviatura dice cómo se ejerce el cargo: único, solidario (cada uno puede actuar solo), mancomunado (deben firmar conjuntamente) o concursal.',
    },
    en: {
      name: 'Administrador (director)',
      blurb: 'The governing body where there is no board. The abbreviation says how the office is exercised: sole, joint and several (each may act alone), joint (they must sign together), or insolvency-appointed.',
    },
  },
  {
    id: 'consejero',
    directorship: 'yes',
    codes: ['CONSEJERO', 'CONS.INDEPEN', 'CONS.DOMINIC', 'CONS.EJECUTI', 'CONS.OTR.EXT', 'CONS.NO EJEC'],
    es: {
      name: 'Consejero y sus clases',
      blurb: 'Miembro del consejo de administración. Las clases —ejecutivo, dominical, independiente y otros externos— son las del artículo 529 duodecies de la Ley de Sociedades de Capital, no una categorización nuestra.',
    },
    en: {
      name: 'Consejero and its classes',
      blurb: 'A member of the board of directors. The classes — executive, proprietary, independent and other external — are those of art. 529 duodecies of the Companies Act, not a categorisation of ours.',
    },
  },
  {
    id: 'consejero-delegado',
    directorship: 'yes',
    codes: ['CON.DELEGADO', 'CONS.DEL.SOL', 'CONS.DEL.MAN', 'CO.DE.MA.SO'],
    es: {
      name: 'Consejero delegado',
      blurb: 'Un consejero en quien el consejo ha delegado sus facultades. Es una delegación sobre un puesto en el consejo, no un puesto distinto: cuando el registro cesa sólo la delegación, la persona sigue siendo consejera.',
    },
    en: {
      name: 'Consejero delegado (managing director)',
      blurb: 'A director to whom the board has delegated its powers. It is a delegation layered on a board seat, not a separate seat: when the registry ceases only the delegation, the person remains a director.',
    },
  },
  {
    id: 'presidencia',
    directorship: 'yes',
    codes: ['PRESIDENTE', 'PRE.NO.EJEC.', 'VICEPRESID.'],
    es: {
      name: 'Presidente y vicepresidente',
      blurb: 'La presidencia del órgano de administración. Presidente no ejecutivo sigue siendo consejero: "no ejecutivo" describe cómo ejerce el cargo, no lo niega.',
    },
    en: {
      name: 'Chair and deputy chair',
      blurb: 'The chair of the governing body. A non-executive chair is still a director — "non-executive" describes how the office is held, it does not deny it.',
    },
  },
  {
    id: 'vocal',
    directorship: 'yes',
    codes: ['VOCAL', 'VOCAL 3', 'VOC.1'],
    es: {
      name: 'Vocal',
      blurb: 'Un vocal sin órgano nombrado es un consejero sin cargo especial. Cuando la abreviatura sí nombra un órgano (VOC1.CON.REC), lo clasificamos por ese órgano.',
    },
    en: {
      name: 'Vocal (ordinary board member)',
      blurb: 'A vocal naming no organ is a director holding no special office. Where the abbreviation does name an organ (VOC1.CON.REC), we classify it by that organ instead.',
    },
  },
  {
    id: 'organo-de-gobierno',
    directorship: 'yes',
    codes: ['PRE.CONS.REC', 'VOC1.CON.REC', 'V-PRE.JTA.DI', 'VSEC.J.DIR.'],
    es: {
      name: 'Consejo rector, junta directiva',
      blurb: 'El órgano de gobierno de cooperativas, asociaciones y mutualidades. Un asiento en él ES el cargo de administración, igual que un consejo de administración.',
    },
    en: {
      name: 'Governing council, executive board',
      blurb: 'The governing body of cooperatives, associations and mutual societies. A seat on one IS the directorship, exactly as a board seat is.',
    },
  },

  // --- Committees OF the board ------------------------------------------
  {
    id: 'comision-auditoria',
    directorship: 'yes',
    codes: ['MBRO.COM.AUD', 'PRECOMAUDIT', 'COM.AUD.CTRL'],
    es: {
      name: 'Comisión de auditoría',
      blurb: 'Comisión del consejo. La ley reserva su composición a consejeros no ejecutivos, así que el asiento acredita por sí mismo la condición de consejero. "Auditoría y control" y "auditoría y cumplimiento" son esta comisión, no una comisión de control.',
    },
    en: {
      name: 'Audit committee',
      blurb: 'A committee of the board. The law reserves its membership to non-executive directors, so the seat is itself evidence of a directorship. "Auditoría y control" and "auditoría y cumplimiento" are this committee, not a comisión de control.',
    },
  },
  {
    id: 'comision-nombramientos',
    directorship: 'yes',
    codes: ['M.COM.NOM.RE', 'PRESCOMNOMRE', 'VICSEC.C.RET'],
    es: {
      name: 'Comisión de nombramientos y retribuciones',
      blurb: 'Comisión del consejo, también de composición reservada a consejeros no ejecutivos.',
    },
    en: {
      name: 'Nominations and remuneration committee',
      blurb: 'A committee of the board, its membership likewise reserved to non-executive directors.',
    },
  },
  {
    id: 'otras-comisiones-consejo',
    directorship: 'yes',
    codes: ['PTE.C.EJ', 'MMBR.COM.DEL', 'PRE.C.RIESGO', 'PRE.COM.SCI'],
    es: {
      name: 'Ejecutiva, delegada, riesgos y otras comisiones del consejo',
      blurb: 'Comisiones internas del consejo. Sólo promovemos una comisión a este grupo cuando podemos identificarla; las demás se quedan fuera (véase más abajo).',
    },
    en: {
      name: 'Executive, delegated, risk and other board committees',
      blurb: 'Internal committees of the board. A committee joins this group only when we can identify it; the rest stay out (see below).',
    },
  },

  // --- Organs that look board-like and are not --------------------------
  {
    id: 'comision-control',
    directorship: 'never',
    codes: ['M.COM.CONTROL', 'VICEPRESIDENTA DE LA COMISION DE CONTROL'],
    es: {
      name: 'Comisión de control',
      blurb: 'Órgano supervisor de fondos de pensiones y cooperativas de crédito, elegido por la asamblea y expresamente ajeno al consejo. Son 26.511 asientos en el corpus y nunca confieren la condición de administrador.',
    },
    en: {
      name: 'Comisión de control (supervisory committee)',
      blurb: 'The supervisory organ of pension funds and credit cooperatives, elected by the assembly and expressly not part of the board. 26,511 seats in the corpus, and never a directorship.',
    },
  },
  {
    id: 'comision-liquidadora',
    directorship: 'never',
    codes: ['M.COM.LIQUID', 'COMS.ACREED.'],
    es: {
      name: 'Comisión liquidadora y de acreedores',
      blurb: 'La primera liquida la sociedad; la segunda representa a los acreedores en un concurso. Ninguna es gobierno corporativo.',
    },
    en: {
      name: 'Liquidation and creditors’ committees',
      blurb: 'The first winds the company up; the second represents creditors in an insolvency. Neither is corporate governance.',
    },
  },
  {
    id: 'no-consejero',
    directorship: 'never',
    codes: ['SECRENOCONSJ', 'S.NO CONS.GO', 'SECNOCONCOMD'],
    es: {
      name: 'Cargos expresamente "no consejero"',
      blurb: 'El registro a veces dice explícitamente que quien ocupa el puesto no es consejero. Conservamos el órgano y respetamos la negación.',
    },
    en: {
      name: 'Seats marked expressly "not a director"',
      blurb: 'The registry sometimes states outright that the holder is not a director. We keep the organ and honour the denial.',
    },
  },

  // --- Real roles that are not board seats ------------------------------
  {
    id: 'apoderado',
    directorship: 'no',
    codes: ['APODERADO', 'APO.SOL.', 'APO.MANC.'],
    es: {
      name: 'Apoderado',
      blurb: 'Un poder de representación, no un cargo orgánico. Es la confusión más frecuente al leer un registro español desde fuera: un apoderado no es administrador.',
    },
    en: {
      name: 'Apoderado (attorney-in-fact)',
      blurb: 'A power of attorney, not an organic office. This is the most common misreading of a Spanish registry from abroad: an apoderado is not a director.',
    },
  },
  {
    id: 'secretario',
    directorship: 'no',
    codes: ['SECRETARIO', 'VICESECRET.'],
    es: {
      name: 'Secretario y vicesecretario',
      blurb: 'El secretario del consejo puede ser o no consejero; el registro lo dice cuando importa. Por eso no lo contamos como administrador salvo que otro asiento lo acredite.',
    },
    en: {
      name: 'Secretary and deputy secretary',
      blurb: 'A board secretary may or may not be a director, and the registry says so when it matters. We therefore do not count the office as a directorship unless another seat establishes one.',
    },
  },
  {
    id: 'liquidador',
    directorship: 'no',
    codes: ['LIQUIDADOR', 'LIQUID.MANC.', 'LIQUISOLI'],
    es: {
      name: 'Liquidador',
      blurb: 'Quien liquida una sociedad disuelta. En una sociedad en liquidación es la única persona con autoridad sobre ella, por lo que la ficha de empresa lo muestra junto al órgano de administración.',
    },
    en: {
      name: 'Liquidator',
      blurb: 'The person winding up a dissolved company. In a company in liquidation they are the only person with authority over it, so the company page shows them alongside the governing body.',
    },
  },
  {
    id: 'auditor',
    directorship: 'no',
    codes: ['AUDITOR', 'AUD.SUPL.', 'AUD.C.CON.'],
    es: {
      name: 'Auditor',
      blurb: 'Auditor de cuentas, titular o suplente, y auditor de cuentas consolidadas. Externo a la sociedad por definición.',
    },
    en: {
      name: 'Auditor',
      blurb: 'The statutory auditor, principal or alternate, and the consolidated-accounts auditor. External to the company by definition.',
    },
  },
  {
    id: 'representante-143',
    directorship: 'yes',
    codes: ['REPR.143 RRM'],
    es: {
      name: 'Representante (art. 143 RRM)',
      blurb: 'La persona física que ejerce el cargo cuando el administrador es una sociedad. Es un nombramiento orgánico, no un poder, y por eso aparece en el órgano de administración.',
    },
    en: {
      name: 'Permanent representative (art. 143 RRM)',
      blurb: 'The natural person exercising the office when the director is itself a company. An organic appointment rather than a power of attorney, which is why it appears on the governing body.',
    },
  },
  {
    id: 'direccion',
    directorship: 'no',
    codes: ['DIR. GENERAL', 'D. GERENTE'],
    es: {
      name: 'Dirección general',
      blurb: 'Alta dirección. Un director general puede ser además consejero, pero el cargo en sí no lo convierte en administrador.',
    },
    en: {
      name: 'Senior management',
      blurb: 'Executive management. A director general may also sit on the board, but the office alone does not make them a director.',
    },
  },
];

// Committees we deliberately do not name. Shown on the page so the gap is
// visible rather than papered over: roughly 200 of the 543 organ codes name
// ad-hoc committees whose meaning cannot be read off the abbreviation and for
// which we have no primary source.
export const UNNAMED_COMMITTEE_EXAMPLES = ['PRE.COM.FVS', 'COM.GERENCIA', 'MIEM.COM.FIN', 'MBRO.COM.CRT'];
