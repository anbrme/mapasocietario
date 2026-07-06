import { describe, it, expect } from 'vitest';
import { validateFeedbackPayload, buildFeedbackEmail, MAX_COMMENT_LENGTH } from './feedbackSubmission';

describe('validateFeedbackPayload', () => {
  it('rejects a payload with neither a reaction nor a comment', () => {
    const result = validateFeedbackPayload({ reaction: null, comment: '   ', lang: 'en', page: '/app' });
    expect(result).toEqual({ ok: false, reason: 'empty' });
  });

  it('accepts a reaction-only payload', () => {
    const result = validateFeedbackPayload({ reaction: 'good', comment: '', lang: 'en', page: '/app' });
    expect(result.ok).toBe(true);
    expect(result.payload).toEqual({ reaction: 'good', comment: '', lang: 'en', page: '/app' });
  });

  it('accepts a comment-only payload', () => {
    const result = validateFeedbackPayload({ reaction: null, comment: 'Love the graph!', lang: 'es', page: '/app' });
    expect(result.ok).toBe(true);
    expect(result.payload).toEqual({ reaction: null, comment: 'Love the graph!', lang: 'es', page: '/app' });
  });

  it('ignores an unrecognized reaction value', () => {
    const result = validateFeedbackPayload({ reaction: 'excellent', comment: 'still counts', lang: 'en', page: '/app' });
    expect(result.ok).toBe(true);
    expect(result.payload.reaction).toBeNull();
  });

  it('defaults lang to "en" when missing or unrecognized', () => {
    const result = validateFeedbackPayload({ reaction: 'good', comment: '', lang: 'fr', page: '/app' });
    expect(result.payload.lang).toBe('en');
  });

  it('silently flags a filled honeypot regardless of other fields', () => {
    const result = validateFeedbackPayload({ reaction: 'good', comment: 'hi', lang: 'en', page: '/app', honeypot: 'i am a bot' });
    expect(result).toEqual({ ok: false, reason: 'honeypot' });
  });

  it('truncates a comment longer than MAX_COMMENT_LENGTH instead of rejecting it', () => {
    const longComment = 'a'.repeat(MAX_COMMENT_LENGTH + 500);
    const result = validateFeedbackPayload({ reaction: null, comment: longComment, lang: 'en', page: '/app' });
    expect(result.ok).toBe(true);
    expect(result.payload.comment).toHaveLength(MAX_COMMENT_LENGTH);
  });

  it('handles a completely empty body without throwing', () => {
    expect(validateFeedbackPayload({})).toEqual({ ok: false, reason: 'empty' });
  });
});

describe('buildFeedbackEmail', () => {
  const opts = { from: 'feedback@mapasocietario.es', to: 'mapasocietario@ncdata.eu', timestamp: '2026-07-07T10:00:00.000Z' };

  it('includes the reaction, language, page, and comment in the body', () => {
    const payload = { reaction: 'good', comment: 'Great tool!', lang: 'en', page: '/app' };
    const { body } = buildFeedbackEmail(payload, opts);
    expect(body).toContain('Great tool!');
    expect(body).toContain('/app');
    expect(body).toContain('2026-07-07T10:00:00.000Z');
  });

  it('labels a null reaction as no reaction selected', () => {
    const payload = { reaction: null, comment: 'Just a comment', lang: 'es', page: '/app' };
    const { body } = buildFeedbackEmail(payload, opts);
    expect(body).toContain('(no reaction selected)');
  });

  it('produces a raw MIME string with From/To/Subject headers and a blank line before the body', () => {
    const payload = { reaction: 'bad', comment: 'Needs work', lang: 'en', page: '/app' };
    const { raw, subject } = buildFeedbackEmail(payload, opts);
    expect(raw).toContain(`From: ${opts.from}`);
    expect(raw).toContain(`To: ${opts.to}`);
    expect(raw).toContain(`Subject: ${subject}`);
    expect(raw).toContain('\r\n\r\n');
  });

  it('strips newlines from header-bound values to prevent header injection', () => {
    const payload = { reaction: 'good', comment: 'irrelevant', lang: 'en', page: '/app\ninjected: true' };
    const { raw } = buildFeedbackEmail(payload, opts);
    expect(raw).not.toContain('injected: true\r\n');
  });
});
