// GA4 parameters that describe a situation report at the moment it is opened,
// copied, previewed, downloaded or switched to the other language. Every key
// here is a REGISTERED custom definition (scripts/ga4-custom-definitions.mjs):
// language / mode / has_author are dimensions, steps / companies / notes /
// blocks_off are metrics. Sending a value under an unregistered name is a
// permanent hole, so add to the script first, then here.
//
// Content never travels: counts only, never the summary text, the author's
// name or a company name.

const hasText = note => Boolean(String(note?.text || '').trim());

const countNotes = doc => {
  const summary = String(doc?.networkNote || '').trim() ? 1 : 0;
  const onCompanies = (doc?.companies || []).filter(c => hasText(c.note)).length;
  const onConnectors = (doc?.connectors || []).filter(c => hasText(c.note)).length;
  const others = (doc?.otherNotes || []).filter(hasText).length;
  const onSteps = (doc?.steps || []).filter(s => hasText(s.narrative) || hasText(s.authorNote)).length;
  return summary + onCompanies + onConnectors + others + onSteps;
};

export function situationReportParams(doc, reportLang) {
  const author = doc?.author;
  return {
    language: reportLang === 'en' ? 'en' : 'es',
    mode: doc?.mode === 'selection' ? 'selection' : 'draft',
    steps: (doc?.steps || []).length,
    companies: (doc?.companies || []).length,
    notes: countNotes(doc),
    has_author: Boolean(author && (String(author.name || '').trim() || String(author.organisation || '').trim())),
    blocks_off: Object.values(doc?.blocks || {}).filter(v => v === false).length,
  };
}
