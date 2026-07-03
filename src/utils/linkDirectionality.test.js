import { describe, it, expect } from 'vitest';
import { isDirectionalLink, getLinkEffectiveCategory, BORME_SECTION_NAMES } from './linkDirectionality';

describe('isDirectionalLink', () => {
  it('matches explicit officer-company / ownership types (officer-expand paths)', () => {
    expect(isDirectionalLink({ type: 'officer-company' })).toBe(true);
    expect(isDirectionalLink({ type: 'ownership' })).toBe(true);
  });

  it('matches MAIN graph officer->company edges keyed by category, not type', () => {
    // This is the real shape produced when building the main company graph:
    // no `type` field at all, just a resolved BORME section category.
    for (const category of BORME_SECTION_NAMES) {
      expect(isDirectionalLink({ category })).toBe(true);
    }
  });

  it('matches ownership-family categories (sole shareholder variants)', () => {
    expect(isDirectionalLink({ category: 'socio_unico' })).toBe(true);
    expect(isDirectionalLink({ category: 'socio_perdido' })).toBe(true);
    expect(isDirectionalLink({ category: 'socio_anterior' })).toBe(true);
  });

  it('resolves category from the latest event, same as the renderer (getLinkEffectiveCategory)', () => {
    // No bare `category`, but an event history that resolves to an officer category —
    // must match, since the renderer colors/labels the link off the SAME resolution.
    const link = {
      category: 'unknown-fallback',
      events: [
        { category: 'ceses_dimisiones', date: '2020-01-01' },
        { category: 'nombramientos', date: '2023-06-15' },
      ],
    };
    expect(getLinkEffectiveCategory(link)).toBe('nombramientos');
    expect(isDirectionalLink(link)).toBe(true);
  });

  it('does NOT match untyped, non-officer, non-ownership structural links', () => {
    expect(isDirectionalLink({ category: 'company-company' })).toBe(false);
    expect(isDirectionalLink({})).toBe(false);
    expect(isDirectionalLink(null)).toBe(false);
  });

  it('a user-amended link uses its own category, ignoring stale events', () => {
    const link = {
      userAmended: true,
      category: 'nombramientos',
      events: [{ category: 'ceses_dimisiones', date: '2099-01-01' }],
    };
    expect(getLinkEffectiveCategory(link)).toBe('nombramientos');
    expect(isDirectionalLink(link)).toBe(true);
  });
});
