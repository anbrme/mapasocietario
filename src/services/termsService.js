// src/services/termsService.js - Simple terms loading service

// Import terms.json directly to ensure it's always available
import termsData from '../data/terms.json';

let isReady = false;
let isLoading = false;
let terms = null;

export const loadTerms = async () => {
  if (isReady) return { isReady: true, terms };

  if (isLoading) {
    // Wait for current loading to complete
    return new Promise(resolve => {
      const checkLoading = () => {
        if (!isLoading) {
          resolve({ isReady, terms });
        } else {
          setTimeout(checkLoading, 10);
        }
      };
      checkLoading();
    });
  }

  isLoading = true;

  try {
    console.log('Loading terms from imported data...');
    terms = termsData;
    isReady = true;

    // Also load into the parser
    const { loadTerms: loadParserTerms } = await import('../utils/spanishCompanyParserWithTerms');
    await loadParserTerms(termsData);

    console.log('Terms loaded successfully:', {
      alwaysTopLevel: termsData.alwaysTopLevel?.length || 0,
      officersPositions: termsData.officersPositions?.length || 0,
    });

    return { isReady: true, terms };
  } catch (error) {
    console.error('Error loading terms:', error);
    isReady = false;
    return { isReady: false, terms: null };
  } finally {
    isLoading = false;
  }
};

export const getTermsStatus = () => ({
  isReady,
  isLoading,
  terms,
});

// Initialize terms loading immediately
loadTerms();
