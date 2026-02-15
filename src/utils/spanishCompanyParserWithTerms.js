// src/utils/spanishCompanyParserWithTerms.js - FIXED VERSION

import termsData from '../data/terms.json';

class SpanishCompanyTermsParser {
  constructor() {
    this.terms = termsData; // Load terms immediately
    this.isLoaded = true;
    this.registryPattern =
      /\b[ST]\s+\d+\s*,\s*[LFH]\s+[A-Z]*\s*\d+\s*,?\s*[SF]?\s*\d*\s*,?\s*H?\s*[A-Z]*\s*\d*\s*,?\s*I\/A\s+\d+\s*\([^)]+\)\./g;

    // Corporate event categories for timeline organization
    this.eventCategories = {
      // Lifecycle events
      lifecycle: {
        label: 'Ciclo de Vida',
        icon: 'lifecycle',
        events: [
          'Constitución',
          'Disolución',
          'Extinción',
          'Reactivación de la sociedad (Art. 242 del Reglamento del Registro Mercantil)',
          'Quiebra',
          'Suspensión de pagos',
          'Situación concursal',
        ],
      },
      // Capital events
      capital: {
        label: 'Capital Social',
        icon: 'capital',
        events: [
          'Ampliación de capital',
          'Reducción de capital',
          'Acuerdo de ampliación de capital social sin ejecutar',
          'Desembolso de dividendos pasivos',
          'Capital',
        ],
      },
      // Structural changes
      structural: {
        label: 'Cambios Estructurales',
        icon: 'structural',
        events: [
          'Fusión por absorción',
          'Fusión por unión',
          'Escisión parcial',
          'Escisión total',
          'Segregación',
          'Cesión global de activo y pasivo',
          'Transformación de sociedad',
        ],
      },
      // Identity changes
      identity: {
        label: 'Identidad de la Empresa',
        icon: 'identity',
        events: [
          'Cambio de denominación social',
          'Cambio de domicilio social',
          'Cambio de objeto social',
          'Ampliacion del objeto social',
          'Modificaciones estatutarias',
          'Página web de la sociedad',
        ],
      },
      // Governance changes
      governance: {
        label: 'Gobierno Corporativo',
        icon: 'governance',
        events: [
          'Cambio del Organo de Administración',
          'Cambio del órgano de administración',
          'Cambio del Órgano de Administración',
          'Modificación de poderes',
        ],
      },
      // Ownership changes
      ownership: {
        label: 'Propiedad',
        icon: 'ownership',
        events: [
          'Declaración de unipersonalidad',
          'Sociedad unipersonal',
          'Pérdida del carácter de unipersonalidad',
          'Pérdida del caracter de unipersonalidad',
        ],
      },
      // Officer changes
      officers: {
        label: 'Directivos',
        icon: 'officers',
        events: [
          'Nombramientos',
          'Reelecciones',
          'Ceses/Dimisiones',
          'Revocaciones',
          'Cancelaciones de oficio de nombramientos',
        ],
      },
      // Registry/Administrative
      administrative: {
        label: 'Administrativo',
        icon: 'administrative',
        events: [
          'Datos registrales',
          'Primera inscripcion (O.M. 10/6/1.997)',
          'Reapertura hoja registral',
          'Cierre provisional de hoja registral Art.485 TRLC',
          'Cierre provisional de la hoja registral por revocación del NIF',
          'Cierre provisional hoja registral art. 137.2 Ley 43/1995 Impuesto de Sociedades',
          'Cierre provisional hoja registral por baja en el índice de Entidades Jurídicas',
          'Cierre provisional hoja registral por revocación del NIF de Entidades Jurídicas',
          'Fe de erratas:',
          'Articulo 378.5 del Reglamento del Registro Mercantil',
        ],
      },
      // Other events
      other: {
        label: 'Otros',
        icon: 'other',
        events: [
          'Otros conceptos',
          'Emisión de obligaciones',
          'Crédito incobrable',
          'Anotación preventiva. Declaración de deudor fallido',
          'Anotación preventiva. Demanda de impugnación de acuerdos sociales',
          'Anotación preventiva. Solicitud de acta notarial de junta',
          'Anotación preventiva. Suspensión de acuerdos sociales impugnados',
          'Apertura de sucursal',
          'Cierre de Sucursal',
          'Sucursal',
          'Primera sucursal de sociedad extranjera',
          'Depósitos de proyectos de fusión por absorción',
          'Empresario Individual',
          'Adaptación Ley 2/95',
          'Adaptación Ley 44/2015',
          'Adaptación de sociedad',
          'Adaptada segun D.T. 2 apartado 2 Ley 2/95',
        ],
      },
    };

