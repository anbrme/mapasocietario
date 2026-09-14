import { describe, expect, it } from 'vitest';
import { situationReportParams } from './sitrepAnalytics';

const doc = {
  networkNote: 'Two of the three share a director.',
  companies: [{ nodeId: 'c1', note: { text: 'holding' } }, { nodeId: 'c2', note: null }, { nodeId: 'c3' }],
  connectors: [{ nodeId: 'p1', note: { text: 'also at Acme' } }],
  otherNotes: [{ nodeId: 'p9', text: '' }],
  steps: [
    { key: 's1', narrative: { text: 'the pivot' } },
    { key: 's2', authorNote: { text: '' } },
    { key: 's3' },
  ],
  author: { name: 'A. Analyst', organisation: '' },
  blocks: { identity: true, board: false, filings: true, findings: false },
  mode: 'selection',
  counts: { companies: 3, officers: 12, sharedPeople: 1, notes: 2, flagged: 0 },
};

describe('situationReportParams', () => {
  it('describes the report with registered GA4 parameter names', () => {
    expect(situationReportParams(doc, 'en')).toEqual({
      language: 'en',
      mode: 'selection',
      steps: 3,
      companies: 3,
      notes: 4, // summary + 1 company + 1 connector + 1 step narrative
      has_author: true,
      blocks_off: 2,
    });
  });

  it('counts nothing as authored when the report is untouched', () => {
    const untouched = {
      networkNote: '', companies: [{ nodeId: 'c1' }], connectors: [], otherNotes: [], steps: [],
      author: null, blocks: { identity: true, board: true, filings: true, findings: true }, mode: 'draft',
      counts: { companies: 1 },
    };
    expect(situationReportParams(untouched, 'es')).toEqual({
      language: 'es', mode: 'draft', steps: 0, companies: 1, notes: 0, has_author: false, blocks_off: 0,
    });
  });

  it('survives a missing document and an unknown language', () => {
    expect(situationReportParams(null, undefined)).toEqual({
      language: 'es', mode: 'draft', steps: 0, companies: 0, notes: 0, has_author: false, blocks_off: 0,
    });
    expect(situationReportParams({}, 'fr').language).toBe('es');
  });
});
