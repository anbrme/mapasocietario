export const SEARCH_LANGUAGE_STORAGE_KEY = 'mapa_societario_search_language';

export const normalizeLanguage = value => {
  const lang = String(value || '').trim().toLowerCase();
  if (lang.startsWith('es')) return 'es';
  if (lang.startsWith('en')) return 'en';
  return null;
};

export const getStoredSearchLanguage = () => {
  try {
    return normalizeLanguage(localStorage.getItem(SEARCH_LANGUAGE_STORAGE_KEY));
  } catch {
    return null;
  }
};

export const persistSearchLanguage = language => {
  const normalized = normalizeLanguage(language);
  if (!normalized) return;
  try {
    localStorage.setItem(SEARCH_LANGUAGE_STORAGE_KEY, normalized);
  } catch {
    // Storage can be unavailable in privacy-restricted contexts.
  }
};

export const getBrowserLanguage = () => {
  if (typeof navigator === 'undefined') return null;
  return normalizeLanguage(navigator.language || navigator.languages?.[0]);
};
