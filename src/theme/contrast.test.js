import { describe, expect, it } from 'vitest';
import { contrastRatio, parseColor, relativeLuminance } from './contrast';

describe('parseColor', () => {
  it('parses six-digit hex', () => {
    expect(parseColor('#0d1220')).toEqual({ r: 13, g: 18, b: 32 });
  });

  it('parses three-digit hex by doubling each nibble', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('parses rgba() and ignores the alpha channel', () => {
    expect(parseColor('rgba(180, 180, 180, 0.85)')).toEqual({ r: 180, g: 180, b: 180 });
  });

  it('returns null for an unparseable value', () => {
    expect(parseColor('teal')).toBeNull();
    expect(parseColor('')).toBeNull();
  });
});

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });
});

describe('contrastRatio', () => {
  it('returns the maximum 21:1 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
  });

  it('returns 1 for a colour against itself', () => {
    expect(contrastRatio('#33bdad', '#33bdad')).toBe(1);
  });

  it('is symmetric regardless of argument order', () => {
    expect(contrastRatio('#33bdad', '#0d1220')).toBe(contrastRatio('#0d1220', '#33bdad'));
  });

  it('matches the known ratio for the company teal on the dark canvas', () => {
    expect(contrastRatio('#33bdad', '#0d1220')).toBe(8.02);
  });

  it('throws on an unparseable colour rather than returning a wrong number', () => {
    expect(() => contrastRatio('nope', '#ffffff')).toThrow(/unparseable colour/i);
  });
});
