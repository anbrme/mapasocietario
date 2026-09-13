const nid = id => (id == null ? '' : String(id));

/** Order-independent key for a graph edge between two node ids. */
export const pairKey = (a, b) => (nid(a) < nid(b) ? `${nid(a)}|${nid(b)}` : `${nid(b)}|${nid(a)}`);
