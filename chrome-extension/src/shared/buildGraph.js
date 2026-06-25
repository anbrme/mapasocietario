const BOARD_ROLES = ['consejero', 'administrador', 'presidente', 'secretario',
  'vicepresidente', 'consejero delegado', 'liquidador'];

function isBoardRole(position) {
  const p = (position || '').toLowerCase();
  return BOARD_ROLES.some((r) => p.includes(r));
}

function normName(name) {
  return (name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
}

export function buildGraph(company, { maxOfficers = 40 } = {}) {
  const center = { id: company.groupKey, label: company.name, type: 'company' };

  // Merge by person; an active seat wins over a ceased one.
  const people = new Map(); // normName -> { label, status, role, date, board }
  const add = (o, status) => {
    const key = normName(o.name);
    if (!key) return;
    const existing = people.get(key);
    const board = isBoardRole(o.position);
    const date = status === 'active' ? o.appointedDate : o.resignedDate;
    if (!existing) {
      people.set(key, { label: o.name, status, role: o.position || '', date: date || null, board });
    } else if (status === 'active' && existing.status !== 'active') {
      people.set(key, { label: existing.label, status: 'active', role: o.position || existing.role,
        date: date || existing.date, board: existing.board || board });
    } else {
      existing.board = existing.board || board;
    }
  };
  (company.officersActive || []).forEach((o) => add(o, 'active'));
  (company.officersResigned || []).forEach((o) => add(o, 'ceased'));

  // Order: active first, then board roles, then the rest; cap.
  const ordered = [...people.entries()].sort(([, a], [, b]) => {
    if ((b.status === 'active') - (a.status === 'active')) return (b.status === 'active') - (a.status === 'active');
    return (b.board === true) - (a.board === true);
  }).slice(0, maxOfficers);

  const nodes = [center];
  const links = [];
  for (const [key, p] of ordered) {
    const id = `officer:${key}`;
    nodes.push({ id, label: p.label, type: 'officer' });
    links.push({ source: center.id, target: id, status: p.status, role: p.role, date: p.date });
  }
  return { nodes, links };
}
