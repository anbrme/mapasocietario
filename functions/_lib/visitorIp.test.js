import { describe, it, expect } from 'vitest';
import { visitorIp } from './visitorIp.js';

const req = (headers) => new Request('https://mapasocietario.es/api/x', { headers });

describe('visitorIp', () => {
  it('returns CF-Connecting-IP when no front secret is configured', () => {
    const r = req({ 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' });
    expect(visitorIp(r, {})).toBe('1.2.3.4');
  });

  it('returns the forwarded address when the front secret matches', () => {
    const r = req({
      'cf-connecting-ip': '188.245.60.39',
      'x-forwarded-for': '83.1.2.3',
      'x-front-secret': 's3cret',
    });
    expect(visitorIp(r, { FRONT_SECRET: 's3cret' })).toBe('83.1.2.3');
  });

  it('ignores X-Forwarded-For when the secret is missing or wrong', () => {
    const env = { FRONT_SECRET: 's3cret' };
    const missing = req({ 'cf-connecting-ip': '5.5.5.5', 'x-forwarded-for': '83.1.2.3' });
    const wrong = req({ 'cf-connecting-ip': '5.5.5.5', 'x-forwarded-for': '83.1.2.3', 'x-front-secret': 'nope' });
    expect(visitorIp(missing, env)).toBe('5.5.5.5');
    expect(visitorIp(wrong, env)).toBe('5.5.5.5');
  });

  it('takes only the first hop of a forwarded chain', () => {
    const r = req({ 'x-forwarded-for': ' 83.1.2.3 , 10.0.0.1', 'x-front-secret': 's' });
    expect(visitorIp(r, { FRONT_SECRET: 's' })).toBe('83.1.2.3');
  });

  it('falls back to CF-Connecting-IP when the trusted forwarded header is empty', () => {
    const r = req({ 'cf-connecting-ip': '5.5.5.5', 'x-front-secret': 's' });
    expect(visitorIp(r, { FRONT_SECRET: 's' })).toBe('5.5.5.5');
  });

  it('returns an empty string when nothing identifies the visitor', () => {
    expect(visitorIp(req({}), {})).toBe('');
  });
});
