// Strings for the drafted walkthrough. The registry sentences NEVER come from
// here — they are the findings endpoint's own text. This file covers only what
// the graph itself can say (structure) and the chrome around it.

const ES = {
  sections: {
    subject: 'Sujeto',
    stands_out: 'Lo que destaca',
    connects: 'Quién conecta',
    ownership: 'Propiedad',
    other_companies: 'Otras empresas',
    unseen: 'Lo que el registro no muestra',
    author: 'Notas del autor',
  },
  sources: { registry: 'Registro (BORME)', graph: 'Del mapa', author: 'Autor' },
  noteField: 'Tu nota',
  hideStep: 'Quitar del recorrido',
  reset: 'Restablecer borrador',
  preview: 'Vista previa',
  edit: 'Editar',
  prev: 'Anterior',
  next: 'Siguiente',
  exit: 'Salir',
  evidence: 'Ver evidencia',
  moveUp: 'Subir',
  moveDown: 'Bajar',
  authorField: 'Autor',
  organisationField: 'Organización',
  status: { active: 'ocupa', ceased: 'ocupó', mixed: 'ocupa y ocupó' },
  at: 'en',
  and: 'y',
  soleOf: 'es socio único de',
  lostOf: 'fue socio único de',
  officersVisible: n => `${n} cargo${n === 1 ? '' : 's'} visible${n === 1 ? '' : 's'} en el mapa`,
  identity: {
    nif: v => `NIF ${v}`, registry: v => `Hoja ${v}`, formerly: v => `antes ${v}`,
    lastFiling: (d, ty) => `último acto BORME ${d}${ty ? `, ${ty}` : ''}`,
  },
  resetConfirm: (h, n) => `¿Descartar ${h} paso${h === 1 ? '' : 's'} oculto${h === 1 ? '' : 's'} y ${n} nota${n === 1 ? '' : 's'} y regenerar el borrador?`,
  opening: n => `Recorrido por esta red · ${n} paso${n === 1 ? '' : 's'}`,
  openingSelection: 'Tu selección, en el orden elegido',
  openingDraft: 'Borrador generado: empresas, conexiones y tus notas',
  openingCapped: (n, cap = 12) => `Se muestran los ${cap} primeros de ${n} seleccionados`,
  kinds: { company: 'Empresa', person: 'Persona', note: 'Nota', unified: 'Empresa y cargo', connection: 'Conexión' },
  connectionLine: (ends, via, hops) => `${ends} se conectan a través de ${via} · ${hops} paso${hops === 1 ? '' : 's'}`,
  suggestionsTitle: 'Conexiones detectadas',
  suggestionsHelp: 'Entidades seleccionadas que solo se conectan a través de nodos no seleccionados. Añádelas como paso para contar el camino.',
  addStep: 'Añadir al recorrido',
  hopColumns: {
    who: 'Quién', at: 'En', role: 'Cargo', status: 'Estado', since: 'Desde', until: 'Hasta', origin: 'Origen',
  },
  hopAuthorNote: n => (n === 1
    ? 'un enlace de esta ruta fue añadido por el autor'
    : `${n} enlaces de esta ruta fueron añadidos por el autor`),
  playOnMap: 'Ver en el mapa',
  editInReport: 'Editar en el informe',
  selectionHelp: mod => `Tu selección. Añade o quita nodos con ${mod}+clic en el mapa, o quítalos aquí con el ojo.`,
  draftHelp: 'Borrador generado a partir del mapa. El ojo quita un paso; el borrador vuelve con Restablecer.',
  hint: mod => `Selecciona nodos con ${mod}+clic (Ctrl+clic en Windows/Linux) para elegir los pasos. Sin selección, se genera un borrador.`,
  blocks: { identity: 'Identidad', board: 'Órgano de administración', filings: 'Últimos actos', findings: 'Lo que destaca' },
  subheads: { board: 'Órgano de administración', proxies: 'Apoderados', filings: 'Últimos actos', findings: 'Lo que destaca', unseen: 'Lo que el registro no muestra', seats: 'Cargos en las empresas del mapa' },
  ceasedFold: n => `Cesados (${n})`,
  proxiesFold: n => `Apoderados (${n})`,
  onMapLine: (x, y) => `En el mapa: ${x} de ${y} cargos`,
  openPreview: 'Abrir vista previa',
  seatColumns: { company: 'Empresa', role: 'Cargo', since: 'Desde', until: 'Hasta', status: 'Estado' },
  boardColumns: { name: 'Nombre', role: 'Cargo', since: 'Desde', until: 'Hasta', status: 'Estado' },
  filingColumns: { date: 'Fecha', type: 'Acto' },
  statusWords: { active: 'Vigente', ceased: 'Cesado', dissolved: 'Disuelta', concurso: 'En concurso' },
  capitalLabel: 'Capital social',
  activityLabel: 'Actividad declarada',
  momentLabel: 'Momento',
  // Where a preselected date comes from. A chapter's date used to arrive with
  // no explanation; these are the labels that say what it refers to.
  momentKinds: {
    appointed: (role, where) => `Nombramiento${role ? ` · ${role}` : ''}${where ? ` en ${where}` : ''}`,
    ceased: (role, where) => `Cese${role ? ` · ${role}` : ''}${where ? ` en ${where}` : ''}`,
    boardAppointed: (role, who) => `Nombramiento${role ? ` · ${role}` : ''}${who ? `: ${who}` : ''}`,
    boardCeased: (role, who) => `Cese${role ? ` · ${role}` : ''}${who ? `: ${who}` : ''}`,
    lastFiling: type => `Último acto BORME${type ? ` · ${type}` : ''}`,
    filing: type => `Acto BORME${type ? ` · ${type}` : ''}`,
    finding: text => `Lo que destaca${text ? ` · ${text}` : ''}`,
  },
  momentPick: 'Fecha del registro',
  momentCustom: 'Otra fecha',
  momentNone: 'Sin fecha',
  momentHelp: 'La fecha ancla el capítulo en la cronología y sitúa el mapa ese día.',
  momentWhyDraft: label => `Preseleccionada: ${label}. Cámbiala si tu nota habla de otro momento.`,
  momentWhyAuthor: label => `Elegida por ti: ${label}.`,
  momentWhyAuthorOnly: 'Elegida por ti; no corresponde a ningún acto del registro de este capítulo.',
  momentUnset: 'Sin fecha: el capítulo no entra en la cronología.',
  // Dated notes: one date per note, because a chapter's single Momento cannot
  // carry an argument that runs across several registry dates.
  datedNotes: 'Notas fechadas',
  datedNotesHelp: 'Una nota por fecha. Cada una aparece en la cronología del informe con su día.',
  addDatedNote: 'Añadir nota fechada',
  removeDatedNote: 'Quitar esta nota',
  datedNoteDate: 'Fecha',
  datedNoteText: 'Qué ocurre en esa fecha',
  datedNotesFull: n => `Máximo ${n} notas fechadas por capítulo.`,
  seatsLine: (k, m) => `${k} cargo${k === 1 ? '' : 's'} en ${m} empresa${m === 1 ? '' : 's'}`,
  previewBlocked: 'El navegador bloqueó la pestaña; permite ventanas emergentes para la vista previa.',
};

