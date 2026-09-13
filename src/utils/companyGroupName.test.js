import { describe, expect, it } from 'vitest';
import { resolveCompanyGroupName } from './companyGroupName';

describe('resolveCompanyGroupName', () => {
  it('normalizes the name when there is no alias map', () => {
    // Arrange
    const entries = [{ name: 'ACME SL (2024).' }];

    // Act
    const name = resolveCompanyGroupName('ACME SL (2024).', entries, null);

    // Assert: the year suffix and the trailing period go, as in every insert path.
    expect(name).toBe('ACME SL');
  });

  it('returns the sibling entry spelling of the new name when the map folds the old one', () => {
    // Arrange: the fetch brought both denominations back.
    const entries = [{ name: 'VIEJA SL' }, { name: 'Nueva SL' }];
    const aliasMap = new Map([['VIEJA SL', 'NUEVA SL']]);

    // Act
    const name = resolveCompanyGroupName('VIEJA SL', entries, aliasMap);

    // Assert
    expect(name).toBe('Nueva SL');
  });

  it('falls back to the map value when no sibling entry spells the new name', () => {
    // Arrange: the related fetch failed, so only the old name is in the insert.
    const entries = [{ name: 'VIEJA SL' }];
    const aliasMap = new Map([['VIEJA SL', 'NUEVA SL']]);

    // Act
    const name = resolveCompanyGroupName('VIEJA SL', entries, aliasMap);

    // Assert
    expect(name).toBe('NUEVA SL');
  });

  it('leaves a name the map does not mention alone', () => {
    // Arrange
    const aliasMap = new Map([['OTRA SL', 'DISTINTA SL']]);

    // Act
    const name = resolveCompanyGroupName('ACME SL', [{ name: 'ACME SL' }], aliasMap);

    // Assert
    expect(name).toBe('ACME SL');
  });

  it('reads company_name when the entry has no name, and tolerates a missing name', () => {
    // Arrange
    const entries = [{ company_name: 'Nueva SL' }];
    const aliasMap = new Map([['VIEJA SL', 'NUEVA SL']]);

    // Act + Assert
    expect(resolveCompanyGroupName('VIEJA SL', entries, aliasMap)).toBe('Nueva SL');
    expect(resolveCompanyGroupName('', entries, aliasMap)).toBe('');
    expect(resolveCompanyGroupName(null, entries, null)).toBe('');
  });
});
