const STRINGS = {
  en: {
    matchesHeading: 'Matches', noMatches: 'No Spanish company found for this selection.',
    loading: 'Loading…', error: 'Something went wrong. Try again.',
    capital: 'Capital', address: 'Address', status: 'Status',
    activeOfficers: 'Active officers', formerOfficers: 'Former officers',
    viewProfile: 'View full profile on mapasocietario.es',
    statusActive: 'Active', statusDissolved: 'Dissolved',
    formerly: 'formerly',
  },
  es: {
    matchesHeading: 'Coincidencias', noMatches: 'No se encontró ninguna empresa española para esta selección.',
    loading: 'Cargando…', error: 'Algo salió mal. Inténtalo de nuevo.',
    capital: 'Capital', address: 'Domicilio', status: 'Estado',
    activeOfficers: 'Cargos activos', formerOfficers: 'Cargos anteriores',
    viewProfile: 'Ver perfil completo en mapasocietario.es',
    statusActive: 'Activa', statusDissolved: 'Disuelta',
    formerly: 'antes',
  },
};

export function pickLocale(navLang) {
  return (navLang || '').toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function t(locale, key) {
  return STRINGS[locale]?.[key] ?? STRINGS.en[key] ?? key;
}
