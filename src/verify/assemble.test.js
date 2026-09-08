import { describe, it, expect } from 'vitest';
import { identitySnapshot, assembleDraft } from './assemble.js';

const COMPANY = {
  company_name: 'NURNBERG CONSULTING SL', current_address: 'C/ ARZOBISPO COS 10, BAJO (MADRID)',
  is_in_concurso: false, is_dissolved: false, enriched_nif: 'B86829538',
  hojas: ['M-566914'],
  officers_active: [{ name: 'NURNBERG ALESSANDRO', position_normalized: 'ADM. UNICO' }],
};
const SEAT = { name: 'NURNBERG ALESSANDRO', position: 'ADM. UNICO', appointed_date: '2013-10-16' };
const BASE = {
  subjectId: 'sub_1', groupKey: 'H:M-566914', company: COMPANY, seat: SEAT,
  representationBasis: 'sole_admin',
  consents: { authority: true, publication: true, reconfirmation: true },
  nonce: 'n-1', draftedAt: '2026-09-08T10:00:00Z',
};

describe('identitySnapshot', () => {
  it('captures the registry identity as of drafting', () => {
    expect(identitySnapshot({ subjectId: 'sub_1', groupKey: 'H:M-566914', company: COMPANY }))
      .toEqual({ subject_id: 'sub_1', group_key: 'H:M-566914', nif: 'B86829538',
                 hoja: 'M-566914', canonical_name: 'NURNBERG CONSULTING SL' });
  });
});

describe('assembleDraft', () => {
  it('is deterministic for the same inputs', async () => {
    const a = await assembleDraft(BASE);
    const b = await assembleDraft(BASE);
    expect(a.hash).toBe(b.hash);
  });

  it('produces a DIFFERENT hash when the registry moved', async () => {
    const moved = { ...BASE, company: { ...COMPANY, current_address: 'C/ NUEVA 5' } };
    expect((await assembleDraft(moved)).hash).not.toBe((await assembleDraft(BASE)).hash);
  });

  it('carries declared edits through and keeps the registry value beside them', async () => {
    const { facts } = await assembleDraft({ ...BASE, declaredFacts:
      [{ fact_key: 'address', declared_status: 'corrected', declared_value: 'C/ NUEVA 5' }] });
    const address = facts.find((f) => f.fact_key === 'address');
    expect(address.declared_value).toBe('C/ NUEVA 5');
    expect(address.registry_value_at_issue).toBe('C/ ARZOBISPO COS 10, BAJO (MADRID)');
  });

  it('reuses a given nonce so a drift check compares only registry change', async () => {
    const original = await assembleDraft(BASE);
    // Same company, same nonce and drafted_at -> identical hash. This is what
    // lets submit tell "the registry moved" apart from "a new draft was built".
    const rebuilt = await assembleDraft({ ...BASE, nonce: BASE.nonce, draftedAt: BASE.draftedAt });
    expect(rebuilt.hash).toBe(original.hash);
  });

  it('changes hash when only the nonce differs', async () => {
    expect((await assembleDraft({ ...BASE, nonce: 'n-2' })).hash)
      .not.toBe((await assembleDraft(BASE)).hash);
  });
});
