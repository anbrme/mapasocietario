// WCAG 2.x relative luminance and contrast ratio, used by palette.test.js to
// enforce the 3:1 non-text contrast floor (WCAG 1.4.11) on every graph colour.
// Alpha is ignored: canvas colours are drawn over an opaque canvas, so the
// solid colour is the case worth measuring.

const HEX_LONG = /^#([0-9a-f]{6})$/i;
const HEX_SHORT = /^#([0-9a-f]{3})$/i;
const RGB_FUNC = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)$/i;

export function parseColor(value) {
  if (typeof value !== 'string') return null;
  const input = value.trim();

  const long = HEX_LONG.exec(input);
  if (long) {
    const n = parseInt(long[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  const short = HEX_SHORT.exec(input);
  if (short) {
    const [a, b, c] = short[1].split('');
    return {
      r: parseInt(a + a, 16),
      g: parseInt(b + b, 16),
      b: parseInt(c + c, 16),
    };
  }

  const rgb = RGB_FUNC.exec(input);
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  }

  return null;
}

const channelLuminance = channel => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function relativeLuminance(value) {
  const rgb = parseColor(value);
  if (!rgb) throw new Error(`Unparseable colour: ${value}`);
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

export function contrastRatio(a, b) {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}
