// Per-mode drawing weights for the force graph canvas — the alphas the draw
// code applied as literals, which were tuned on the dark canvas.
//
// palette.js carries only colours (its test parses every leaf), so these live
// here. Dark keeps the literals exactly; graphInk.test.js pins them.
//
// Why light differs: light node colours were darkened so an OUTLINE clears
// 3:1 on the near-white canvas, but the same colour is also painted over the
// node body as a tint. At the dark alpha that tint turns a person into a solid
// magenta disc and a company into a solid teal block — the hollow-node
// language is gone and the two shapes stop carrying equal weight. Links have
// the matching problem: a full-saturation red on white shouts in a way
// #f87171 on navy never did, so light links draw lighter.
import { normalizeMode } from './themeMode';

export const GRAPH_INK = Object.freeze({
  dark: Object.freeze({ nodeTintAlpha: 0.45, deadEndTintAlpha: 0.10, linkAlpha: 0.78 }),
  light: Object.freeze({ nodeTintAlpha: 0.16, deadEndTintAlpha: 0.06, linkAlpha: 0.62 }),
});

export function graphInk(mode) {
  return GRAPH_INK[normalizeMode(mode)];
}
