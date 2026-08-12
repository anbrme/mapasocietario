import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackUserManualDownload } from './track';

describe('trackUserManualDownload', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends one consistent GA4 event with its source and language', () => {
    const gtag = vi.fn();
    vi.stubGlobal('window', { gtag });

    trackUserManualDownload('landing_page', 'es');

    expect(gtag).toHaveBeenCalledOnce();
    expect(gtag).toHaveBeenCalledWith('event', 'user_manual_download', {
      placement: 'landing_page',
      language: 'es',
      file_name: 'mapa-societario-user-guide-en-es.pdf',
    });
  });

  it('remains a no-op when GA4 is unavailable', () => {
    vi.stubGlobal('window', {});

    expect(() => trackUserManualDownload('graph_view_menu', 'en')).not.toThrow();
  });
});
