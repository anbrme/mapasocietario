// Fetch findings for the subject companies, capped and time-boxed, so the
// walkthrough can start with whatever arrived and never reorder mid-play.
import { FINDINGS_FETCH_CAP } from './draftWalkthrough';

export const FINDINGS_WAIT_MS = 4000;

export async function loadFindingsForSubjects({
  subjectIds, nodesById, fetchFindings, lang,
  cap = FINDINGS_FETCH_CAP, waitMs = FINDINGS_WAIT_MS, setTimeoutFn = setTimeout,
}) {
  const ids = (subjectIds || []).slice(0, cap);
  const results = new Map((subjectIds || []).map(id => [id, null]));

  const settle = ids.map(id => {
    const node = nodesById.get(id);
    if (!node) return Promise.resolve();
    return Promise.resolve()
      .then(() => fetchFindings({ groupKey: node.groupKey || null, name: node.name || '', lang }))
      .then(payload => { results.set(id, payload ?? null); })
      .catch(() => { results.set(id, null); });
  });

  const timeout = new Promise(resolve => { setTimeoutFn(resolve, waitMs); });
  await Promise.race([Promise.all(settle), timeout]);
  return new Map(results);
}
