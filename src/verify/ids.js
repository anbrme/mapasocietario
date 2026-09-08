/**
 * Unguessable identifiers. The attestation id is public and the grant token IS
 * the address of a private page, so both must come from a CSPRNG — 16 bytes of
 * crypto.getRandomValues, base32-encoded to stay URL-safe and case-insensitive.
 */
import { sha256Hex } from './hash.js';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

function base32(bytes) {
  let bits = 0, value = 0, out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

const random = (n) => base32(crypto.getRandomValues(new Uint8Array(n)));

export const newId = (prefix) => `${prefix}_${random(16)}`;
export const newToken = () => random(32);
export const tokenHash = (token) => sha256Hex(token);