const EN = {
  sections: {
    subject: 'Subject',
    stands_out: 'What stands out',
    connects: 'Who connects',
    ownership: 'Ownership',
    other_companies: 'Other companies',
    unseen: 'What the registry cannot show',
    author: "Author's notes",
  },
  sources: { registry: 'Registry (BORME)', graph: 'From the map', author: 'Author' },
  noteField: 'Your note',
  hideStep: 'Remove from walkthrough',
  reset: 'Reset draft',
  preview: 'Preview',
  edit: 'Edit',
  prev: 'Previous',
  next: 'Next',
  exit: 'Exit',
  evidence: 'See evidence',
  moveUp: 'Move up',
  moveDown: 'Move down',
  authorField: 'Author',
  organisationField: 'Organisation',
  status: { active: 'holds', ceased: 'held', mixed: 'holds and held' },
  at: 'at',
  and: 'and',
  soleOf: 'is sole shareholder of',
  lostOf: 'was sole shareholder of',
  officersVisible: n => `${n} officer${n === 1 ? '' : 's'} visible on the map`,
  identity: {
    nif: v => `NIF ${v}`, registry: v => `Sheet ${v}`, formerly: v => `formerly ${v}`,
    lastFiling: (d, ty) => `last BORME filing ${d}${ty ? `, ${ty}` : ''}`,
  },
  resetConfirm: (h, n) => `Discard ${h} hidden step${h === 1 ? '' : 's'} and ${n} note${n === 1 ? '' : 's'} and rebuild the draft?`,
  opening: n => `Walkthrough of this network · ${n} step${n === 1 ? '' : 's'}`,
  openingSelection: 'Your selection, in the order you chose',
  openingDraft: 'Generated draft: companies, connections and your notes',
  openingCapped: (n, cap = 12) => `Showing the first ${cap} of ${n} selected`,
  kinds: { company: 'Company', person: 'Person', note: 'Note', unified: 'Company and officer', connection: 'Connection' },
  connectionLine: (ends, via, hops) => `${ends} connect through ${via} · ${hops} hop${hops === 1 ? '' : 's'}`,
  suggestionsTitle: 'Connections found',
  suggestionsHelp: 'Selected entities that only connect through nodes you did not select. Add one as a step to tell the path.',
  addStep: 'Add to walkthrough',
  hopColumns: {
    who: 'Who', at: 'At', role: 'Role', status: 'Status', since: 'Since', until: 'Until', origin: 'Origin',
  },
  hopAuthorNote: n => (n === 1
    ? 'one link in this path was added by the author'
    : `${n} links in this path were added by the author`),
  playOnMap: 'Play on the map',
  editInReport: 'Edit in the report',
  selectionHelp: mod => `Your selection. Add or remove nodes with ${mod}+click on the map, or remove them here with the eye.`,
  draftHelp: 'Draft generated from the map. The eye removes a step; Reset brings the draft back.',
  hint: mod => `Select nodes with ${mod}+click (Ctrl+click on Windows/Linux) to choose the steps. With no selection, a draft is generated.`,
  blocks: { identity: 'Identity', board: 'Governing body', filings: 'Latest filings', findings: 'What stands out' },
  subheads: { board: 'Governing body', proxies: 'Powers of attorney', filings: 'Latest filings', findings: 'What stands out', unseen: 'What the registry cannot show', seats: 'Seats across the companies on the map' },
  ceasedFold: n => `Ceased (${n})`,
  proxiesFold: n => `Powers of attorney (${n})`,
  onMapLine: (x, y) => `On the map: ${x} of ${y} seats`,
  openPreview: 'Open preview',
  seatColumns: { company: 'Company', role: 'Role', since: 'Since', until: 'Until', status: 'Status' },
  boardColumns: { name: 'Name', role: 'Role', since: 'Since', until: 'Until', status: 'Status' },
  filingColumns: { date: 'Date', type: 'Filing' },
  statusWords: { active: 'Active', ceased: 'Ceased', dissolved: 'Dissolved', concurso: 'In insolvency' },
  capitalLabel: 'Share capital',
  activityLabel: 'Declared activity',
  momentLabel: 'Moment',
  momentKinds: {
    appointed: (role, where) => `Appointed${role ? ` · ${role}` : ''}${where ? ` at ${where}` : ''}`,
    ceased: (role, where) => `Ceased${role ? ` · ${role}` : ''}${where ? ` at ${where}` : ''}`,
    boardAppointed: (role, who) => `Appointed${role ? ` · ${role}` : ''}${who ? `: ${who}` : ''}`,
    boardCeased: (role, who) => `Ceased${role ? ` · ${role}` : ''}${who ? `: ${who}` : ''}`,
    lastFiling: type => `Last BORME filing${type ? ` · ${type}` : ''}`,
    filing: type => `BORME filing${type ? ` · ${type}` : ''}`,
    finding: text => `What stands out${text ? ` · ${text}` : ''}`,
  },
  momentPick: 'Registry date',
  momentCustom: 'Other date',
  momentNone: 'No date',
  momentHelp: 'The date anchors the chapter in the chronology and dates the map to that day.',
  momentWhyDraft: label => `Preselected: ${label}. Change it if your note is about another moment.`,
  momentWhyAuthor: label => `Your choice: ${label}.`,
  momentWhyAuthorOnly: 'Your own date; it matches no registry filing in this chapter.',
  momentUnset: 'No date: the chapter stays out of the chronology.',
  datedNotes: 'Dated notes',
  datedNotesHelp: 'One note per date. Each appears in the report chronology on its own day.',
  addDatedNote: 'Add dated note',
  removeDatedNote: 'Remove this note',
  datedNoteDate: 'Date',
  datedNoteText: 'What happens on that date',
  datedNotesFull: n => `At most ${n} dated notes per chapter.`,
  seatsLine: (k, m) => `${k} seat${k === 1 ? '' : 's'} across ${m} compan${m === 1 ? 'y' : 'ies'}`,
  previewBlocked: 'The browser blocked the tab; allow pop-ups to open the preview.',
};

export const platformModifier = nav => {
  const p = String(nav?.userAgentData?.platform || nav?.platform || '');
  return /mac|iphone|ipad/i.test(p) ? '⌘' : 'Ctrl';
};

export const walkthroughCopy = lang => (lang === 'en' ? EN : ES);

// The eyebrow for a step: a unified company step (a company that also holds
// seats) reads as both; otherwise the entity kind, or the v1 section name.
export const stepKindLabel = (step, t) => {
  if (step?.kind === 'company' && step?.unified) return t.kinds.unified;
  return t.kinds?.[step?.kind] || t.sections?.[step?.section] || '';
};

export const graphOnlyLine = (t, officerCount) => t.officersVisible(officerCount);

export const identityLine = (t, header) => {
  const h = header || {};
  const parts = [
    h.nif ? t.identity.nif(h.nif) : '',
    h.province || '',
    h.registry ? t.identity.registry(h.registry) : '',
    (h.previous_names || []).length ? t.identity.formerly(h.previous_names.join(', ')) : '',
    h.last_filing?.date ? t.identity.lastFiling(h.last_filing.date, h.last_filing.type || '') : '',
  ].filter(Boolean);
  return parts.join(' · ');
};
