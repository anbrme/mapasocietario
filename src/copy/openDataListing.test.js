import { describe, test, expect } from 'vitest';
import {
  OPEN_DATA_LISTING_URL,
  openDataListingCopy,
  openDataListingText,
  openDataListingHtml,
} from './openDataListing';

describe('openDataListing', () => {
  test('points at the published datos.gob.es listing', () => {
    expect(OPEN_DATA_LISTING_URL).toBe('https://datos.gob.es/es/aplicaciones/mapa-societario');
  });

  test('claims inclusion in the catalogue, never endorsement', () => {
    // Arrange / Act
    const en = openDataListingText('en');
    const es = openDataListingText('es');

    // Assert — the footer already says "not endorsed by the AEBOE"; this line
    // must not contradict it.
    expect(en).toBe("Listed in the applications catalogue of datos.gob.es, the Spanish Government's open data portal.");
    expect(es).toBe('Figura en el catálogo de aplicaciones de datos.gob.es, el portal de datos abiertos del Gobierno de España.');
    for (const s of [en, es]) {
      expect(s.toLowerCase()).not.toMatch(/endorse|avalad|official partner|oficial/);
    }
  });

  test('falls back to English for an unknown language', () => {
    expect(openDataListingCopy('fr')).toBe(openDataListingCopy('en'));
  });

  test('renders the HTML form with a rel=noopener link on the portal name', () => {
    // Act
    const html = openDataListingHtml('es');

    // Assert
    expect(html).toContain(`<a href="${OPEN_DATA_LISTING_URL}" target="_blank" rel="noopener">datos.gob.es</a>`);
    expect(html.startsWith('Figura en el catálogo de aplicaciones de ')).toBe(true);
    expect(html.endsWith(', el portal de datos abiertos del Gobierno de España.')).toBe(true);
  });
});
