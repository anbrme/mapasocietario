import { describe, it, expect } from 'vitest';
import {
  awardsPanelState,
  formatSingleBidShare,
  buildAwardsBlock,
  MIN_AWARDS_FOR_SINGLE_BID_SHARE,
} from './_awards.js';

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const t = {
  awardsTitle: 'Contratos públicos',
  awardsSub: 'sub',
  awardsScope: 'Adjudicados a esta entidad (NIF), no al grupo.',
  awardsStatAwards: 'Contratos adjudicados',
  awardsStatBuyers: 'Órganos de contratación',
  awardsStatSingleBid: 'Con una sola oferta',
  awardsSingleBidNote: 'nota concentración',
  awardsSource: 'Fuente: PLACSP',
};

const company = { name: 'MERCADONA SA', nif: 'A46103834' };

describe('awardsPanelState', () => {
  it('hides the panel when the backend sends panel:false', () => {
    expect(awardsPanelState({ success: true, panel: false })).toEqual({ show: false });
  });

  it('hides the panel when the endpoint is dark', () => {
    expect(awardsPanelState({ disabled: true })).toEqual({ show: false });
  });

  it('hides the panel when the response is not a success', () => {
    expect(awardsPanelState({ success: false })).toEqual({ show: false });
  });

  it('hides the panel when the response is missing', () => {
    expect(awardsPanelState(null)).toEqual({ show: false });
    expect(awardsPanelState(undefined)).toEqual({ show: false });
  });

  it('shows the three counts from a real payload', () => {
    expect(
      awardsPanelState({
        success: true,
        panel: true,
        awards: 11,
        distinct_buyers: 11,
        single_bid_share: 0.8181818181818182,
      })
    ).toEqual({ show: true, awards: 11, distinctBuyers: 11, singleBidShare: 0.8181818181818182 });
  });

  it('hides the panel when panel:true carries no positive award count', () => {
    expect(awardsPanelState({ success: true, panel: true, awards: 0 })).toEqual({ show: false });
    expect(awardsPanelState({ success: true, panel: true })).toEqual({ show: false });
  });

  it('drops a non-numeric single_bid_share instead of showing the panel without it', () => {
    const state = awardsPanelState({ success: true, panel: true, awards: 9, distinct_buyers: 4, single_bid_share: null });
    expect(state.show).toBe(true);
    expect(state.singleBidShare).toBe(null);
  });
});

describe('formatSingleBidShare', () => {
  it('renders a fraction as a whole percentage', () => {
    expect(formatSingleBidShare(0.8181818181818182, 11)).toBe('82%');
  });

  it('renders a zero share rather than treating it as missing', () => {
    expect(formatSingleBidShare(0, 40)).toBe('0%');
  });

  it('returns null for a non-numeric share', () => {
    expect(formatSingleBidShare(null, 40)).toBe(null);
    expect(formatSingleBidShare('0.5', 40)).toBe(null);
  });

  it('returns null for a share outside 0..1', () => {
    expect(formatSingleBidShare(1.5, 40)).toBe(null);
    expect(formatSingleBidShare(-0.1, 40)).toBe(null);
  });

  it('withholds the share when too few awards make the percentage noise', () => {
    expect(formatSingleBidShare(1, MIN_AWARDS_FOR_SINGLE_BID_SHARE - 1)).toBe(null);
    expect(formatSingleBidShare(1, MIN_AWARDS_FOR_SINGLE_BID_SHARE)).toBe('100%');
  });
});

describe('buildAwardsBlock', () => {
  it('returns an empty string when the company has no NIF to key on', () => {
    expect(buildAwardsBlock({ company: { name: 'ACME' }, t, lang: 'es', apiBase: 'https://api.x', esc })).toBe('');
  });

  it('falls back to the enriched NIF', () => {
    const html = buildAwardsBlock({
      company: { name: 'ACME', enriched_nif: 'B99999999' },
      t,
      lang: 'es',
      apiBase: 'https://api.x',
      esc,
    });
    expect(html).toContain('data-nif="B99999999"');
  });

  it('ships the section hidden so nothing shows until the backend corroborates it', () => {
    const html = buildAwardsBlock({ company, t, lang: 'es', apiBase: 'https://api.ncdata.eu', esc });
    expect(html).toMatch(/<section[^>]*id="awards-section"[^>]*\shidden\b/);
  });

  it('renders the shell with data attrs and the i18n blob', () => {
    const html = buildAwardsBlock({ company, t, lang: 'es', apiBase: 'https://api.ncdata.eu', esc });
    expect(html).toContain('id="awards-body"');
    expect(html).toContain('data-nif="A46103834"');
    expect(html).toContain('data-lang="es"');
    expect(html).toContain('data-api="https://api.ncdata.eu"');
    expect(html).toContain('id="awards-i18n"');
  });

  it('calls the company-awards route with the NIF in the path', () => {
    const html = buildAwardsBlock({ company, t, lang: 'es', apiBase: 'https://api.ncdata.eu', esc });
    expect(html).toContain("'/bormes/'+encodeURIComponent(");
    expect(html).toContain("+'/company-awards'");
  });

  it('says the contracts were awarded to this entity, not the group', () => {
    const html = buildAwardsBlock({ company, t, lang: 'es', apiBase: 'https://api.x', esc });
    expect(html).toContain(t.awardsScope);
  });

  it('never renders a monetary figure', () => {
    const html = buildAwardsBlock({ company, t, lang: 'es', apiBase: 'https://api.x', esc });
    // \b on EUR/amount so encodeURIComponent ("...codeURIC...") does not match.
    expect(html).not.toMatch(/€|\bEUR\b|currency|NumberFormat|\bamount\b|importe/i);
  });

  it('does not use innerHTML in the client IIFE', () => {
    const html = buildAwardsBlock({ company, t, lang: 'es', apiBase: 'https://api.x', esc });
    expect(html).not.toContain('innerHTML');
  });

  it('escapes the NIF in the data attribute', () => {
    const html = buildAwardsBlock({
      company: { name: 'ACME', nif: 'A"><script>x</script>' },
      t,
      lang: 'es',
      apiBase: 'https://api.x',
      esc,
    });
    expect(html).toContain('data-nif="A&quot;&gt;&lt;script&gt;x&lt;/script&gt;"');
  });

  it('inlines the same decision helpers the tests cover, not a copy', () => {
    const html = buildAwardsBlock({ company, t, lang: 'es', apiBase: 'https://api.x', esc });
    expect(html).toContain('var awardsPanelState=' + awardsPanelState.toString());
    expect(html).toContain('var formatSingleBidShare=' + formatSingleBidShare.toString());
  });
});
