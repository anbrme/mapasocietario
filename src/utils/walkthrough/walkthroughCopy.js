// Strings for the drafted walkthrough. The registry sentences NEVER come from
// here — they are the findings endpoint's own text. This file covers only what
// the graph itself can say (structure) and the chrome around it.

const joinNames = (names, and) => {
  const list = (names || []).filter(Boolean);
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} ${and} ${list[list.length - 1]}`;
};

const ES = {
  button: 'Recorrido',
  preparing: 'Preparando…',
  tooltip: 'Recorre esta red paso a paso: registro, conexiones y tus notas',
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
};

const EN = {
  button: 'Walkthrough',
  preparing: 'Preparing…',
  tooltip: 'Step through this network: registry, connections and your notes',
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
};

export const walkthroughCopy = lang => (lang === 'en' ? EN : ES);

export const connectorSentence = (t, { name, status, roles, companies }) => {
  const verb = t.status[status] || t.status.active;
  const roleList = (roles || []).filter(Boolean).join(', ');
  return `${name} ${verb} ${roleList} ${t.at} ${joinNames(companies, t.and)}`;
};

export const ownershipSentence = (t, { owner, owned, lost }) => (
  `${owner} ${lost ? t.lostOf : t.soleOf} ${owned}`
);

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
