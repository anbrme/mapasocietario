import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackFullCompanyProfileClick, trackUserManualDownload } from './track';

describe('analytics tracking helpers', () => {
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

  it('tracks a full company profile click with its language and destination', () => {
    const gtag = vi.fn();
    vi.stubGlobal('window', { gtag });

    trackFullCompanyProfileClick({
      href: '/en/company/acme-sl',
      language: 'en',
      entrySource: 'homepage',
    });

    expect(gtag).toHaveBeenCalledOnce();
    expect(gtag).toHaveBeenCalledWith('event', 'company_full_profile_click', {
      placement: 'graph_company_preview',
      language: 'en',
      entry_source: 'homepage',
      link_url: '/en/company/acme-sl',
      link_text: 'Open company profile',
    });
  });

  it('distinguishes the selected-node shortcut from the preview link', () => {
    const gtag = vi.fn();
    vi.stubGlobal('window', { gtag });

    trackFullCompanyProfileClick({
      href: '/empresa/acme-sl',
      language: 'es',
      entrySource: 'direct',
      placement: 'graph_selected_node',
    });

    expect(gtag).toHaveBeenCalledWith('event', 'company_full_profile_click', {
      placement: 'graph_selected_node',
      language: 'es',
      entry_source: 'direct',
      link_url: '/empresa/acme-sl',
      link_text: 'Abrir ficha societaria',
    });
  });
});
