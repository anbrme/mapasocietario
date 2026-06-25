import { describe, it, expect } from 'vitest';
import { handleMessage } from '../src/background.js';
import { MSG } from '../src/api/messages.js';

describe('handleMessage', () => {
  it('RESOLVE returns matches', async () => {
    const out = await handleMessage(
      { type: MSG.RESOLVE, query: 'telefonica' },
      { resolveImpl: async () => [{ id: 'H:M-1', name: 'X' }], getImpl: async () => null }
    );
    expect(out).toEqual({ type: 'matches', matches: [{ id: 'H:M-1', name: 'X' }] });
  });

  it('GET_COMPANY returns company', async () => {
    const out = await handleMessage(
      { type: MSG.GET_COMPANY, id: 'H:M-1' },
      { resolveImpl: async () => [], getImpl: async () => ({ name: 'X' }) }
    );
    expect(out).toEqual({ type: 'company', company: { name: 'X' } });
  });

  it('GET_COMPANY with no doc returns error', async () => {
    const out = await handleMessage(
      { type: MSG.GET_COMPANY, id: 'H:M-1' },
      { resolveImpl: async () => [], getImpl: async () => null }
    );
    expect(out.type).toBe('error');
  });
});
