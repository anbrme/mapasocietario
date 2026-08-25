import { describe, expect, it } from 'vitest';
import {
  GUIDE_SEEN_KEY,
  hasSeenGuide,
  isLandingPath,
  isReturningGuideVisit,
  markGuideSeen,
  shouldTrackPageView,
} from './firstRunGuide';

// Minimal Storage stand-in; the real thing throws in private mode, so the
// tests exercise a throwing variant too.
const fakeStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    read: () => ({ ...data }),
  };
};

const throwingStorage = () => ({
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('SecurityError'); },
});

describe('hasSeenGuide', () => {
  it('is false for a browser that has never opened the guide', () => {
    expect(hasSeenGuide(fakeStorage())).toBe(false);
  });

  it('is true once the guide has been marked seen', () => {
    const storage = fakeStorage();
    markGuideSeen(storage);
    expect(storage.read()[GUIDE_SEEN_KEY]).toBe('1');
    expect(hasSeenGuide(storage)).toBe(true);
  });

  it('treats unreadable storage as a first run rather than throwing', () => {
    expect(hasSeenGuide(throwingStorage())).toBe(false);
    expect(hasSeenGuide(null)).toBe(false);
  });
});

describe('markGuideSeen', () => {
  it('swallows a storage that refuses to write', () => {
    expect(() => markGuideSeen(throwingStorage())).not.toThrow();
    expect(() => markGuideSeen(null)).not.toThrow();
  });
});

describe('isReturningGuideVisit', () => {
  it('is false on a first visit', () => {
    expect(isReturningGuideVisit({ search: '', storage: fakeStorage() })).toBe(false);
  });

  it('is true for a browser that already saw the guide', () => {
    expect(isReturningGuideVisit({ search: '', storage: fakeStorage({ [GUIDE_SEEN_KEY]: '1' }) })).toBe(true);
  });

  it('is false when ?guide=1 explicitly asks for the guide again', () => {
    expect(isReturningGuideVisit({ search: '?guide=1', storage: fakeStorage({ [GUIDE_SEEN_KEY]: '1' }) })).toBe(false);
    expect(isReturningGuideVisit({ search: '?lang=es&guide=1', storage: fakeStorage({ [GUIDE_SEEN_KEY]: '1' }) })).toBe(false);
  });
});

describe('isLandingPath', () => {
  it('matches both language homepages, with or without a trailing slash', () => {
    expect(isLandingPath('/')).toBe(true);
    expect(isLandingPath('/es')).toBe(true);
    expect(isLandingPath('/es/')).toBe(true);
  });

  it('does not match the workspace or any content route', () => {
    expect(isLandingPath('/app')).toBe(false);
    expect(isLandingPath('/app/')).toBe(false);
    expect(isLandingPath('/dashboard')).toBe(false);
    expect(isLandingPath('/pricing')).toBe(false);
    expect(isLandingPath('/es/busqueda-registro-mercantil')).toBe(false);
    expect(isLandingPath('/es/alguna-empresa-sl')).toBe(false);
  });
});

describe('shouldTrackPageView', () => {
  // The homepage auto-redirects returning visitors to /app, so without this
  // guard every returning visit logged a sub-second "/" page_view and dragged
  // the homepage's average engagement time down with views nobody ever saw.
  it('suppresses the homepage view a returning visitor is redirected away from', () => {
    expect(shouldTrackPageView({ pathname: '/', isReturningGuideVisitor: true })).toBe(false);
    expect(shouldTrackPageView({ pathname: '/es', isReturningGuideVisitor: true })).toBe(false);
  });

  it('keeps the homepage view for a first-time visitor who actually sees it', () => {
    expect(shouldTrackPageView({ pathname: '/', isReturningGuideVisitor: false })).toBe(true);
    expect(shouldTrackPageView({ pathname: '/es', isReturningGuideVisitor: false })).toBe(true);
  });

  it('keeps every non-landing view, returning visitor or not', () => {
    expect(shouldTrackPageView({ pathname: '/app', isReturningGuideVisitor: true })).toBe(true);
    expect(shouldTrackPageView({ pathname: '/dashboard', isReturningGuideVisitor: true })).toBe(true);
    expect(shouldTrackPageView({ pathname: '/pricing', isReturningGuideVisitor: false })).toBe(true);
  });
});
