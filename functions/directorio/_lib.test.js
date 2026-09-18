import { describe, it, expect } from 'vitest';
import { groupProvinces, renderDirectoryIndex, renderProvincePage } from './_lib.js';
import { directorySitemapUrls } from '../sitemap-directorio.xml.js';

describe('groupProvinces', () => {
  it('merges case variants under one slug, keeping the dominant spelling', () => {
    const groups = groupProvinces([
      { province: 'MADRID', total: 3 },
      { province: 'Madrid', total: 40 },
      { province: 'Barcelona', total: 20 },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ slug: 'madrid', name: 'Madrid', total: 43 });
    expect(groups[0].variants).toEqual(['MADRID', 'Madrid']);
    expect(groups[1].slug).toBe('barcelona');
  });

  it('slugifies accented provinces and drops empty ones', () => {
    const groups = groupProvinces([
      { province: 'A Coruña', total: 5 },
      { province: '', total: 9 },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].slug).toBe('a-coruna');
  });
});

describe('renderDirectoryIndex', () => {
  it('renders an indexable province list with counts and canonical', () => {
    const html = renderDirectoryIndex(groupProvinces([{ province: 'Madrid', total: 40 }]));
    expect(html).toContain('<title>Selección de empresas por provincia');
    expect(html).toContain('rel="canonical" href="https://mapasocietario.es/directorio"');
    expect(html).toContain('content="index, follow"');
    expect(html).toContain('href="/directorio/madrid"');
    expect(html).toContain('el buscador completo cubre más de 3 millones');
    expect(html).toContain('"@type":"ItemList"');
  });
});

describe('renderProvincePage', () => {
  const group = { slug: 'madrid', name: 'Madrid', total: 2, variants: ['Madrid'] };
  const companies = [
    { slug: 'acme-sl', canonical_name: 'ACME SL', nif: 'B12345678' },
    { slug: 'ohara-y-cia-sl', canonical_name: "O'HARA & CÍA SL", nif: null },
  ];

  it('links each company to its /empresa page and escapes names', () => {
    const html = renderProvincePage(group, companies);
    expect(html).toContain('<title>Selección de empresas en Madrid');
    expect(html).toContain('rel="canonical" href="https://mapasocietario.es/directorio/madrid"');
    expect(html).toContain('href="/empresa/acme-sl"');
    expect(html).toContain('B12345678');
    expect(html).toContain('O&#39;HARA &amp; CÍA SL');
    expect(html).toContain('content="noindex, follow"');
  });

  it('reports the company count in the intro', () => {
    const html = renderProvincePage(group, companies);
    expect(html).toContain('Actualmente incluye 2 sociedades con domicilio en Madrid');
  });

  it('becomes indexable once the province has at least three companies', () => {
    const html = renderProvincePage(group, [
      ...companies,
      { slug: 'tercera-sl', canonical_name: 'TERCERA SL', nif: 'B87654321' },
    ]);
    expect(html).toContain('content="index, follow"');
  });
});

describe('directory sitemap', () => {
  it('keeps one- and two-company provinces out of the indexable URL set', () => {
    const urls = directorySitemapUrls([
      { slug: 'madrid', total: 647 },
      { slug: 'ceuta', total: 2 },
      { slug: 'ourense', total: 1 },
      { slug: 'jaen', total: 3 },
    ]);
    expect(urls).toContain('https://mapasocietario.es/directorio');
    expect(urls).toContain('https://mapasocietario.es/directorio/madrid');
    expect(urls).toContain('https://mapasocietario.es/directorio/jaen');
    expect(urls).not.toContain('https://mapasocietario.es/directorio/ceuta');
    expect(urls).not.toContain('https://mapasocietario.es/directorio/ourense');
  });
});

describe('English directory hub', () => {
  const madrid = groupProvinces([{ province: 'Madrid', total: 40 }]);
  const group = { slug: 'madrid', name: 'Madrid', total: 3, variants: ['Madrid'] };
  const companies = [
    { slug: 'acme-sl', canonical_name: 'ACME SL', nif: 'B12345678' },
    { slug: 'ohara-y-cia-sl', canonical_name: "O'HARA & CÍA SL", nif: null },
    { slug: 'tercera-sl', canonical_name: 'TERCERA SL', nif: 'B87654321' },
  ];

  it('renders the index in English at its own canonical', () => {
    const html = renderDirectoryIndex(madrid, 'en');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('rel="canonical" href="https://mapasocietario.es/en/directory"');
    expect(html).toContain('content="en_GB"');
    expect(html).toContain('href="/en/directory/madrid"');
    expect(html).not.toContain('href="/directorio/madrid"');
  });

  it('links province rows to the EN company page, not the ES one', () => {
    const html = renderProvincePage(group, companies, 'en');
    expect(html).toContain('rel="canonical" href="https://mapasocietario.es/en/directory/madrid"');
    expect(html).toContain('href="/en/company/acme-sl"');
    expect(html).not.toContain('href="/empresa/acme-sl"');
    expect(html).toContain('O&#39;HARA &amp; CÍA SL');
    expect(html).toContain('content="index, follow"');
  });

  it('applies the same thin-province threshold as Spanish', () => {
    const html = renderProvincePage(group, companies.slice(0, 2), 'en');
    expect(html).toContain('content="noindex, follow"');
  });

  it('defaults to Spanish when no language is given', () => {
    expect(renderDirectoryIndex(madrid)).toContain('href="/directorio/madrid"');
    expect(renderProvincePage(group, companies)).toContain('href="/empresa/acme-sl"');
  });
});

describe('directory hreflang', () => {
  const madrid = groupProvinces([{ province: 'Madrid', total: 40 }]);
  const group = { slug: 'madrid', name: 'Madrid', total: 3, variants: ['Madrid'] };

  it('pairs the two index pages in both directions, x-default to Spanish', () => {
    for (const html of [renderDirectoryIndex(madrid, 'es'), renderDirectoryIndex(madrid, 'en')]) {
      expect(html).toContain('hreflang="es" href="https://mapasocietario.es/directorio"');
      expect(html).toContain('hreflang="en" href="https://mapasocietario.es/en/directory"');
      expect(html).toContain('hreflang="x-default" href="https://mapasocietario.es/directorio"');
    }
  });

  it('pairs province pages on the shared province slug', () => {
    const html = renderProvincePage(group, [], 'en');
    expect(html).toContain('hreflang="es" href="https://mapasocietario.es/directorio/madrid"');
    expect(html).toContain('hreflang="en" href="https://mapasocietario.es/en/directory/madrid"');
  });
});

describe('directory sitemap with both languages', () => {
  it('lists the EN hub alongside the ES one, honouring the threshold', () => {
    const urls = directorySitemapUrls([
      { slug: 'madrid', total: 647 },
      { slug: 'ceuta', total: 2 },
    ]);
    expect(urls).toContain('https://mapasocietario.es/en/directory');
    expect(urls).toContain('https://mapasocietario.es/en/directory/madrid');
    expect(urls).not.toContain('https://mapasocietario.es/en/directory/ceuta');
  });
});
