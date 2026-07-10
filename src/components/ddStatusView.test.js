import { describe, it, expect } from 'vitest';
import { ddStatusView, DD_TAKING_LONG_MS } from './ddStatusView';

const NOW = new Date('2026-07-10T18:30:00.000Z').getTime();
const minsAgo = (m) => new Date(NOW - m * 60000).toISOString();

describe('ddStatusView', () => {
  it('is Ready when the report PDF exists (status completed)', () => {
    const v = ddStatusView({ status: 'completed' }, NOW);
    expect(v).toEqual({ label: 'Ready', color: 'success', showRetry: false });
  });

  it('is Ready when ddState is ready', () => {
    expect(ddStatusView({ ddState: 'ready' }, NOW).showRetry).toBe(false);
  });

  it('shows a live timer without retry while generating normally', () => {
    const v = ddStatusView({ ddState: 'generating', ddStartedAt: minsAgo(2) }, NOW);
    expect(v.label).toBe('Generating… (2m)');
    expect(v.color).toBe('info');
    expect(v.showRetry).toBe(false);
  });

  it('flags a slow generation and offers retry past the threshold', () => {
    const v = ddStatusView({ ddState: 'generating', ddStartedAt: minsAgo(14) }, NOW);
    expect(v.label).toBe('Generating — taking long (14m)');
    expect(v.color).toBe('warning');
    expect(v.showRetry).toBe(true);
  });

  it('treats exactly the threshold as taking long', () => {
    const v = ddStatusView({ ddState: 'generating', ddStartedAt: new Date(NOW - DD_TAKING_LONG_MS).toISOString() }, NOW);
    expect(v.showRetry).toBe(true);
  });

  it('shows the failure reason, attempt count, and retry', () => {
    const v = ddStatusView({ ddState: 'failed', ddReason: 'store_failed', ddAttempts: 1 }, NOW);
    expect(v.label).toBe('Failed: store_failed · 1 attempt');
    expect(v.color).toBe('error');
    expect(v.showRetry).toBe(true);
  });

  it('pluralizes attempts', () => {
    const v = ddStatusView({ ddState: 'failed', ddReason: 'error', ddAttempts: 2 }, NOW);
    expect(v.label).toBe('Failed: error · 2 attempts');
  });

  it('marks a never-started order (no status record) with retry', () => {
    const v = ddStatusView({ ddState: 'never_started', createdAt: minsAgo(30) }, NOW);
    expect(v.label).toBe('Never started');
    expect(v.showRetry).toBe(true);
  });

  it('falls back to never_started for an unknown state', () => {
    expect(ddStatusView({ ddState: 'weird' }, NOW).label).toBe('Never started');
  });
});