    // Build reverse lookup map for quick categorization
    this.eventToCategoryMap = {};
    Object.entries(this.eventCategories).forEach(([categoryKey, categoryData]) => {
      categoryData.events.forEach(event => {
        this.eventToCategoryMap[event.toLowerCase()] = {
          category: categoryKey,
          label: categoryData.label,
          icon: categoryData.icon,
        };
      });
    });
  }

  /**
   * Clean field values that come from API with leading colons/whitespace
   * The backend parser sometimes includes ": " prefix in parsed_details values
   * e.g., "capital": ": 2.452.174,00 Euros." -> "2.452.174,00 Euros."
   */
  cleanFieldValue(value) {
    if (!value || typeof value !== 'string') return value;
    // Remove leading colons, whitespace, and newlines
    return value.replace(/^[:\s\n\r]+/, '').trim();
  }

  async loadTerms(termsData = null) {
    if (termsData) {
      this.terms = termsData;
      this.isLoaded = true;
      console.log('Terms loaded:', {
        alwaysTopLevel: this.terms.alwaysTopLevel?.length || 0,
        officersPositions: this.terms.officersPositions?.length || 0,
      });
    }
  }

  /**
   * ENHANCED: Parse BORME entry with better officer extraction
   */
  parseBormeEntry(fullEntry) {
    if (!fullEntry) return { officers: [], registryData: null, categories: [] };

    console.log('=== PARSING BORME ENTRY ===');
    console.log('Full entry:', fullEntry);

    const result = {
      officers: {
        nombramientos: [],
        reelecciones: [],
        revocaciones: [],
        ceses_dimisiones: [],
      },
      registryData: null,
      categories: [],
      constitution: null,
      nameChanges: [],
      currentName: null,
      previousNames: [],
      newAddress: null, // For "Cambio de domicilio social" entries
      corporateEvents: [], // NEW: Categorized corporate events for timeline
    };

    // Extract registry data first
    const registryMatch = fullEntry.match(this.registryPattern);
    if (registryMatch) {
      result.registryData = registryMatch[0];
      console.log('Found registry data:', result.registryData);
    }

    // ENHANCED: Look for officer patterns more aggressively
    this.extractOfficersEnhanced(fullEntry, result);

    // ENHANCED: Extract company name changes
    this.extractNameChanges(fullEntry, result);

    // NEW: Extract corporate events for timeline
    result.corporateEvents = this.extractCorporateEvents(fullEntry);

    return result;
  }

  /**
   * ENHANCED: Extract officers using multiple strategies
   */
  extractOfficersEnhanced(fullEntry, result) {
    console.log('=== ENHANCED OFFICER EXTRACTION ===');

    // Strategy 1: Look for structured format with categories
    this.extractByCategories(fullEntry, result);

    // Strategy 2: Look for direct position patterns (if no structured format found)
    if (this.getTotalOfficers(result.officers) === 0) {
      console.log('No officers found in structured format, trying direct patterns...');
      this.extractByDirectPatterns(fullEntry, result);
    }

    // Strategy 3: Look for any Spanish names near position keywords (last resort)
    if (this.getTotalOfficers(result.officers) === 0) {
      console.log('No officers found in direct patterns, trying name proximity...');
      this.extractByNameProximity(fullEntry, result);
    }

    console.log('Final officers extracted:', result.officers);
  }

  /**
   * Extract by structured categories (Nombramientos, Reelecciones, etc.) - ENHANCED FOR INLINE FORMAT
   */
  extractByCategories(fullEntry, result) {
    console.log('=== ANALYZING FULL ENTRY FOR CATEGORIES ===');
    console.log('Full entry:', fullEntry);

    // ENHANCED: Handle inline format like "Ceses/Dimisiones. Adm. Solid.: NAMES. Nombramientos. Liquidador: NAMES."
    this.extractInlineOfficerCategories(fullEntry, result);

    // ALWAYS do the original section-by-section analysis as backup to catch any missed officers
    // We'll deduplicate at the end
    // ENHANCED: Smart splitting that preserves Spanish abbreviations
    const sections = this.smartSplitBormeEntry(fullEntry);

    console.log('=== ANALYZING SECTIONS ===');
    sections.forEach((section, index) => {
      console.log(`Section ${index}: "${section}"`);
    });

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      // Check if this section is a top-level category (only check against alwaysTopLevel, not constitution content patterns)
      const category = this.findTopLevelCategoryExact(section);
      if (category && !result.categories.includes(category)) {
        result.categories.push(category);
        console.log(`Found category: "${category}" in section: "${section}"`);

        // Find the next top-level category to determine how many sections to consume
        let nextCategoryIndex = sections.length; // Default to end of sections
        for (let j = i + 1; j < sections.length; j++) {
          if (this.findTopLevelCategoryExact(sections[j])) {
            nextCategoryIndex = j;
            break;
          }
        }

        const sectionsToConsume = nextCategoryIndex - i - 1;
        console.log(
          `Processing ${category}: consuming sections ${i + 1} to ${nextCategoryIndex - 1} (${sectionsToConsume} sections)`
        );

        // Handle different types of categories by consuming ALL content until next category
        if (
          ['Nombramientos', 'Reelecciones', 'Revocaciones', 'Ceses/Dimisiones'].includes(category)
        ) {
          // Officer-related categories - parse following sections for officers
          const officersData = this.parseOfficersFromSections(sections, i + 1, category);
          const categoryKey = this.getCategoryKey(category);
          result.officers[categoryKey].push(...officersData);
          console.log(`Found ${officersData.length} officers for ${category}`);
        } else if (category === 'Declaración de unipersonalidad') {
          // Special handling for "Declaración de unipersonalidad" + "Socio único"
          console.log('Found "Declaración de unipersonalidad", looking for Socio único...');
          const socioUnicoOfficers = this.parseSocioUnicoFromSections(sections, i + 1);
          result.officers.nombramientos.push(...socioUnicoOfficers);
          console.log(`Found ${socioUnicoOfficers.length} Socio único officers`);
        } else if (category === 'Constitución') {
          // Constitution information - parse ALL content until next category
          const constitution = this.parseConstitutionFromAllSections(
            sections,
            i + 1,
            nextCategoryIndex
          );
          result.constitution = constitution;
          // ALSO parse officers from constitution entries (initial administrators)
          const constitutionOfficers = this.parseOfficersFromSections(
            sections,
            i + 1,
            'Constitución'
          );
          result.officers.nombramientos.push(...constitutionOfficers);
          console.log(`Found constitution data:`, constitution);
          console.log(`Found ${constitutionOfficers.length} officers in constitution`);
        } else if (category === 'Cambio de domicilio social') {
          // Extract new address from the following section
          if (i + 1 < nextCategoryIndex && sections[i + 1]) {
            const addressSection = sections[i + 1].trim();
            // Check if it looks like an address
            if (/(?:C\/|CALLE|AVENIDA|PLAZA|PASEO|CARRETERA|AVDA|PZA)/i.test(addressSection)) {
              result.newAddress = addressSection.replace(/\.$/, '');
              console.log(
                `Found new address from Cambio de domicilio social: "${result.newAddress}"`
              );
            }
          }
        }

        // Skip ahead to the next category (or end)
        console.log(`Skipping ahead from section ${i} to section ${nextCategoryIndex - 1}`);
        i = nextCategoryIndex - 1; // -1 because the loop will increment i
      }
    }

    // Deduplicate officers within each category
    this.deduplicateOfficers(result.officers);
  }

  /**
   * NEW: Extract officers from inline format like "Ceses/Dimisiones. Adm. Solid.: NAMES. Nombramientos. Liquidador: NAMES."
   */
  extractInlineOfficerCategories(fullEntry, result) {
    console.log('=== EXTRACTING INLINE OFFICER CATEGORIES ===');

    // Officer categories we're looking for
    const officerCategories = [
      'Ceses/Dimisiones',
      'Nombramientos',
      'Reelecciones',
      'Revocaciones',
      'Constitución',
    ];

    // Create a regex pattern to find category followed by officer data
    // Pattern: Category. Position: Names. (next category or end)
    for (const category of officerCategories) {
      const categoryKey = this.getCategoryKey(category);

      // Create regex to find this category and capture everything until the next category or end
      const escapedCategory = category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const nextCategoriesPattern = officerCategories
        .filter(c => c !== category)
        .map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');

      // Pattern: Category. (content until next category or end)
      // More precise pattern that handles the specific BORME format
      // NOTE: Use \s* for "Datos registrales" to handle PDF extraction where line breaks may remove spaces
      const pattern = new RegExp(
        `${escapedCategory}\\.\\s*([^]*?)(?=\\s*(?:${nextCategoriesPattern}|Datos\\s*registrales|Disolución|Extinción|$))`,
        'gi'
      );

      let match;
      while ((match = pattern.exec(fullEntry)) !== null) {
        const categoryContent = match[1].trim();
        console.log(`Found ${category} content: "${categoryContent}"`);

        if (categoryContent) {
          result.categories.push(category);

          // Parse officers from this content
          const officers = this.parseOfficersFromInlineContent(categoryContent, category);
          result.officers[categoryKey].push(...officers);
          console.log(`Extracted ${officers.length} officers for ${category}:`, officers);
        }
      }
    }
  }

  /**
   * NEW: Parse officers from inline content like "Adm. Solid.: NURNBERG ALESSANDRO;LURATI GABRIELE"
   */
  parseOfficersFromInlineContent(content, category) {
    const officers = [];
    console.log(`=== PARSING INLINE CONTENT FOR ${category} ===`);
    console.log('Content:', content);

    // ENHANCED: Handle flexible whitespace and newlines
    // Normalize the content by collapsing multiple spaces and handling newlines
    const normalizedContent = content
      .replace(/\s+/g, ' ') // Replace multiple spaces/newlines with single space
      .trim();

    console.log('Normalized content:', normalizedContent);

    // Look for position patterns from terms.json
    const positionPatterns = this.terms.officersPositions || [];

    for (const position of positionPatterns) {
      // Create a flexible regex pattern for this position
      // Handle spaces, dots, and case variations
      const escapedPosition = position
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
        .replace(/\\\./g, '\\.?') // Make dots optional
        .replace(/\s+/g, '\\s*'); // Make spaces flexible

      // Pattern: position followed by colon, then names
      // ENHANCED: Also accept period+space or "Otros conceptos" as valid terminators
      // NOTE: Use \s* for multi-word terms to handle PDF extraction where line breaks may remove spaces
      // NOTE: Use \.(?:\s|$) to match period at end of string (not just period+whitespace)
      const pattern = new RegExp(
        `${escapedPosition}\\s*:\\s*([^.]+?)(?=\\.(?:\\s|$)|\\s*(?:${this.getOfficerCategoriesPattern()}|Otros\\s*conceptos|Datos\\s*registrales|Disolución|Extinción|$))`,
        'gi'
      );

      let match;
      while ((match = pattern.exec(normalizedContent)) !== null) {
        const namesPart = match[1].trim();
        console.log(`Found position "${position}" with names: "${namesPart}"`);

        if (namesPart && !this.isBusinessActivityDescription(namesPart)) {
          // Find the standardized officer position
          const officerPosition = this.findOfficerPosition(position);

          if (officerPosition) {
            console.log(`Valid position found: "${officerPosition}"`);

            // Split names by semicolon and clean them
            const names = namesPart
              .split(/[;,]/)
              .map(name => this.cleanOfficerName(name))
              .filter(name => name && name.length > 2 && this.isValidSpanishName(name));

            console.log(`Extracted names:`, names);

            for (const name of names) {
              officers.push({
                name: name,
                position: officerPosition,
                raw_entry: `${position}: ${namesPart}`,
                category: category,
              });
              console.log(`Added officer: ${name} - ${officerPosition} (${category})`);
            }
          }
        }
      }
    }

    // FALLBACK: If no officers found with terms.json, try the original method
    if (officers.length === 0) {
      console.log('No officers found with terms.json patterns, trying fallback method...');
      return this.parseOfficersFromInlineContentFallback(content, category);
    }

    return officers;
  }

  /**
   * Fallback method for parsing officers when terms.json patterns don't match
   */
  parseOfficersFromInlineContentFallback(content, category) {
    const officers = [];

    // Split by periods to handle multiple position:name pairs
    const parts = content
      .split('.')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    for (const part of parts) {
      console.log(`Processing fallback part: "${part}"`);

      // Skip registry data
      if (this.registryPattern.test(part)) {
        console.log('Skipping registry data');
        continue;
      }

      // Look for "Position: Names" pattern
      const colonIndex = part.indexOf(':');
      if (colonIndex > 0) {
        const positionPart = part.substring(0, colonIndex).trim();
        const namesPart = part.substring(colonIndex + 1).trim();

        console.log(`Fallback position part: "${positionPart}", Names part: "${namesPart}"`);

        // Find the officer position
        const officerPosition = this.findOfficerPosition(positionPart);

        if (officerPosition && namesPart && !this.isBusinessActivityDescription(namesPart)) {
          console.log(`Valid fallback position found: "${officerPosition}"`);

          // Split names by semicolon and clean them
          const names = namesPart
            .split(/[;,]/)
            .map(name => this.cleanOfficerName(name))
            .filter(name => name && name.length > 2 && this.isValidSpanishName(name));

          console.log(`Extracted fallback names:`, names);

          for (const name of names) {
            officers.push({
              name: name,
              position: officerPosition,
              raw_entry: part,
              category: category,
            });
            console.log(`Added fallback officer: ${name} - ${officerPosition} (${category})`);
          }
        }
      }
    }

    return officers;
  }

  /**
   * Get pattern for officer categories to use in regex lookahead
   */
  getOfficerCategoriesPattern() {
    const officerCategories = [
      'Ceses/Dimisiones',
      'Nombramientos',
      'Reelecciones',
      'Revocaciones',
      'Constitución',
    ];
    return officerCategories.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  }

  /**
   * Extract by direct position patterns (Position: Name format) - IMPROVED
   */
  extractByDirectPatterns(fullEntry, result) {
    const lines = fullEntry
      .split(/[.\n\r]/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    console.log('=== DIRECT PATTERN EXTRACTION ===');

    for (const line of lines) {
      // Skip registry data
      if (this.registryPattern.test(line)) {
        console.log('Skipping registry data:', line);
        continue;
      }

      // Skip if this line contains a top-level category
      if (this.findTopLevelCategory(line)) {
        console.log('Skipping top-level category:', line);
        continue;
      }

      // Skip business activity descriptions (CNAE codes, business descriptions)
      if (this.isBusinessActivityDescription(line)) {
        console.log('Skipping business activity description:', line);
        continue;
      }

      // Look for "Position: Name" patterns
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const positionPart = line.substring(0, colonIndex).trim();
        const namesPart = line.substring(colonIndex + 1).trim();

        // Only process if the position part looks like an officer position
        const officerPosition = this.findOfficerPosition(positionPart);

        if (officerPosition && namesPart && !this.isBusinessActivityDescription(namesPart)) {
          console.log(
            `Direct pattern found - Position: "${officerPosition}", Names: "${namesPart}"`
          );

          // Split names by semicolon and clean them
          const names = namesPart
            .split(/[;,]/)
            .map(name => this.cleanOfficerName(name))
            .filter(name => name && name.length > 2 && this.isValidSpanishName(name));

          for (const name of names) {
            result.officers.nombramientos.push({
              name: name,
              position: officerPosition,
              raw_entry: line,
              category: 'Nombramientos',
            });
            console.log(`Added officer: ${name} - ${officerPosition}`);
          }
        }
      }
    }
  }

  /**
   * Extract by name proximity to position keywords - IMPROVED
   */
  extractByNameProximity(fullEntry, result) {
    // Look for position keywords followed by potential names
    const positionKeywords = [
      'ADMINISTRADOR ÚNICO',
      'ADMINISTRADOR UNICO',
      'ADM. ÚNICO',
      'ADM. UNICO',
      'ADM.ÚNICO',
      'ADM.UNICO',
      'ADMINISTRADOR',
      'ADMINISTRADORA',
      'ADM.',
      'ADMIN.',
      'PRESIDENTE',
      'PRESIDENTA',
      'PRES.',
      'SECRETARIO',
      'SECRETARIA',
      'SECR.',
      'CONSEJERO',
      'CONSEJERA',
      'CONS.',
      'GERENTE',
      'GERENT.',
      'DIRECTOR',
      'DIRECTORA',
      'DIR.',
      'ÚNICO',
      'UNICO',
      'SOLIDARIO',
      'SOLIDARIA',
      'SOCIO ÚNICO',
      'SOCIO UNICO',
    ];

    console.log('=== PROXIMITY EXTRACTION ===');

    for (const keyword of positionKeywords) {
      // Create a more flexible regex that can handle various separators
      const regex = new RegExp(
        `\\b${keyword.replace(/\./g, '\\.')}\\b[\\s:]*([A-ZÁÉÍÓÚÑa-záéíóúñ\\s]+)`,
        'gi'
      );
      let match;

      while ((match = regex.exec(fullEntry)) !== null) {
        const potentialName = this.cleanOfficerName(match[1]);

        // Validate that this looks like a name (at least 2 words, proper length)
        if (this.isValidSpanishName(potentialName)) {
          console.log(`Proximity match - Position: "${keyword}", Name: "${potentialName}"`);

          const officerPosition = this.findOfficerPosition(keyword) || keyword;

          // Check if we already have this person to avoid duplicates
          const alreadyExists = Object.values(result.officers)
            .flat()
            .some(officer => officer.name === potentialName);

          if (!alreadyExists) {
            result.officers.nombramientos.push({
              name: potentialName,
              position: officerPosition,
              raw_entry: match[0],
              category: 'Nombramientos',
            });
            console.log(`Added officer by proximity: ${potentialName} - ${officerPosition}`);
          } else {
            console.log(`Officer ${potentialName} already exists, skipping duplicate`);
          }
        }
      }
    }
  }

  /**
   * Check if text is a business activity description (not an officer)
   */
  isBusinessActivityDescription(text) {
    if (!text) return false;

    const lowerText = text.toLowerCase();

    // Business activity indicators
    const businessKeywords = [
      'cnae',
      'actividad',
      'objeto social',
      'industria',
      'comercio',
      'servicios',
      'representación',
      'gestión',
      'asesoramiento',
      'explotación',
      'venta',
      'distribución',
      'fabricación',
      'producción',
      'construcción',
      'hostelería',
      'restaurante',
      'hotel',
      'turismo',
      'inmobiliaria',
      'consultoría',
      'ingeniería',
      'tecnología',
      'software',
      'informática',
      'telecomunicaciones',
      'transporte',
      'logística',
      'almacenamiento',
      'importación',
      'exportación',
      'mayorista',
      'minorista',
      'intermediarios',
      'corretaje',
      'mediación',
      'artículo',
      'estatutos',
      'modificación',
      'ampliación',
      'reducción',
    ];

    // Check if text contains business keywords
    const hasBusinessKeywords = businessKeywords.some(keyword => lowerText.includes(keyword));

    // Check if text contains CNAE codes
    const hasCnaeCode = /cnae\s*\d+/i.test(text);

    // Check if text is too long to be a person name (likely a description)
    const isTooLong = text.length > 100;

    // Check if text contains business description patterns
    const hasBusinessPatterns = [
      /\b(la|el|los|las)\s+(industria|comercio|venta|distribución|fabricación)/i,
      /\b(toda\s+clase\s+de|sin\s+excepción|sin\s+limitación)/i,
      /\b(actividades|operaciones|servicios|productos)\b/i,
      /\b(por\s+cuenta\s+propia|de\s+terceros)\b/i,
    ].some(pattern => pattern.test(text));

    const result = hasBusinessKeywords || hasCnaeCode || isTooLong || hasBusinessPatterns;

    if (result) {
      console.log(`Identified as business activity: "${text.substring(0, 50)}..."`);
    }

    return result;
  }

  /**
   * Validate if text looks like a Spanish name - IMPROVED
   */
  isValidSpanishName(text) {
    if (!text || text.length < 3) return false;

    // Should contain at least 2 words for a full name
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 2) return false;

    // Should not contain numbers or special characters (except Spanish accents)
    if (/[\d@#$%^&*()_+=[\]{}|\\:";'<>?,./]/.test(text)) return false;

    // Should not be too long (probably not a name if > 50 chars)
    if (text.length > 50) return false;

    // Should not contain registry data patterns
    if (this.registryPattern.test(text)) return false;

    // Should not be a position keyword itself
    const isPosition = this.terms.officersPositions.some(
      pos => pos.toUpperCase() === text.toUpperCase()
    );
    if (isPosition) return false;

    // Should not be a business activity description
    if (this.isBusinessActivityDescription(text)) return false;

    // Should not contain business-related words
    const businessWords = [
      'cnae',
      'actividad',
      'industria',
      'comercio',
      'objeto',
      'social',
      'servicios',
    ];
    const lowerText = text.toLowerCase();
    if (businessWords.some(word => lowerText.includes(word))) return false;

    // Names should start with a capital letter
    if (!/^[A-ZÁÉÍÓÚÑ]/.test(text)) return false;

    return true;
  }

  /**
   * Get total number of officers across all categories
   */
  getTotalOfficers(officers) {
    return Object.values(officers).reduce((total, category) => total + category.length, 0);
  }

  /**
   * Deduplicate officers within each category based on name and position
   */
  deduplicateOfficers(officers) {
    Object.keys(officers).forEach(category => {
      const seen = new Set();
      const originalCount = officers[category].length;

      officers[category] = officers[category].filter(officer => {
        const key = `${officer.name}-${officer.position}`;
        if (seen.has(key)) {
          console.log(
            `Removing duplicate officer in ${category}: ${officer.name} - ${officer.position}`
          );
          return false;
        }
        seen.add(key);
        return true;
      });

      const finalCount = officers[category].length;
      if (originalCount !== finalCount) {
        console.log(`Deduplicated ${category}: ${originalCount} -> ${finalCount} officers`);
      }
    });
  }

  /**
   * Find top-level category - EXACT matches only (no constitution content patterns)
   */
  findTopLevelCategoryExact(section) {
    if (!this.terms) return null;

    const cleanSection = section.trim();
    console.log(`Checking if "${cleanSection}" is an EXACT top-level category...`);

    // Only try exact match against alwaysTopLevel terms
    let match = this.terms.alwaysTopLevel.find(
      category => cleanSection === category || cleanSection.toLowerCase() === category.toLowerCase()
    );

    if (match) {
      console.log(`Found EXACT top-level category: "${match}"`);
      return match;
    }

    console.log(`"${cleanSection}" is NOT an exact top-level category`);
    return null;
  }

  /**
   * Find top-level category in a section - FIXED (with constitution content patterns)
   */
  findTopLevelCategory(section) {
    if (!this.terms) return null;

    const cleanSection = section.trim();
    console.log(`Checking if "${cleanSection}" is a top-level category...`);

    // Special handling for constitution content that might be parsed as separate sections
    if (
      /^Comienzo de operaciones\s*:/i.test(cleanSection) ||
      /^Domicilio\s*:/i.test(cleanSection) ||
      /^Capital\s*:/i.test(cleanSection) ||
      /^Objeto social\s*:/i.test(cleanSection)
    ) {
      console.log(
        `"${cleanSection}" appears to be constitution content, treating as "Constitución"`
      );
      return 'Constitución';
    }

    // Try exact match first
    let match = this.terms.alwaysTopLevel.find(
      category => cleanSection === category || cleanSection.toLowerCase() === category.toLowerCase()
    );

    if (match) {
      console.log(`Found EXACT top-level category: "${match}"`);
      return match;
    }

    // For partial matches, be more intelligent about it
    // Check if the section CONTAINS any of the top-level categories
    match = this.terms.alwaysTopLevel.find(category => {
      const categoryLower = category.toLowerCase();
      const sectionLower = cleanSection.toLowerCase();

      // Check if section contains the category
      if (sectionLower.includes(categoryLower)) {
        console.log(
          `Found CONTAINS match: section "${cleanSection}" contains category "${category}"`
        );
        return true;
      }

      // For "Modificaciones estatutarias", also check for variations
      if (
        category === 'Modificaciones estatutarias' &&
        (sectionLower.includes('modificacion') || sectionLower.includes('estatutaria'))
      ) {
        console.log(
          `Found STATUTORY modification match: "${category}" in section "${cleanSection}"`
        );
        return true;
      }

      // For "Ampliacion del objeto social", check variations
      if (
        category === 'Ampliacion del objeto social' &&
        sectionLower.includes('ampliacion') &&
        sectionLower.includes('objeto')
      ) {
        console.log(`Found OBJECT EXPANSION match: "${category}" in section "${cleanSection}"`);
        return true;
      }

      // For "Cambio de objeto social", check variations
      if (
        category === 'Cambio de objeto social' &&
        sectionLower.includes('cambio') &&
        sectionLower.includes('objeto')
      ) {
        console.log(`Found OBJECT CHANGE match: "${category}" in section "${cleanSection}"`);
        return true;
      }

      return false;
    });

    if (match) {
      console.log(`Found top-level category: "${match}" in section: "${cleanSection}"`);
      return match;
    }

    console.log(`No top-level category found for: "${cleanSection}"`);
    return null;
  }

  /**
   * Parse officers from text (not sections)
   */
  parseOfficersFromText(text, category) {
    const officers = [];

    // Look for officer position patterns in the text
    const lines = text
      .split(/[.\n\r]/)
      .map(l => l.trim())
      .filter(l => l.length > 5);

    for (const line of lines) {
      // Skip registry data and business descriptions
      if (this.registryPattern.test(line) || this.isBusinessActivityDescription(line)) continue;

      // Look for "Position: Name" patterns
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const positionPart = line.substring(0, colonIndex).trim();
        const namesPart = line.substring(colonIndex + 1).trim();

        const officerPosition = this.findOfficerPosition(positionPart);

        if (officerPosition && namesPart && !this.isBusinessActivityDescription(namesPart)) {
          const names = namesPart
            .split(/[;,]/)
            .map(name => this.cleanOfficerName(name))
            .filter(name => name && name.length > 2 && this.isValidSpanishName(name));

          for (const name of names) {
            officers.push({
              name: name,
              position: officerPosition,
              raw_entry: line,
              category: category,
            });
          }
        }
      }
    }

    return officers;
  }

  /**
   * Extract Socio único from text
   */
  extractSocioUnicoFromText(text) {
    const officers = [];

    // Look for "Socio único" patterns
    const socioPatterns = [/Socio\s+[uú]nico\s*:\s*([^.]+)/i, /Socio\s+[uú]nico\s+([^.]+)/i];

    for (const pattern of socioPatterns) {
      const match = text.match(pattern);
      if (match) {
        const socioName = this.cleanOfficerName(match[1]);
        if (socioName && this.isValidSpanishName(socioName)) {
          officers.push({
            name: socioName,
            position: 'Socio único',
            raw_entry: match[0],
            category: 'Declaración de unipersonalidad',
          });
          break; // Only one per declaration
        }
      }
    }

    return officers;
  }

  /**
   * Parse constitution from text
   */
  parseConstitutionFromText(text) {
    const info = {};

    // Extract various constitution details from text
    const dateMatch = text.match(/Comienzo de operaciones\s*:\s*(\d{2}\.\d{2}\.\d{2,4})/);
    if (dateMatch) info.constitution_date = dateMatch[1];

    const addressMatch = text.match(/Domicilio:\s*(.*?)(?=\s*\.?\s*Capital:|$)/i);
    if (addressMatch) info.address = addressMatch[1].trim().replace(/\.$/, '');

    // Enhanced capital extraction - handle various patterns including capital increases
    let capitalMatch = text.match(
      /Capital:\s*([\d.,]+\s*Euros?)(?=\s*\.?\s*(?:Nombramientos|Declaración|Resultante|\.|$))/i
    );
    if (capitalMatch) {
      let capital = capitalMatch[1].trim();
      if (!capital.toLowerCase().includes('euros')) {
        capital += ' Euros';
      }
      info.capital = capital;
    }

    // Check for resultante capital (after capital increases)
    const resultanteMatch = text.match(/Resultante Suscrito:\s*([\d.,]+\s*Euros?)/i);
    if (resultanteMatch) {
      info.total_capital = resultanteMatch[1];
    }

    const activityMatch = text.match(/Objeto social:\s*(.*?)(?=\s*\.?\s*Domicilio:|$)/i);
    if (activityMatch) info.activity = activityMatch[1].trim().replace(/\.$/, '');

    const cnaeMatch = text.match(/CNAE ACTIVIDAD PRINCIPAL ES EL\s*(\d+)/i);
    if (cnaeMatch) info.cnae_code = cnaeMatch[1];

    return info;
  }

  /**
   * Parse officers from sections following a category (with count)
   */
  parseOfficersFromSectionsWithCount(sections, startIndex, category) {
    const officers = [];
    let consumed = 0;

    for (let i = startIndex; i < sections.length && i < startIndex + 5; i++) {
      const section = sections[i];

      // Skip if this looks like registry data
      if (this.registryPattern.test(section)) break;

      // Skip if this is another category
      if (this.findTopLevelCategory(section)) break;

      // Parse officers from this section
      const sectionOfficers = this.parseOfficersFromSection(section, category);
      officers.push(...sectionOfficers);
      consumed++;
    }

    return { officers, consumed };
  }

  /**
   * Parse officers from sections following a category (original)
   */
  parseOfficersFromSections(sections, startIndex, category) {
    const officers = [];

    for (let i = startIndex; i < sections.length && i < startIndex + 5; i++) {
      const section = sections[i];

      // Skip if this looks like registry data
      if (this.registryPattern.test(section)) break;

      // Skip if this is another category
      if (this.findTopLevelCategory(section)) break;

      // Parse officers from this section
      const sectionOfficers = this.parseOfficersFromSection(section, category);
      officers.push(...sectionOfficers);
    }

    return officers;
  }

  /**
   * Parse "Socio unico" from sections following "Declaración de unipersonalidad" - IMPROVED (with count)
   */
  parseSocioUnicoFromSectionsWithCount(sections, startIndex) {
    const officers = [];
    let consumed = 0;

    console.log(`=== LOOKING FOR SOCIO ÚNICO starting from section ${startIndex} ===`);

    // Look through the next few sections for "Socio unico" data
    for (let i = startIndex; i < sections.length && i < startIndex + 5; i++) {
      const section = sections[i];
      console.log(`Checking section ${i} for Socio único: "${section}"`);

      // Skip if this looks like registry data
      if (this.registryPattern.test(section)) {
        console.log('Skipping registry data section');
        break;
      }

      // Skip if this is another top-level category
      if (this.findTopLevelCategory(section)) {
        console.log('Found another category, stopping Socio único search');
        break;
      }

      // Look for Socio unico patterns
      const socioUnicoMatch = section.match(/Socio\s+único?:?\s*([A-ZÁÉÍÓÚÑÜ\s,;]+)(?:\.|$)/i);
      if (socioUnicoMatch) {
        const namesPart = socioUnicoMatch[1].trim();
        console.log('Found Socio único match:', namesPart);

        // Split names by semicolon and clean them
        const names = namesPart
          .split(/[;,]/)
          .map(name => this.cleanOfficerName(name))
          .filter(name => name && name.length > 2 && this.isValidSpanishName(name));

        for (const name of names) {
          officers.push({
            name: name,
            position: 'Socio único',
            category: 'nombramientos',
          });
          console.log(`Added Socio único: ${name}`);
        }
      }

      consumed++;
    }

    return { officers, consumed };
  }

  /**
   * Parse "Socio unico" from sections following "Declaración de unipersonalidad" - IMPROVED (original)
   */
  parseSocioUnicoFromSections(sections, startIndex) {
    const officers = [];

    console.log(`=== LOOKING FOR SOCIO ÚNICO starting from section ${startIndex} ===`);

    // Look through the next few sections for "Socio unico" data
    for (let i = startIndex; i < sections.length && i < startIndex + 5; i++) {
      const section = sections[i];
      console.log(`Checking section ${i} for Socio único: "${section}"`);

      // Skip if this looks like registry data
      if (this.registryPattern.test(section)) {
        console.log('Skipping registry data section');
        break;
      }

      // Skip if this is another top-level category
      if (this.findTopLevelCategory(section)) {
        console.log('Found another category, stopping Socio único search');
        break;
      }

      // Look for "Socio unico:" pattern (case insensitive and flexible spacing)
      // Also handle variations like "Socio único" with accent
      const socioPatterns = [
        /Socio\s+[uú]nico\s*:\s*(.+)/i,
        /Socio\s+[uú]nico\s+(.+)/i,
        // Handle cases where the name comes directly after "Socio único" without colon
      ];

      for (const pattern of socioPatterns) {
        const socioMatch = section.match(pattern);
        if (socioMatch) {
          const socioName = this.cleanOfficerName(socioMatch[1]);
          console.log(`Found Socio único match: "${socioName}" from "${socioMatch[1]}"`);

          if (socioName && socioName.length > 2 && this.isValidSpanishName(socioName)) {
            officers.push({
              name: socioName,
              position: 'Socio único',
              raw_entry: section,
              category: 'Declaración de unipersonalidad',
            });
            console.log(`Added Socio único: ${socioName}`);
            return officers; // Found one, stop looking
          }
        }
      }

      // Also check if the entire section could be a name after "Declaración de unipersonalidad"
      // Sometimes the format is: "Declaración de unipersonalidad. PERSON NAME"
      if (i === startIndex) {
        // Only check the first section after the category
        const potentialName = this.cleanOfficerName(section);
        if (
          potentialName &&
          this.isValidSpanishName(potentialName) &&
          !this.findTopLevelCategory(section) &&
          !this.registryPattern.test(section)
        ) {
          console.log(`Potential Socio único name found in first section: "${potentialName}"`);
          officers.push({
            name: potentialName,
            position: 'Socio único',
            raw_entry: section,
            category: 'Declaración de unipersonalidad',
          });
          console.log(`Added Socio único from direct section: ${potentialName}`);
          return officers;
        }
      }
    }

    console.log('No Socio único found in sections');
    return officers;
  }

  /**
   * Parse officers from a single section
   */
  parseOfficersFromSection(section, category) {
    const officers = [];

    // Look for pattern: Position: Names
    const colonIndex = section.indexOf(':');
    if (colonIndex === -1) return officers;

    const positionPart = section.substring(0, colonIndex).trim();
    const namesPart = section.substring(colonIndex + 1).trim();

    // Find the officer position in terms.json
    const officerPosition = this.findOfficerPosition(positionPart);

    if (officerPosition && namesPart) {
      // Split names by semicolon and clean them
      const names = namesPart
        .split(/[;,]/)
        .map(name => this.cleanOfficerName(name))
        .filter(name => name && name.length > 2);

      console.log(`Position: ${officerPosition}, Names:`, names);

      // Create officer objects
      for (const name of names) {
        if (this.isValidSpanishName(name)) {
          officers.push({
            name: name,
            position: officerPosition,
            raw_entry: section,
            category: category,
          });
        }
      }
    }

    return officers;
  }

  /**
   * Find officer position from terms.json - ENHANCED FOR SPANISH ABBREVIATIONS
   */
  findOfficerPosition(positionText) {
    if (!this.terms) {
      console.log('No terms loaded, using fallback patterns');
      return this.findOfficerPositionFallback(positionText);
    }

    const cleanText = positionText
      .trim()
      .replace(/[:\s]+$/, '')
      .toUpperCase();
    console.log(`Looking for position: "${positionText}" -> cleaned: "${cleanText}"`);

    // Also try version without trailing period for matching
    const cleanTextNoPeriod = cleanText.replace(/\.$/, '');
    console.log(`Also trying without period: "${cleanTextNoPeriod}"`);

    // Log what we have in terms.json for debugging
    if (cleanText.includes('MANCOM')) {
      console.log('=== DEBUGGING MANCOM MATCHING ===');
      console.log('Looking for variations of MANCOM...');
      const mancomunadoTerms = this.terms.officersPositions.filter(pos =>
        pos.toUpperCase().includes('MANCOM')
      );
      console.log('Found MANCOM terms in database:', mancomunadoTerms);
      console.log('Exact comparisons:');
      mancomunadoTerms.forEach(term => {
        const termUpper = term.toUpperCase();
        console.log(
          `  "${termUpper}" === "${cleanText.toUpperCase()}" ? ${termUpper === cleanText.toUpperCase()}`
        );
        console.log(
          `  "${termUpper}" === "${cleanTextNoPeriod.toUpperCase()}" ? ${termUpper === cleanTextNoPeriod.toUpperCase()}`
        );
      });
    }

    // Skip if this looks like business activity
    if (this.isBusinessActivityDescription(positionText)) {
      console.log('Rejected as business activity:', positionText);
      return null;
    }

    // Try exact match first - check both with and without trailing period
    let exactMatch = this.terms.officersPositions.find(pos => {
      const posUpper = pos.toUpperCase();
      const cleanUpper = cleanText.toUpperCase();
      const cleanNoPeriodUpper = cleanTextNoPeriod.toUpperCase();

      return (
        posUpper === cleanUpper ||
        posUpper === cleanNoPeriodUpper ||
        posUpper === cleanUpper.replace(/\s+/g, ' ') || // Normalize spaces
        posUpper === cleanNoPeriodUpper.replace(/\s+/g, ' ')
      );
    });

    if (exactMatch) {
      console.log(`Found exact match: "${exactMatch}"`);
      return exactMatch;
    }

    // Try common Spanish abbreviations and patterns
    const commonPatterns = {
      'ADM. SOLID.': 'Administrador Solidario',
      'ADM SOLID': 'Administrador Solidario',
      'ADM. MANCOM.': 'Administrador Mancomunado',
      'ADM MANCOM': 'Administrador Mancomunado',
      'ADM. MANCO.': 'Administrador Mancomunado',
      'ADM MANCO': 'Administrador Mancomunado',
      'ADM. ÚNICO': 'Administrador Único',
      'ADM UNICO': 'Administrador Único',
      'ADM.': 'Administrador',
      ADMINISTRADOR: 'Administrador',
      LIQUIDADOR: 'Liquidador',
      PRESIDENTE: 'Presidente',
      SECRETARIO: 'Secretario',
      CONSEJERO: 'Consejero',
      GERENTE: 'Gerente',
      DIRECTOR: 'Director',
      APODERADO: 'Apoderado',
      'APODER.': 'Apoderado',
      APODER: 'Apoderado',
      'SOCIO ÚNICO': 'Socio Único',
      'SOCIO UNICO': 'Socio Único',
    };

    // Check common patterns
    for (const [pattern, position] of Object.entries(commonPatterns)) {
      if (cleanText === pattern || cleanText.includes(pattern)) {
        console.log(`Found common pattern match: "${pattern}" -> "${position}"`);
        return position;
      }
    }

    // Try partial match for terms.json positions
    const partialMatch = this.terms.officersPositions.find(pos => {
      const posUpper = pos.toUpperCase();
      // Only allow partial matches for very specific patterns
      return (
        (cleanText.includes(posUpper) && posUpper.length > 3) ||
        (posUpper.includes(cleanText) && cleanText.length > 3)
      );
    });

    if (partialMatch) {
      console.log(`Found partial match: "${partialMatch}"`);
      return partialMatch;
    }

    // Fallback to common patterns
    const fallback = this.findOfficerPositionFallback(positionText);
    if (fallback) {
      console.log(`Found fallback match: "${fallback}"`);
      return fallback;
    }

    console.log(`No valid officer position found for: "${positionText}"`);
    return null;
  }

  /**
   * NEW: Fallback position finder for when terms.json is not available
   */
  findOfficerPositionFallback(positionText) {
    const cleanText = positionText
      .trim()
      .replace(/[.:\s]+$/, '')
      .toUpperCase();

    // Common Spanish officer positions and their abbreviations
    const fallbackPatterns = [
      { pattern: /ADM\.?\s*SOLID\.?/i, position: 'Administrador Solidario' },
      { pattern: /ADM\.?\s*MANCOM\.?/i, position: 'Administrador Mancomunado' },
      { pattern: /ADM\.?\s*MANCO\.?/i, position: 'Administrador Mancomunado' },
      { pattern: /ADM\.?\s*[UÚ]NICO\.?/i, position: 'Administrador Único' },
      { pattern: /^ADM\.?$/i, position: 'Administrador' },
      { pattern: /ADMINISTRADOR/i, position: 'Administrador' },
      { pattern: /LIQUIDADOR/i, position: 'Liquidador' },
      { pattern: /PRESIDENTE/i, position: 'Presidente' },
      { pattern: /SECRETARIO/i, position: 'Secretario' },
      { pattern: /CONSEJERO/i, position: 'Consejero' },
      { pattern: /GERENTE/i, position: 'Gerente' },
      { pattern: /DIRECTOR/i, position: 'Director' },
      { pattern: /APODERADO/i, position: 'Apoderado' },
      { pattern: /APODER\.?/i, position: 'Apoderado' },
      { pattern: /SOCIO\s+[UÚ]NICO/i, position: 'Socio Único' },
    ];

    for (const { pattern, position } of fallbackPatterns) {
      if (pattern.test(cleanText)) {
        return position;
      }
    }

    return null;
  }

  /**
   * Clean officer name - ENHANCED to remove common BORME terms that shouldn't be part of names
   */
  cleanOfficerName(name) {
    if (!name) return '';

    // Common BORME terms/suffixes that shouldn't be part of officer names
    const bormeTermsToRemove = [
      'ESTATUTARIAS',
      'ESTATUTARIOS',
      'NOMBRAMIENTOS',
      'REELECCIONES',
      'CESES',
      'DIMISIONES',
      'REVOCACIONES',
      'OTROS CONCEPTOS',
      'DATOS REGISTRALES',
      'CONSTITUCION',
      'CONSTITUCIÓN',
      'DISOLUCION',
      'DISOLUCIÓN',
      'AMPLIACION',
      'AMPLIACIÓN',
      'REDUCCION',
      'REDUCCIÓN',
      'LIQUIDADOR',
      'LIQUIDADORES',
    ];

    let cleaned = name
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();

    // Remove BORME terms that appear at the end or as standalone
    for (const term of bormeTermsToRemove) {
      // Remove term if it appears after a period at the end
      cleaned = cleaned.replace(new RegExp(`\\.\\s*${term}\\s*\\.?\\s*$`, 'i'), '');
      // Remove term if it appears at the end without period
      cleaned = cleaned.replace(new RegExp(`\\s+${term}\\s*\\.?\\s*$`, 'i'), '');
    }

    // Final cleanup
    return cleaned
      .replace(/[.;,]+$/, '') // Remove trailing punctuation
      .replace(/^\s*[-–—]\s*/, '') // Remove leading dashes
      .trim();
  }

  /**
   * Parse constitution information from sections - ENHANCED TO ALSO IDENTIFY OFFICERS (with count)
   */
  parseConstitutionFromSectionsWithCount(sections, startIndex) {
    const info = {};
    let consumed = 0;

    console.log(`=== PARSING CONSTITUTION from section ${startIndex} ===`);

    for (let i = startIndex; i < sections.length && i < startIndex + 10; i++) {
      const section = sections[i];

      // Stop if we hit another top-level category
      if (this.findTopLevelCategory(section)) break;

      // Stop if we hit registry data
      if (this.registryPattern.test(section)) break;

      console.log(`Constitution section ${i}: "${section}"`);

      // Extract various constitution details
      const dateMatch = section.match(/Comienzo de operaciones\s*:\s*(\d{1,2}\.\d{1,2}\.\d{2,4})/);
      if (dateMatch) {
        info.constitution_date = dateMatch[1];
        console.log('Found constitution date:', info.constitution_date);
      }

      const addressMatch = section.match(/Domicilio:\s*(.*?)(?=\s*\.?\s*Capital:|$)/i);
      if (addressMatch) {
        info.address = addressMatch[1].trim().replace(/\.$/, '');
        console.log('Found address:', info.address);
      }

      // Enhanced capital extraction - handle various patterns including capital increases
      let capitalMatch = section.match(
        /Capital:\s*([\d.,]+\s*Euros?)(?=\s*\.?\s*(?:Nombramientos|Declaración|Resultante|\.|$))/i
      );
      if (capitalMatch) {
        let capital = capitalMatch[1].trim();
        if (!capital.toLowerCase().includes('euros')) {
          capital += ' Euros';
        }
        info.capital = capital;
        console.log('Found capital:', info.capital);
      }

      const activityMatch = section.match(
        /Objeto social:\s*(.*?)(?=\s*\.?\s*(?:Domicilio:|Capital:|Nombramientos|Declaración|\.|$))/i
      );
      if (activityMatch) {
        info.activity = activityMatch[1].trim().replace(/\.$/, '');
        console.log('Found activity:', info.activity);
      }

      // Look for CNAE codes
      const cnaeMatch = section.match(/CNAE:\s*(\d+)/i);
      if (cnaeMatch) {
        info.cnae_code = cnaeMatch[1];
        console.log('Found CNAE code:', info.cnae_code);
      }

      consumed++;
    }

    return { constitution: info, consumed };
  }

  /**
   * Parse constitution information from ALL sections until next category
   */
  parseConstitutionFromAllSections(sections, startIndex, endIndex) {
    const info = {};

    console.log(`=== PARSING CONSTITUTION from sections ${startIndex} to ${endIndex - 1} ===`);

    // Combine all sections between categories into one text block
    const allConstitutionText = sections.slice(startIndex, endIndex).join(' ');
    console.log('Combined constitution text:', allConstitutionText);

    // Extract various constitution details from the combined text
    const dateMatch = allConstitutionText.match(
      /Comienzo de operaciones\s*:\s*(\d{1,2}\.\d{1,2}\.\d{2,4})/
    );
    if (dateMatch) {
      info.constitution_date = dateMatch[1];
      console.log('Found constitution date:', info.constitution_date);
    }

    const addressMatch = allConstitutionText.match(/Domicilio:\s*(.*?)(?=\s*\.?\s*Capital:|$)/i);
    if (addressMatch) {
      info.address = addressMatch[1].trim().replace(/\.$/, '');
      console.log('Found address:', info.address);
    }

    // Enhanced capital extraction - handle various patterns including capital increases
    console.log('Searching for capital in text:', allConstitutionText);

    // Try multiple capital patterns
    let capitalMatch =
      allConstitutionText.match(
        /Capital:\s*([\d.,]+\s*Euros?)(?=\s*\.?\s*(?:Nombramientos|Declaración|Resultante|\.|$))/i
      ) ||
      allConstitutionText.match(/Capital:\s*([\d.,]+)\s*Euros?/i) ||
      allConstitutionText.match(/Capital:\s*([\d.,]+)/i);

    if (capitalMatch) {
      let capital = capitalMatch[1].trim();
      if (!capital.toLowerCase().includes('euros') && !capital.toLowerCase().includes('euro')) {
        capital += ' Euros';
      }
      info.capital = capital;
      console.log('Found capital:', info.capital);
    } else {
      console.log('NO CAPITAL MATCH FOUND in:', allConstitutionText);
    }

    const activityMatch = allConstitutionText.match(
      /Objeto social:\s*(.*?)(?=\s*\.?\s*(?:Domicilio:|Capital:|Nombramientos|Declaración|\.|$))/i
    );
    if (activityMatch) {
      info.activity = activityMatch[1].trim().replace(/\.$/, '');
      console.log('Found activity:', info.activity);
    }

    // Look for CNAE codes
    const cnaeMatch = allConstitutionText.match(/CNAE:\s*(\d+)/i);
    if (cnaeMatch) {
      info.cnae_code = cnaeMatch[1];
      console.log('Found CNAE code:', info.cnae_code);
    }

    return info;
  }

  /**
   * Parse constitution information from sections - ENHANCED TO ALSO IDENTIFY OFFICERS (original)
   */
  parseConstitutionFromSections(sections, startIndex) {
    const info = {};

    console.log(`=== PARSING CONSTITUTION from section ${startIndex} ===`);

    for (let i = startIndex; i < sections.length && i < startIndex + 10; i++) {
      const section = sections[i];

      // Stop if we hit another top-level category
      if (this.findTopLevelCategory(section)) break;

      // Stop if we hit registry data
      if (this.registryPattern.test(section)) break;

      console.log(`Constitution section ${i}: "${section}"`);

      // Extract various constitution details
      const dateMatch = section.match(/Comienzo de operaciones\s*:\s*(\d{1,2}\.\d{1,2}\.\d{2,4})/);
      if (dateMatch) {
        info.constitution_date = dateMatch[1];
        console.log('Found constitution date:', info.constitution_date);
      }

      const addressMatch = section.match(/Domicilio:\s*(.*?)(?=\s*\.?\s*Capital:|$)/i);
      if (addressMatch) {
        info.address = addressMatch[1].trim().replace(/\.$/, '');
        console.log('Found address:', info.address);
      }

      // Enhanced capital extraction - handle various patterns including capital increases
      let capitalMatch = section.match(
        /Capital:\s*([\d.,]+\s*Euros?)(?=\s*\.?\s*(?:Nombramientos|Declaración|Resultante|\.|$))/i
      );
      if (capitalMatch) {
        let capital = capitalMatch[1].trim();
        if (!capital.toLowerCase().includes('euros')) {
          capital += ' Euros';
        }
        info.capital = capital;
        console.log('Found capital:', info.capital);
      }

      // Check for resultante capital (after capital increases)
      const resultanteMatch = section.match(/Resultante Suscrito:\s*([\d.,]+\s*Euros?)/i);
      if (resultanteMatch) {
        info.total_capital = resultanteMatch[1];
        console.log('Found total capital after increase:', info.total_capital);
      }

      const activityMatch = section.match(/Objeto social:\s*(.*?)(?=\s*\.?\s*Domicilio:|$)/i);
      if (activityMatch) {
        info.activity = activityMatch[1].trim().replace(/\.$/, '');
        console.log('Found activity:', info.activity);
      }

      // Enhanced CNAE code extraction
      const cnaeMatch = section.match(/CNAE[.\s]*(\d+\.\d+)/i);
      if (cnaeMatch) {
        info.cnae_code = cnaeMatch[1];
        console.log('Found CNAE code:', info.cnae_code);
      }

      // ENHANCED: Look for embedded officer information in constitution sections
      // Constitution entries often contain initial administrator appointments
      const hasOfficerPatterns = [
        /administrador/i,
        /presidente/i,
        /secretario/i,
        /consejero/i,
        /gerente/i,
        /apoderado/i,
        /liquidador/i,
        /socio\s+único/i,
      ];

      const hasOfficerInfo = hasOfficerPatterns.some(pattern => pattern.test(section));
      if (hasOfficerInfo) {
        console.log(`Constitution section ${i} contains officer information: "${section}"`);
        info.hasOfficerInfo = true;

        // Store the section for officer parsing
        if (!info.officerSections) info.officerSections = [];
        info.officerSections.push(section);
      }
    }

    console.log('Constitution parsing result:', info);
    return info;
  }

  /**
   * Smart splitting of BORME entries that preserves Spanish abbreviations
   */
  smartSplitBormeEntry(fullEntry) {
    // List of common Spanish abbreviations that should not be split
    const abbreviations = [
      'ADM',
      'ADMIN',
      'APOD',
      'APODER',
      'CONS',
      'CONSJ',
      'CONSEJERO',
      'PRES',
      'PRESID',
      'PRESIDENT',
      'SEC',
      'SECR',
      'SECRETARIO',
      'TES',
      'TESOR',
      'TESORERO',
      'VICE',
      'VICEPR',
      'VICEPRES',
      'DIR',
      'DTOR',
      'DIRECTOR',
      'GER',
      'GERENTE',
      'LIQ',
      'LIQUID',
      'MANCOM',
      'MANCO',
      'SOLID',
      'SOLIDA',
      'SOLIDAR',
      'UNICO',
      'ÚNICO',
    ];

    // Protect various patterns that contain periods
    let protectedText = fullEntry;
    const placeholders = [];

    // 1. Protect Spanish abbreviations
    const abbrevPattern = new RegExp(`\\b(${abbreviations.join('|')})\\.( *)`, 'gi');
    protectedText = protectedText.replace(abbrevPattern, match => {
      const placeholder = `###PLACEHOLDER${placeholders.length}###`;
      placeholders.push(match);
      return placeholder;
    });

    // 2. Protect dates (DD.MM.YY or DD.MM.YYYY format)
    const datePattern = /\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g;
    protectedText = protectedText.replace(datePattern, match => {
      const placeholder = `###PLACEHOLDER${placeholders.length}###`;
      placeholders.push(match);
      return placeholder;
    });

    // 3. Protect registry data (S 8 , H A 200035, I/A 1 (29.08.25).)
    const registryPattern = /[ST]\s+\d+\s*,\s*[LFH]\s+[A-Z]*\s*\d+[^.]*\([^)]*\)\./g;
    protectedText = protectedText.replace(registryPattern, match => {
      const placeholder = `###PLACEHOLDER${placeholders.length}###`;
      placeholders.push(match);
      return placeholder;
    });

    // 4. Protect decimal numbers (3.000,00 format)
    const decimalPattern = /\b\d{1,3}(?:\.\d{3})*,\d{2}\b/g;
    protectedText = protectedText.replace(decimalPattern, match => {
      const placeholder = `###PLACEHOLDER${placeholders.length}###`;
      placeholders.push(match);
      return placeholder;
    });

    console.log('=== SMART SPLITTING DEBUG ===');
    console.log('Original text sample:', fullEntry.substring(0, 300) + '...');
    console.log('Protected text sample:', protectedText.substring(0, 300) + '...');
    console.log('Protected', placeholders.length, 'patterns');
    placeholders.forEach((pattern, index) => {
      console.log(`Protected pattern ${index}: "${pattern}"`);
    });

    // Now split on remaining periods
    const sections = protectedText
      .split('.')
      .map(s => {
        // Restore all protected patterns
        let restored = s.trim();
        placeholders.forEach((original, index) => {
          restored = restored.replace(`###PLACEHOLDER${index}###`, original);
        });
        return restored;
      })
      .filter(s => s.length > 0);

    console.log('Smart split resulted in', sections.length, 'sections');

    return sections;
  }

  /**
   * Convert category to object key
   */
  getCategoryKey(category) {
    const map = {
      Nombramientos: 'nombramientos',
      Reelecciones: 'reelecciones',
      Revocaciones: 'revocaciones',
      'Ceses/Dimisiones': 'ceses_dimisiones',
      Constitución: 'nombramientos', // Constitution officers are treated as appointments
    };
    return map[category] || 'nombramientos';
  }

  /**
   * Main parsing function - ENHANCED
   */
  /**
   * Main parsing function - ENHANCED
   */
  parseSpanishCompanyData(rawData) {
    console.log('=== PARSING SPANISH COMPANY DATA ===');
    console.log('Raw data:', rawData);

    // First, try to extract the actual company name from various sources
    let companyName = null;

    // Priority 1: Extract from full_entry if we have it (most reliable source)
    if (rawData.full_entry) {
      // Pattern to extract company name from entries like "127261 – EXPLORA CONSULTING SL(2007)."
      // This captures everything up to the first period, including & characters
      const nameMatch = rawData.full_entry.match(/^\d+\s*[-–—]\s*([^.\n]+?)(?:\s*\(\d{4}\))?\.?$/m);
      if (nameMatch && nameMatch[1]) {
        companyName = nameMatch[1].trim();
        console.log('Extracted company name from full_entry:', companyName);
      }
    }

    // Priority 2: Direct name field (but verify it's not truncated)
    if (!companyName && rawData.name && rawData.name !== 'Empresa Española') {
      companyName = rawData.name;
      console.log('Found company name in name field:', companyName);

      // WORKAROUND: If name ends with & and we have full_entry, try to get the complete name
      if (companyName.endsWith(' &') && rawData.full_entry) {
        const fullMatch = rawData.full_entry.match(
          /^\d+\s*[-–—]\s*([^.\n]+?)(?:\s*\(\d{4}\))?\.?$/m
        );
        if (fullMatch && fullMatch[1]) {
          const fullName = fullMatch[1].trim();
          if (fullName.length > companyName.length) {
            console.log(
              `⚠️ Detected truncated name "${companyName}", using full name from entry: "${fullName}"`
            );
            companyName = fullName;
          }
        }
      }
    }

    // Priority 3: From highlights if available
    if (!companyName && rawData.highlights?.company_name) {
      // Remove HTML tags from highlighted name
      companyName = rawData.highlights.company_name.replace(/<[^>]*>/g, '').trim();
      console.log('Found company name in highlights:', companyName);
    }

    // Priority 4: Other fields
    if (!companyName) {
      companyName =
        rawData.company_name ||
        rawData.parsed?.company_name ||
        rawData.parsed_details?.company_name ||
        'Empresa Española'; // Only use as last resort
    }

    const result = {
      company_name: companyName,
      identifier: rawData.identifier,
      cif: null,
      address: null,
      activity: null,
      capital: null,
      total_capital: null, // For capital increases
      cnae_code: null,
      constitution_date: null,
      registry_data: null,
      officers: {
        nombramientos: [],
        reelecciones: [],
        revocaciones: [],
        ceses_dimisiones: [],
      },
      entry_type: rawData.entry_type || [],
      raw_content: rawData.full_entry || rawData.content || rawData.text,
      enhanced_parsing: true,
      terms_used: this.isLoaded,
      parsing_method: 'enhanced',
      // ENHANCED: Name change information
      nameChanges: [],
      currentName: companyName,
      previousNames: [],
      // NEW: Corporate events for timeline
      corporateEvents: [],
      companyStatus: null,
    };

    // Parse from full_entry using enhanced BORME structure
    if (rawData.full_entry) {
      console.log('Parsing full entry with enhanced parser...');
      const bormeData = this.parseBormeEntry(rawData.full_entry);

      // Merge officers
      result.officers = bormeData.officers;
      result.registry_data = bormeData.registryData;

      // ENHANCED: Merge name change information
      if (bormeData.nameChanges && bormeData.nameChanges.length > 0) {
        result.nameChanges = bormeData.nameChanges;
      }
      if (bormeData.previousNames && bormeData.previousNames.length > 0) {
        result.previousNames = bormeData.previousNames;
      }

      // NEW: Merge corporate events with entry date
      if (bormeData.corporateEvents && bormeData.corporateEvents.length > 0) {
        const entryDate = rawData.indexed_date || rawData.date || null;
        result.corporateEvents = bormeData.corporateEvents.map(event => ({
          ...event,
          date: event.date || entryDate,
        }));
        // Calculate company status based on events
        result.companyStatus = this.getCompanyStatusFromEvents(result.corporateEvents);
        console.log(
          `Found ${result.corporateEvents.length} corporate events, status: ${result.companyStatus?.label}`
        );
      }

      // Extract additional info from full_entry if needed
      if (bormeData.constitution) {
        console.log('Merging constitution data into result:', bormeData.constitution);
        Object.assign(result, bormeData.constitution);
        console.log('Result after constitution merge:', {
          address: result.address,
          capital: result.capital,
          activity: result.activity,
        });
      } else {
        console.log('No constitution data in bormeData');
      }

      // Use new address from "Cambio de domicilio social" category
      if (bormeData.newAddress) {
        result.address = bormeData.newAddress;
        console.log('Using newAddress from Cambio de domicilio social:', result.address);
      }

      const totalOfficers = this.getTotalOfficers(result.officers);
      console.log(`Enhanced parsing result: ${totalOfficers} officers found`);

      if (totalOfficers > 0) {
        result.parsing_method = 'enhanced';
      }
    }

    // Fallback: Use operations_start_date from ES if client-side parsing missed it
    if (!result.constitution_date && rawData.operations_start_date) {
      result.constitution_date = rawData.operations_start_date;
    }

    // Fallback: Extract address from "Cambio de domicilio social" entries using regex
    if (rawData.full_entry && !result.address) {
      // Check if entry contains "Cambio de domicilio social"
      if (rawData.full_entry.includes('Cambio de domicilio social')) {
        console.log('Entry contains Cambio de domicilio social:', rawData.full_entry);
      }

      const cambioDomicilioMatch = rawData.full_entry.match(
        /Cambio de domicilio social\.?\s*([^.]+(?:\([^)]+\))?)/i
      );
      if (cambioDomicilioMatch) {
        console.log('Regex matched:', cambioDomicilioMatch);
        const extractedAddress = cambioDomicilioMatch[1].trim();
        // Only use if it looks like an address (contains street indicators)
        if (/(?:C\/|CALLE|AVENIDA|PLAZA|PASEO|CARRETERA|AVDA|PZA)/i.test(extractedAddress)) {
          result.address = extractedAddress.replace(/\.$/, '');
          console.log('Found address from Cambio de domicilio social:', result.address);
        } else {
          console.log('Extracted text does not look like address:', extractedAddress);
        }
      }
    }

    // Fallback: Extract address from "Fe de erratas" (correction) entries
    // Format: "Fe de erratas: ... domicilio ... siendo lo correcto C/ Address, ..."
    if (rawData.full_entry && !result.address) {
      if (
        rawData.full_entry.includes('Fe de erratas') &&
        rawData.full_entry.includes('domicilio')
      ) {
        // Extract the correct address after "siendo lo correcto"
        const feErratasMatch = rawData.full_entry.match(
          /siendo lo correcto\s+([^.]+?)(?:\.\s*Datos registrales|,\.\s*Datos|\.$)/i
        );
        if (feErratasMatch) {
          const extractedAddress = feErratasMatch[1].trim().replace(/,$/, '');
          // Only use if it looks like an address
          if (/(?:C\/|CALLE|AVENIDA|PLAZA|PASEO|CARRETERA|AVDA|PZA)/i.test(extractedAddress)) {
            result.address = extractedAddress;
            console.log('Found address from Fe de erratas:', result.address);
          }
        }
      }
    }

    // Try to parse from parsed_details if available
    if (rawData.parsed_details) {
      console.log('Found parsed_details, merging data...');

      // Merge basic fields - clean values to remove leading colons from API parsing
      if (!result.cif && rawData.parsed_details.cif)
        result.cif = this.cleanFieldValue(rawData.parsed_details.cif);
      if (!result.address && rawData.parsed_details.cambio_de_domicilio_social)
        result.address = this.cleanFieldValue(rawData.parsed_details.cambio_de_domicilio_social);
      if (!result.address && rawData.parsed_details.address)
        result.address = this.cleanFieldValue(rawData.parsed_details.address);
      if (!result.address && rawData.parsed_details.domicilio)
        result.address = this.cleanFieldValue(rawData.parsed_details.domicilio);
      if (!result.activity && rawData.parsed_details.activity)
        result.activity = this.cleanFieldValue(rawData.parsed_details.activity);
      if (!result.activity && rawData.parsed_details.objeto_social)
        result.activity = this.cleanFieldValue(rawData.parsed_details.objeto_social);
      if (!result.capital && rawData.parsed_details.capital)
        result.capital = this.cleanFieldValue(rawData.parsed_details.capital);

      // Merge officers if we don't have any from enhanced parsing
      const currentTotal = this.getTotalOfficers(result.officers);
      if (currentTotal === 0) {
        // Check different possible officer formats in parsed_details
        ['nombramientos', 'reelecciones', 'revocaciones', 'ceses_dimisiones'].forEach(category => {
          if (rawData.parsed_details[category] && Array.isArray(rawData.parsed_details[category])) {
            result.officers[category] = rawData.parsed_details[category];
          }
        });

        // Also check for administrators array
        if (
          rawData.parsed_details.administrators &&
          Array.isArray(rawData.parsed_details.administrators)
        ) {
          rawData.parsed_details.administrators.forEach(admin => {
            if (typeof admin === 'string') {
              result.officers.nombramientos.push({
                name: admin,
                position: 'Administrador',
                category: 'Nombramientos',
              });
            }
          });
        }
      }
    }

    // Fallback: try to parse from any text content
    const textContent = rawData.content || rawData.text || rawData.summary || '';
    if (textContent && this.getTotalOfficers(result.officers) === 0) {
      console.log('Trying fallback parsing from text content...');
      const fallbackData = this.parseBormeEntry(textContent);
      result.officers = fallbackData.officers;
      result.parsing_method = 'fallback';

      const totalOfficers = this.getTotalOfficers(result.officers);
      console.log(`Fallback parsing result: ${totalOfficers} officers found`);
    }

    console.log('Final parsed result:', result);
    return result;
  }

  /**
   * ENHANCED: Extract company name changes from BORME entry
   */
  extractNameChanges(fullEntry, result) {
    console.log('=== EXTRACTING NAME CHANGES ===');
    console.log(
      'Full entry for name change detection:',
      fullEntry ? fullEntry.substring(0, 200) + '...' : 'NO FULL ENTRY'
    );

    if (!fullEntry) {
      console.log('❌ No full entry provided for name change detection');
      return;
    }

    // Look for "Cambio de denominación social" pattern
    const nameChangePattern =
      /Cambio de denominación social[.\s]*([A-ZÁÉÍÓÚÑÜ\s&\-.,\d]+(?:S\.?L\.?|S\.?A\.?|S\.?L\.?L\.?|S\.?L\.?P\.?))/gi;
    let nameChangeMatch;

    while ((nameChangeMatch = nameChangePattern.exec(fullEntry)) !== null) {
      const newName = nameChangeMatch[1].trim();
      if (newName && newName.length > 3) {
        result.nameChanges.push({
          newName: newName,
          changeType: 'denominacion_social',
          rawMatch: nameChangeMatch[0],
          // Try to extract date from the entry context
          date: this.extractDateFromEntry(fullEntry) || null,
        });

        console.log('Found name change:', newName);
      }
    }

    // Alternative pattern: Look for company names mentioned after certain keywords
    const mentionPattern =
      /(anteriormente|antes|denominada|nombre anterior|razón social anterior)[\s:]*([A-ZÁÉÍÓÚÑÜ\s&\-.,\d]+(?:S\.?L\.?|S\.?A\.?|S\.?L\.?L\.?|S\.?L\.?P\.?))/gi;
    let mentionMatch;

    while ((mentionMatch = mentionPattern.exec(fullEntry)) !== null) {
      const previousName = mentionMatch[2].trim();
      if (previousName && previousName.length > 3 && !result.previousNames.includes(previousName)) {
        result.previousNames.push(previousName);
        console.log('Found previous name reference:', previousName);
      }
    }

    // Look for patterns where new company names are mentioned in the entry
    const newNamePattern =
      /(?:nueva denominación|nueva razón social|pasa a denominarse)[\s:]*([A-ZÁÉÍÓÚÑÜ\s&\-.,\d]+(?:S\.?L\.?|S\.?A\.?|S\.?L\.?L\.?|S\.?L\.?P\.?))/gi;
    let newNameMatch;

    while ((newNameMatch = newNamePattern.exec(fullEntry)) !== null) {
      const newName = newNameMatch[1].trim();
      if (newName && newName.length > 3) {
        const exists = result.nameChanges.some(change => change.newName === newName);
        if (!exists) {
          result.nameChanges.push({
            newName: newName,
            changeType: 'nueva_denominacion',
            rawMatch: newNameMatch[0],
            date: this.extractDateFromEntry(fullEntry) || null,
          });
          console.log('Found new name reference:', newName);
        }
      }
    }

    console.log('Name changes found:', result.nameChanges);
    console.log('Previous names found:', result.previousNames);
  }

  /**
   * Extract date from BORME entry - looks for patterns like "I/A 2 (13.01.25)"
   */
  extractDateFromEntry(fullEntry) {
    if (!fullEntry) return null;

    // Pattern 1: I/A number (DD.MM.YY) format
    const iaPattern = /I\/A\s+\d+\s*\((\d{1,2}\.\d{1,2}\.\d{2,4})\)/;
    const iaMatch = fullEntry.match(iaPattern);
    if (iaMatch) {
      return this.formatSpanishDate(iaMatch[1]);
    }

    // Pattern 2: Other Spanish date formats
    const datePatterns = [
      /(\d{1,2}\.\d{1,2}\.\d{2,4})/g,
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
      /(\d{1,2}-\d{1,2}-\d{2,4})/g,
    ];

    for (const pattern of datePatterns) {
      const matches = fullEntry.match(pattern);
      if (matches && matches.length > 0) {
        // Return the last date found (usually the most recent)
        const lastDate = matches[matches.length - 1];
        return this.formatSpanishDate(lastDate);
      }
    }

    return null;
  }

  /**
   * Format Spanish date from DD.MM.YY to YYYY-MM-DD
   */
  formatSpanishDate(spanishDate) {
    if (!spanishDate) return null;

    const parts = spanishDate.split(/[./-]/);
    if (parts.length !== 3) return spanishDate; // Return as-is if can't parse

    let [day, month, year] = parts;

    // Handle 2-digit years (assume 20xx for years < 50, 19xx for years >= 50)
    if (year.length === 2) {
      const yearNum = parseInt(year);
      year = yearNum < 50 ? `20${year}` : `19${year}`;
    }

    // Pad single digits
    day = day.padStart(2, '0');
    month = month.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  /**
   * Extract corporate events from BORME entry
   * Returns array of categorized events for timeline display
   */
  extractCorporateEvents(fullEntry, entryDate = null) {
    const events = [];
    // FIXED: Add null checks for eventToCategoryMap and validate inputs
    if (!fullEntry || !this.terms || !this.eventToCategoryMap) return events;

    console.log('=== EXTRACTING CORPORATE EVENTS ===');

    // Scan the full entry for all top-level categories
    const alwaysTopLevel = this.terms.alwaysTopLevel;
    // FIXED: Validate alwaysTopLevel is an array
    if (!Array.isArray(alwaysTopLevel)) return events;

    for (const eventType of alwaysTopLevel) {
      // FIXED: Validate eventType is a string before regex operations
      if (typeof eventType !== 'string') continue;

      // Skip officer-related events (handled separately)
      if (
        [
          'Nombramientos',
          'N o m b r a m i e n t o s',
          'Reelecciones',
          'R e e l e c c i o n e s',
          'Revocaciones',
          'R e v o c a c i o n e s',
          'Ceses/Dimisiones',
          'C e s e s / D i m i s i o n e s',
          'Cancelaciones de oficio de nombramientos',
        ].includes(eventType)
      ) {
        continue;
      }

      // Check if this event type appears in the entry
      const eventPattern = new RegExp(eventType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

      if (eventPattern.test(fullEntry)) {
        // Get category info
        const categoryInfo = this.eventToCategoryMap[eventType.toLowerCase()] || {
          category: 'other',
          label: 'Otros',
          icon: 'other',
        };

        // Extract any associated value (e.g., capital amount, new address, etc.)
        let details = null;

        // Special handling for specific event types
        if (eventType === 'Ampliación de capital' || eventType === 'Reducción de capital') {
          // Try to extract capital amount
          const capitalMatch = fullEntry.match(
            new RegExp(
              eventType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
                '[.:\\s]*([\\d.,]+(?:\\s*(?:Euros?|€|EUR))?)',
              'i'
            )
          );
          if (capitalMatch) {
            details = { amount: capitalMatch[1].trim() };
          }
        } else if (eventType === 'Cambio de domicilio social') {
          // Try to extract new address
          const addressMatch = fullEntry.match(
            /Cambio de domicilio social[.:\s]*([^.]+(?:C\/|CALLE|AVENIDA|PLAZA|PASEO)[^.]+)/i
          );
          if (addressMatch) {
            details = { newAddress: addressMatch[1].trim() };
          }
        } else if (eventType === 'Cambio de denominación social') {
          // Try to extract new name
          const nameMatch = fullEntry.match(
            /Cambio de denominación social[.:\s]*([A-ZÁÉÍÓÚÑÜ\s&\-.,\d]+(?:S\.?L\.?|S\.?A\.?))/i
          );
          if (nameMatch) {
            details = { newName: nameMatch[1].trim() };
          }
        } else if (eventType === 'Constitución') {
          // Try to extract constitution details
          const dateMatch = fullEntry.match(
            /Comienzo de operaciones\s*:\s*(\d{2}\.\d{2}\.\d{2,4})/
          );
          const capitalMatch = fullEntry.match(/Capital:\s*([\d.,]+(?:\s*(?:Euros?|€|EUR))?)/i);
          details = {};
          if (dateMatch) details.constitutionDate = this.formatSpanishDate(dateMatch[1]);
          if (capitalMatch) details.initialCapital = capitalMatch[1].trim();
        } else if (eventType === 'Disolución') {
          // FIXED: Check dissolution type in context near "Disolución" to avoid false matches
          const dissolutionMatch = fullEntry.match(/Disolución[.:\s]*([^.]{0,150})/i);
          const context = dissolutionMatch ? dissolutionMatch[1] : '';
          if (/voluntaria/i.test(context)) {
            details = { dissolutionType: 'voluntary' };
          } else if (/judicial/i.test(context)) {
            details = { dissolutionType: 'judicial' };
          } else if (/concursal/i.test(context) || /concurso/i.test(context)) {
            details = { dissolutionType: 'bankruptcy' };
          } else {
            details = { dissolutionType: 'unknown' };
          }
        } else if (eventType === 'Capital') {
          // Generic capital - try to extract amount
          const capitalMatch = fullEntry.match(/Capital[.:\s]*([\d.,]+(?:\s*(?:Euros?|€|EUR))?)/i);
          if (capitalMatch) {
            details = { amount: capitalMatch[1].trim() };
          }
        }

        // For constitution events, use the parsed constitution date instead of the publication date
        const eventDate =
          eventType === 'Constitución' && details?.constitutionDate
            ? details.constitutionDate
            : entryDate;

        events.push({
          type: eventType,
          category: categoryInfo.category,
          categoryLabel: categoryInfo.label,
          icon: categoryInfo.icon,
          date: eventDate,
          details,
          // Determine if this is a significant lifecycle event
          isLifecycleEvent: categoryInfo.category === 'lifecycle',
          isCapitalEvent: categoryInfo.category === 'capital',
          isStructuralEvent: categoryInfo.category === 'structural',
        });

        console.log(`Found corporate event: ${eventType} (${categoryInfo.category})`);
      }
    }

    return events;
  }

  /**
   * Categorize an event type
   */
  categorizeEvent(eventType) {
    if (!eventType) return null;
    return (
      this.eventToCategoryMap[eventType.toLowerCase()] || {
        category: 'other',
        label: 'Otros',
        icon: 'other',
      }
    );
  }

  /**
   * Get company status from events
   * Returns status like 'active', 'dissolved', 'bankrupt', etc.
   */
  getCompanyStatusFromEvents(events) {
    if (!events || events.length === 0) return { status: 'unknown', label: 'Desconocido' };

    // Check for dissolution/extinction (most terminal status)
    const hasExtinction = events.some(e => e.type === 'Extinción');
    if (hasExtinction) return { status: 'extinct', label: 'Extinguida' };

    const hasDissolution = events.some(e => e.type === 'Disolución');
    if (hasDissolution) {
      const dissolutionEvent = events.find(e => e.type === 'Disolución');
      const dissolutionType = dissolutionEvent?.details?.dissolutionType;
      if (dissolutionType === 'voluntary') {
        return { status: 'dissolved_voluntary', label: 'Disuelta (Voluntaria)' };
      } else if (dissolutionType === 'judicial') {
        return { status: 'dissolved_judicial', label: 'Disuelta (Judicial)' };
      } else if (dissolutionType === 'bankruptcy') {
        return { status: 'dissolved_bankruptcy', label: 'Disuelta (Concursal)' };
      }
      return { status: 'dissolved', label: 'Disuelta' };
    }

    // Check for bankruptcy/insolvency status
    const hasBankruptcy = events.some(
      e => e.type === 'Quiebra' || e.type === 'Situación concursal'
    );
    if (hasBankruptcy) return { status: 'bankrupt', label: 'En Quiebra/Concurso' };

    // Check for suspension of payments
    const hasSuspension = events.some(e => e.type === 'Suspensión de pagos');
    if (hasSuspension) return { status: 'suspended', label: 'Suspensión de Pagos' };

    // Check if company was formed
    const hasConstitution = events.some(e => e.type === 'Constitución');
    if (hasConstitution) return { status: 'active', label: 'Activa' };

    // Default to active if we have any events
    return { status: 'active', label: 'Activa' };
  }
}

const termsParser = new SpanishCompanyTermsParser();

// Export functions
export const loadTerms = termsData => termsParser.loadTerms(termsData);
export const parseSpanishCompanyData = rawData => termsParser.parseSpanishCompanyData(rawData);
export const isTermsLoaded = () => termsParser.isLoaded;

// NEW: Export corporate event functions
export const categorizeEvent = eventType => termsParser.categorizeEvent(eventType);
export const getCompanyStatusFromEvents = events => termsParser.getCompanyStatusFromEvents(events);
export const extractCorporateEvents = (fullEntry, entryDate) =>
  termsParser.extractCorporateEvents(fullEntry, entryDate);
export const getEventCategories = () => termsParser.eventCategories;

// Helper functions
export const getOfficerSummary = officers => {
  // Handle case where officers is undefined or null
  if (!officers || typeof officers !== 'object') {
    return {
      total: 0,
      has_changes: false,
      recent_appointments: false,
      recent_reelections: false,
      appointments_count: 0,
      reelections_count: 0,
      revocations_count: 0,
      cessations_count: 0,
      officers: [],
    };
  }

  const allOfficers = [
    ...(officers.nombramientos || []),
    ...(officers.reelecciones || []), // <- Fixed spelling here
    ...(officers.revocaciones || []),
    ...(officers.ceses_dimisiones || []),
  ];

  return {
    total: allOfficers.length,
    has_changes:
      (officers.revocaciones?.length || 0) > 0 || (officers.ceses_dimisiones?.length || 0) > 0,
    recent_appointments: (officers.nombramientos?.length || 0) > 0,
    recent_reelections: (officers.reelecciones?.length || 0) > 0, // <- Fixed spelling here
    appointments_count: officers.nombramientos?.length || 0,
    reelections_count: officers.reelecciones?.length || 0, // <- Fixed spelling here
    revocations_count: officers.revocaciones?.length || 0,
    cessations_count: officers.ceses_dimisiones?.length || 0,
    officers: allOfficers,
  };
};

export const formatCompanyForRag = company => {
  const parsed = parseSpanishCompanyData(company.rawData || company);

  // Enhanced formatting for better AI comprehension
  let text = `=== SPANISH COMPANY PROFILE ===\n\n`;

  // Company Identity Section
  text += `**COMPANY IDENTITY**\n`;
  text += `Company Name: ${parsed.company_name}\n`;
  if (parsed.cif) text += `Tax ID (CIF): ${parsed.cif}\n`;
  if (parsed.identifier) text += `BORME Registry ID: ${parsed.identifier}\n`;
  if (parsed.constitution_date) text += `Founded: ${parsed.constitution_date}\n`;
  text += `Data Source: Spanish Commercial Registry (BORME)\n`;
  text += `Analysis Method: ${parsed.parsing_method}\n\n`;

  // Business Information Section
  text += `**BUSINESS INFORMATION**\n`;
  if (parsed.activity) text += `Business Activity: ${parsed.activity}\n`;
  if (parsed.cnae_code) text += `Industry Code (CNAE): ${parsed.cnae_code}\n`;
  if (parsed.capital) text += `Share Capital: ${parsed.capital}\n`;
  if (parsed.address) text += `Registered Address: ${parsed.address}\n`;
  if (parsed.registry_data) text += `Legal Structure: ${parsed.registry_data}\n`;
  text += `\n`;

  // Corporate Governance Section
  const totalOfficers = Object.values(parsed.officers || {}).flat().length;
  if (totalOfficers > 0) {
    text += `**CORPORATE GOVERNANCE**\n`;
    text += `Total Officers/Directors: ${totalOfficers}\n\n`;

    // Detailed officer information by category
    const officerCategories = {
      nombramientos: 'New Appointments',
      reelecciones: 'Re-elections',
      revocaciones: 'Revocations',
      ceses_dimisiones: 'Resignations/Terminations',
    };

    Object.entries(officerCategories).forEach(([category, label]) => {
      if (parsed.officers[category] && parsed.officers[category].length > 0) {
        text += `**${label}:**\n`;
        parsed.officers[category].forEach((officer, index) => {
          text += `  ${index + 1}. ${officer.name}`;
          if (officer.position) text += ` - ${officer.position}`;
          text += `\n`;
        });
        text += `\n`;
      }
    });
  }

  // Key Business Insights Section
  text += `**KEY BUSINESS INSIGHTS**\n`;

  // Company size estimation based on capital
  if (parsed.capital) {
    const capitalNum = parseFloat(parsed.capital.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!isNaN(capitalNum)) {
      let sizeCategory = 'Micro';
      if (capitalNum >= 3000000) sizeCategory = 'Large';
      else if (capitalNum >= 600000) sizeCategory = 'Medium';
      else if (capitalNum >= 60000) sizeCategory = 'Small';
      text += `Estimated Company Size: ${sizeCategory} (based on capital €${capitalNum.toLocaleString()})\n`;
    }
  }

  // Activity analysis
  if (totalOfficers > 0) {
    let activityLevel = 'Low';
    if (totalOfficers >= 10) activityLevel = 'High';
    else if (totalOfficers >= 5) activityLevel = 'Medium';
    text += `Corporate Activity Level: ${activityLevel} (${totalOfficers} recorded officer movements)\n`;
  }

  // Industry sector from CNAE
  if (parsed.cnae_code) {
    const cnaeFirst = parsed.cnae_code.substring(0, 2);
    const sectorMap = {
      '01': 'Agriculture',
      '02': 'Forestry',
      '05': 'Mining',
      10: 'Food Processing',
      20: 'Chemical Industry',
      25: 'Metal Products',
      30: 'Manufacturing',
      35: 'Energy',
      41: 'Construction',
      45: 'Retail Trade',
      49: 'Transportation',
      55: 'Hospitality',
      58: 'Information/Publishing',
      62: 'IT Services',
      64: 'Financial Services',
      68: 'Real Estate',
      70: 'Business Services',
      85: 'Education',
      86: 'Healthcare',
    };
    const sector = sectorMap[cnaeFirst] || 'Other';
    text += `Industry Sector: ${sector}\n`;
  }

  text += `\n`;

  // Additional Context for AI Analysis
  text += `**CONTEXT FOR ANALYSIS**\n`;
  text += `This is a Spanish company registered in the official Commercial Registry (BORME - Boletín Oficial del Registro Mercantil).\n`;
  text += `The BORME is the official bulletin where all commercial and corporate information is published in Spain.\n`;
  text += `This data includes corporate changes, appointments, financial information, and legal structure details.\n`;
  text += `All information is legally verified and publicly available through Spanish authorities.\n\n`;

  // Raw content for detailed analysis (if available)
  if (parsed.raw_content) {
    text += `**ORIGINAL REGISTRY CONTENT**\n`;
    text += `${parsed.raw_content}\n\n`;
  }

  // Metadata for search optimization
  text += `**SEARCH KEYWORDS**\n`;
  const keywords = [
    parsed.company_name,
    parsed.cif,
    parsed.activity,
    ...Object.values(parsed.officers || {})
      .flat()
      .map(o => o.name),
    'Spanish company',
    'BORME registry',
    'Commercial registry Spain',
  ].filter(Boolean);
  text += `Keywords: ${keywords.join(', ')}\n`;

  return text;
};

// Debug function for testing
export const debugBormeEntry = fullEntry => {
  console.log('=== DEBUGGING BORME ENTRY ===');
  const result = termsParser.parseBormeEntry(fullEntry);
  console.log('Result:', result);
  return result;
};

// Test function specifically for constitution entries
// Test function specifically for constitution officer extraction
export const testConstitutionOfficerExtraction = constitutionEntry => {
  console.log('=== TESTING CONSTITUTION OFFICER EXTRACTION ===');
  const result = termsParser.parseBormeEntry(constitutionEntry);
  console.log('Constitution test result:', result);

  const totalOfficers = Object.values(result.officers).reduce(
    (total, category) => total + category.length,
    0
  );
  console.log(`Total officers extracted from constitution: ${totalOfficers}`);

  return {
    officers: result.officers,
    constitution: result.constitution,
    totalOfficers,
    success: totalOfficers > 0,
  };
};

// Debug helper to check data alignment between API and frontend

// Add this to your SpanishCompanyCard.jsx or parser to debug the data format
export const debugDataFormat = rawData => {
  console.log('=== RAW DATA DEBUG ===');
  console.log('Full rawData:', rawData);

  console.log('=== OFFICERS STRUCTURE ===');
  console.log('rawData.officers:', rawData.officers);
  console.log('Type of officers:', typeof rawData.officers);
  console.log('Is officers array?', Array.isArray(rawData.officers));

  if (rawData.officers) {
    console.log('Officers length:', rawData.officers.length);
    console.log('First officer:', rawData.officers[0]);
  }

  console.log('=== PARSED DETAILS STRUCTURE ===');
  console.log('rawData.parsed_details:', rawData.parsed_details);

  if (rawData.parsed_details) {
    console.log('Parsed details keys:', Object.keys(rawData.parsed_details));
    console.log('nombramientos:', rawData.parsed_details.nombramientos);
    console.log('reelecciones:', rawData.parsed_details.reelecciones);
  }

  console.log('=== ENTRY TYPE ===');
  console.log('rawData.entry_type:', rawData.entry_type);

  console.log('=== ENHANCED PARSING ===');
  console.log('rawData.enhanced_parsing:', rawData.enhanced_parsing);

  console.log('=== FULL ENTRY ===');
  console.log('rawData.full_entry:', rawData.full_entry);

  return {
    hasOfficersArray: Array.isArray(rawData.officers),
    hasParsedDetails: !!rawData.parsed_details,
    hasFullEntry: !!rawData.full_entry,
    hasEnhancedParsing: !!rawData.enhanced_parsing,
    officersCount: rawData.officers?.length || 0,
    entryTypes: rawData.entry_type || [],
  };
};

// Expected format transformation
export const transformApiDataToExpectedFormat = apiData => {
  // If the API returns the old format, transform it to the new format
  if (Array.isArray(apiData.officers)) {
    console.log('Transforming old officers format to new categorized format');

    const categorizedOfficers = {
      nombramientos: [],
      reelecciones: [],
      revocaciones: [],
      ceses_dimisiones: [],
    };

    // Group officers by their position/category
    apiData.officers.forEach(officer => {
      // Try to determine category from position or raw_entry
      const position = officer.position?.toLowerCase() || '';
      const rawEntry = officer.raw_entry?.toLowerCase() || '';

      if (rawEntry.includes('reelec') || position.includes('reelec')) {
        categorizedOfficers.reelecciones.push(officer);
      } else if (rawEntry.includes('revoc') || position.includes('revoc')) {
        categorizedOfficers.revocaciones.push(officer);
      } else if (
        rawEntry.includes('ces') ||
        rawEntry.includes('dimis') ||
        position.includes('ces') ||
        position.includes('dimis')
      ) {
        categorizedOfficers.ceses_dimisiones.push(officer);
      } else {
        // Default to nombramientos
        categorizedOfficers.nombramientos.push(officer);
      }
    });

    return {
      ...apiData,
      officers: categorizedOfficers,
      enhanced_parsing: true,
      parsing_method: 'api_transformed',
    };
  }

  // If already in new format, return as-is
  return apiData;
};

// Add this to your parseSpanishCompanyData function
export const parseSpanishCompanyDataWithApiAlignment = rawData => {
  // First, debug what we're receiving
  const debugInfo = debugDataFormat(rawData);
  console.log('Debug info:', debugInfo);

  // Transform API data if needed
  const transformedData = transformApiDataToExpectedFormat(rawData);

  // If we have a full_entry, use the enhanced parser
  if (transformedData.full_entry) {
    console.log('Using enhanced parser with full_entry');
    return parseSpanishCompanyData(transformedData);
  }

  // Otherwise, work with the transformed API data
  const result = {
    company_name: transformedData.company_name || transformedData.name || 'Empresa Española',
    identifier: transformedData.identifier,
    cif: null,
    address: null,
    activity: null,
    capital: null,
    cnae_code: null,
    constitution_date: null,
    registry_data: null,
    officers: transformedData.officers || {
      nombramientos: [],
      reelecciones: [],
      revocaciones: [],
      ceses_dimisiones: [],
    },
    entry_type: transformedData.entry_type || [],
    raw_content: transformedData.full_entry,
    enhanced_parsing: transformedData.enhanced_parsing || false,
    terms_used: true,
    parsing_method: transformedData.parsing_method || 'api_direct',
  };

  console.log('Final parsed result:', result);
  return result;
};
