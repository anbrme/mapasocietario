import { isBoardPosition, positionCategoryFor, BOARD_CATEGORIES } from './positionCategories.js';

function normName(name) {
  return (name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
}

export function buildGraph(company, { maxOfficers = 40 } = {}) {
  const center = { id: company.groupKey, label: company.name, type: 'company' };
  // BORME inscribes an extinción without ceasing each seat one by one, so a
  // dissolved company's doc still lists them under officers_active. They ended
  // WITH the company and must never read as the current board — the same rule
  // the web app applies (functions/empresa/_lib.js).
  const seatsAtDissolution = company.status === 'dissolved' || company.status === 'disuelta';

  // First pass: collect all seats per person, tracking which have board positions.
  // boardSeats: normName -> { label, bestStatus, role, date }
  // nonBoardOnly: set of normNames who have seats but no board seat
  const boardSeats = new Map(); // normName -> { label, status, role, date, board }
  const allSeen = new Set();    // every normName encountered

  const addSeat = (o, status) => {
    const key = normName(o.name);
    if (!key) return;
    allSeen.add(key);
    if (!isBoardPosition(o.position)) return; // skip non-board seats for board map

    const existing = boardSeats.get(key);
    const board = BOARD_CATEGORIES.has(positionCategoryFor(o.position));
    const date = status === 'active' ? o.appointedDate : o.resignedDate;
    if (!existing) {
      boardSeats.set(key, { label: o.name, status, role: o.position || '', date: date || null, board });
    } else if (status === 'active' && existing.status !== 'active') {
      boardSeats.set(key, { label: existing.label, status: 'active', role: o.position || existing.role,
        date: date || existing.date, board: existing.board || board });
    } else {
      existing.board = existing.board || board;
    }
  };

  (company.officersActive || []).forEach((o) => addSeat(o, 'active'));
  (company.officersResigned || []).forEach((o) => addSeat(o, 'ceased'));

  // hiddenNonBoard: distinct people who appeared but have NO board seat
  const hiddenNonBoard = [...allSeen].filter((key) => !boardSeats.has(key)).length;

  // Order: active first, then board roles, then the rest; cap.
  const ordered = [...boardSeats.entries()].sort(([, a], [, b]) => {
    if ((b.status === 'active') - (a.status === 'active')) return (b.status === 'active') - (a.status === 'active');
    return (b.board === true) - (a.board === true);
  }).slice(0, maxOfficers);

  const nodes = [center];
  const links = [];
  for (const [key, p] of ordered) {
    if (p.status !== 'active') continue; // only seats still open on the record
    const id = `officer:${key}`;
    const status = seatsAtDissolution ? 'at_dissolution' : 'active';
    nodes.push({ id, label: p.label, type: 'officer', status });
    links.push({ source: center.id, target: id, status, role: p.role, date: p.date });
  }
  return { nodes, links, hiddenNonBoard, seatsAtDissolution };
}
