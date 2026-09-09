import { describe, it, expect } from 'vitest';
import { classifyEmailDomain, isCorporateEmailDomain } from './emailDomain.js';

describe('classifyEmailDomain', () => {
  it('accepts a corporate domain', () => {
    expect(classifyEmailDomain('ana@acme.es')).toBe('corporate');
  });

  it('rejects the unambiguous consumer providers', () => {
    for (const address of [
      'a@gmail.com', 'a@googlemail.com', 'a@outlook.com', 'a@hotmail.es',
      'a@live.com', 'a@msn.com', 'a@yahoo.es', 'a@ymail.com', 'a@icloud.com',
      'a@me.com', 'a@aol.com', 'a@gmx.es', 'a@mail.com', 'a@protonmail.com',
      'a@proton.me', 'a@yandex.ru', 'a@zoho.com',
    ]) {
      expect(classifyEmailDomain(address)).toBe('consumer');
    }
  });

  it('rejects the Spanish ISP mailboxes', () => {
    for (const address of ['a@terra.es', 'a@telefonica.net', 'a@wanadoo.es',
                           'a@ono.com', 'a@movistar.es', 'a@orange.es']) {
      expect(classifyEmailDomain(address)).toBe('consumer');
    }
  });

  it('rejects a subdomain of a consumer domain', () => {
    expect(classifyEmailDomain('a@foo.gmail.com')).toBe('consumer');
  });

  it('does not reject a corporate domain that merely ENDS in a consumer name', () => {
    // "notgmail.com" is a different domain from "gmail.com" - only a dot
    // boundary counts as a subdomain.
    expect(classifyEmailDomain('a@notgmail.com')).toBe('corporate');
  });

  it('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(classifyEmailDomain('  Ana@GMAIL.com ')).toBe('consumer');
    expect(classifyEmailDomain(' Ana@Acme.ES ')).toBe('corporate');
  });

  it('calls a malformed address invalid, not consumer', () => {
    for (const bad of ['', null, undefined, 'ana', 'ana@', '@acme.es',
                       'ana@acme', 'ana@.es', 'ana@acme.', 'a b@acme.es',
                       'ana@192.168.0.1', 'ana@[192.168.0.1]']) {
      expect(classifyEmailDomain(bad)).toBe('invalid');
    }
  });
});

describe('isCorporateEmailDomain', () => {
  it('is true only for the corporate case', () => {
    expect(isCorporateEmailDomain('ana@acme.es')).toBe(true);
    expect(isCorporateEmailDomain('ana@gmail.com')).toBe(false);
    expect(isCorporateEmailDomain('nonsense')).toBe(false);
  });
});
