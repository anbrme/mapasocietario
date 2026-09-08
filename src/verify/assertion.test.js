import { describe, it, expect } from 'vitest';
import { hashCanonical } from './hash.js';
import { buildAssertion, buildAcceptanceReceipt, addDays, VALID_FOR_DAYS } from './assertion.js';

const INPUT = {
  identity: { subject_id: 's1', group_key: 'H:M-566914', nif: 'B86829538', hoja: 'M-566914',
              canonical_name: 'NURNBERG CONSULTING SL' },
  seat: { name: 'NURNBERG ALESSANDRO', position: 'ADM. UNICO', appointed_date: '2013-10-16' },
  representationBasis: 'sole_admin',
  facts: [{ fact_key: 'address', declared_status: 'current', declared_value: 'C/ ARZOBISPO COS 10' }],
  registrySnapshotDigest: 'abc123',
  consents: { authority: true, publication: true, reconfirmation: true },
  nonce: 'n-1',
  draftedAt: '2026-09-08T10:00:00Z',
};

describe('buildAssertion', () => {
  it('carries the validity RULE, never a computed expiry', () => {
    const a = buildAssertion(INPUT);
    expect(a.valid_for_days).toBe(VALID_FOR_DAYS);
    expect(a).not.toHaveProperty('expires_at');
    expect(a).not.toHaveProperty('accepted_at');
  });
  it('hashes identically before and after acceptance', async () => {
    const before = await hashCanonical(buildAssertion(INPUT));
    const receipt = buildAcceptanceReceipt(before, '2026-09-08T11:30:00Z', 'email-confirmed');
    const after = await hashCanonical(buildAssertion(INPUT));
    expect(after).toBe(before);
    expect(receipt.assertion_hash).toBe(before);
  });
  it('changes hash when a declared fact changes', async () => {
    const edited = { ...INPUT, facts: [{ ...INPUT.facts[0], declared_value: 'C/ OTRA 1' }] };
    expect(await hashCanonical(buildAssertion(edited)))
      .not.toBe(await hashCanonical(buildAssertion(INPUT)));
  });
});

describe('buildAcceptanceReceipt', () => {
  it('computes expiry by applying the rule to the real acceptance time', () => {
    const r = buildAcceptanceReceipt('h', '2026-09-08T11:30:00Z', 'email-confirmed');
    expect(r.accepted_at).toBe('2026-09-08T11:30:00Z');
    expect(r.expires_at).toBe('2027-03-07T11:30:00Z');
  });
});

describe('addDays', () => {
  it('crosses a leap day correctly', () => {
    expect(addDays('2028-02-28T00:00:00Z', 2)).toBe('2028-03-01T00:00:00Z');
  });
});
