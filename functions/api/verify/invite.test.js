import { describe, it, expect } from 'vitest';
import { validateInvitePayload } from './invite.js';

const good = {
  group_key: 'H:M-566914', declared_name: 'Alessandro Nürnberg',
  email: 'a@nurnbergconsulting.com', claimed_role: 'Administrador único',
  representation_basis: 'sole_admin', identification_note: 'known personally since 2019',
  email_domain_basis: 'company website nurnbergconsulting.com',
};

describe('validateInvitePayload', () => {
  it('accepts a complete payload', () => {
    expect(validateInvitePayload(good).ok).toBe(true);
  });

  it('REFUSES mancomunados by name', () => {
    expect(validateInvitePayload({ ...good, representation_basis: 'joint_admin_pair' }))
      .toEqual({ ok: false, reason: 'joint_administrators_excluded' });
  });

  it('requires the reviewer to record how the person was identified', () => {
    expect(validateInvitePayload({ ...good, identification_note: '' }))
      .toEqual({ ok: false, reason: 'missing_identification_note' });
  });

  it('requires the basis for tying the domain to the company', () => {
    expect(validateInvitePayload({ ...good, email_domain_basis: '  ' }))
      .toEqual({ ok: false, reason: 'missing_email_domain_basis' });
  });

  it('rejects an unknown representation basis', () => {
    expect(validateInvitePayload({ ...good, representation_basis: 'ceo' }))
      .toEqual({ ok: false, reason: 'invalid_representation_basis' });
  });

  it('rejects a malformed email', () => {
    expect(validateInvitePayload({ ...good, email: 'nope' }))
      .toEqual({ ok: false, reason: 'invalid_email' });
  });

  it('lowercases the email but leaves the declared name alone', () => {
    const { value } = validateInvitePayload({ ...good, email: 'A@Nurnberg.COM' });
    expect(value.email).toBe('a@nurnberg.com');
    expect(value.declared_name).toBe('Alessandro Nürnberg');
  });

  it('rejects a missing body rather than throwing', () => {
    expect(validateInvitePayload(undefined)).toEqual({ ok: false, reason: 'missing_group_key' });
  });
});
