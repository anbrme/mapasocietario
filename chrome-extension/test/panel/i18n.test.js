import { describe, it, expect } from 'vitest';
import { pickLocale, t } from '../../src/panel/i18n.js';

describe('i18n', () => {
  it('maps es* to es, everything else to en', () => {
    expect(pickLocale('es-ES')).toBe('es');
    expect(pickLocale('en-US')).toBe('en');
    expect(pickLocale(undefined)).toBe('en');
  });
  it('returns localized strings', () => {
    expect(t('es', 'viewProfile')).toMatch(/perfil/i);
    expect(t('en', 'viewProfile')).toMatch(/profile/i);
  });
  it('falls back to the key when missing', () => {
    expect(t('en', 'nope')).toBe('nope');
  });
});
