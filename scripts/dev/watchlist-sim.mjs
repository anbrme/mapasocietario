// Watchlist simulation harness.
//
// A real watchlist changes every few weeks, so the "something moved" state is
// unobservable during development. This serves a canned /alerts/view with
// events at chosen ages and forwards everything else to the real API, so the
// changed state can be looked at on demand.
//
//   node wl-sim.mjs            # a set with three changed companies
//   node wl-sim.mjs quiet      # the same set with nothing new
import http from 'node:http';

const QUIET = process.argv[2] === 'quiet';
const days = (n) => new Date(Date.now() - n * 864e5).toISOString();

// Last visit was 10 days ago; anything detected after that is "new".
const LAST_VIEWED = days(10);

const ev = (n, title, detectedDaysAgo) =>
  Array.from({ length: n }, (_, i) => ({
    id: Math.random(), source: 'borme', event_type: 'officer_appointment',
    title, occurred_at: days(detectedDaysAgo + 1),
    detected_at: days(detectedDaysAgo), severity: 'medium', read: false,
  }));

// REAL group_keys and REAL names, both taken from the live directory. Invented
// ones made the first run of this simulation lie: the keys matched nothing, so
// only one marker drew and the harness looked like a product bug. A fixture
// that is not real does not simulate anything. Note the comma in GUADALAGUA —
// the exact shape that breaks name matching, which is why it is in the set.
const MEMBERS = [
  ['SACYR AGUA SL',                 'H:M-396167', QUIET ? 0 : 3],
  ['SACYR AGUA PARTICIPADAS II SL', 'H:M-833752', QUIET ? 0 : 1],
  ['SACYR GUADALAGUA, SL',          'H:GU-11456', QUIET ? 0 : 11],
  ['SACYR CONCESIONES SL',          'H:M-471022', 0],
];

const STUB = {
  success: true,
  watchlists: [{ id: 5, label: 'Proveedores', active: true,
                 created_at: days(60), last_viewed_at: LAST_VIEWED }],
  alerts: MEMBERS.map(([name, gk, changed], i) => ({
    id: 100 + i, entity_name: name, group_key: gk, active: true, watchlist_id: 5,
    // Old events too, to prove the count is "since last visit", not "ever".
    events: [...ev(changed, 'Nombramiento de administrador', 2),
             ...ev(2, 'Cambio de domicilio social', 40)],
  })),
};

http.createServer(async (req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*',
                 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (req.url.startsWith('/bormes/v3/alerts/view')) {
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(STUB));
  }
  try {
    const up = await fetch('https://api.ncdata.eu' + req.url, { method: req.method });
    const body = Buffer.from(await up.arrayBuffer());
    res.writeHead(up.status, { ...cors, 'Content-Type': up.headers.get('content-type') || 'application/json' });
    res.end(body);
  } catch { res.writeHead(502, cors); res.end('{}'); }
}).listen(8099, () => console.log(QUIET ? 'sim: QUIET set' : 'sim: 3 changed companies'));
