import { describe, it, expect } from 'vitest';
import { publicProjection } from './projection.js';

const record = (overrides = {}) => ({
  id: 'att_abc', subject_id: 's1', status: 'live', method: 'email-confirmed',
  representation_basis: 'sole_admin', seat_officer_name: 'NURNBERG ALESSANDRO',
  seat_position: 'ADM. UNICO', accepted_at: '2026-09-08T11:30:00Z',
  expires_at: '2027-03-07T11:30:00Z', last_verified_at: '2026-10-07T03:00:00Z',
  approved_at: '2026-09-09T09:00:00Z', reviewer: 'Alessandro Nürnberg',
  claimant_email: 'ceo@example.es', identification_note: 'video call 2026-09-07',
  email_domain_basis: 'company website', sealed_key: 'evidence/sealed/abc.json',
  personal_key: 'evidence/personal/abc.json', sealed_hash: 'deadbeef',
  decision_note: 'internal: checked poder', ...overrides,
});

const audit = [
  { seq: 1, action: 'accepted', created_at: '2026-09-08T11:30:00Z',
    public_summary: 'Accepted by the representative', detail: '{"ip":"1.2.3.4"}' },
  { seq: 2, action: 'reviewed', created_at: '2026-09-09T09:00:00Z',
    public_summary: null, detail: '{"note":"private"}' },
];

describe('publicProjection', () => {
  it('publishes the reviewer, deliberately', () => {
    expect(publicProjection(record(), [], []).reviewer).toBe('Alessandro Nürnberg');
  });
  it('publishes last_verified_at rather than a "right now" claim', () => {
    expect(publicProjection(record(), [], []).last_verified_at).toBe('2026-10-07T03:00:00Z');
  });
  it('includes only audit rows carrying a public_summary', () => {
    const history = publicProjection(record(), [], audit).history;
    expect(history).toHaveLength(1);
    expect(history[0].summary).toBe('Accepted by the representative');
    expect(JSON.stringify(history)).not.toMatch(/1\.2\.3\.4/);
  });
  it('never leaks any private field, for any generated value', () => {
    const secrets = ['ceo@example.es', 'video call 2026-09-07', 'company website',
                     'evidence/sealed/abc.json', 'evidence/personal/abc.json',
                     'deadbeef', 'internal: checked poder'];
    for (let i = 0; i < 200; i++) {
      const marker = `SECRET-${i}-${Math.random().toString(36).slice(2)}`;
      const poisoned = record({
        claimant_email: marker, identification_note: marker, email_domain_basis: marker,
        sealed_key: marker, personal_key: marker, sealed_hash: marker, decision_note: marker,
      });
      expect(JSON.stringify(publicProjection(poisoned, [], audit))).not.toContain(marker);
    }
    const clean = JSON.stringify(publicProjection(record(), [], audit));
    for (const s of secrets) expect(clean).not.toContain(s);
  });
});
