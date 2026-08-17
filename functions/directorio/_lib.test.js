import { describe, it, expect } from 'vitest';
import { groupProvinces, renderDirectoryIndex, renderProvincePage } from './_lib.js';

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
    expect(html).toContain('<title>Directorio de empresas por provincia');
    expect(html).toContain('rel="canonical" href="https://mapasocietario.es/directorio"');
    expect(html).toContain('content="index, follow"');
    expect(html).toContain('href="/directorio/madrid"');
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
    expect(html).toContain('<title>Empresas en Madrid: CIF, administradores y BORME');
    expect(html).toContain('rel="canonical" href="https://mapasocietario.es/directorio/madrid"');
    expect(html).toContain('href="/empresa/acme-sl"');
    expect(html).toContain('B12345678');
    expect(html).toContain('O&#39;HARA &amp; CÍA SL');
    expect(html).toContain('content="index, follow"');
  });

  it('reports the company count in the intro', () => {
    const html = renderProvincePage(group, companies);
    expect(html).toContain('2 sociedades con domicilio en Madrid');
  });
});
