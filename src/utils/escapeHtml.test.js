import { describe, expect, it } from 'vitest';
import { escapeHtml } from './escapeHtml';

describe('escapeHtml', () => {
  it('escapes every character that could break out of an attribute or element', () => {
    expect(escapeHtml(`<img src="x" onerror='alert(1)'>&`))
      .toBe('&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;');
  });

  it('returns an empty string for null and undefined rather than "null"', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('escapes the ampersand first so existing entities are not double-decoded', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('stringifies non-string input', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});
