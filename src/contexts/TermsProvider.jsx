// src/contexts/TermsProvider.jsx - React Context Provider for terms

import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadTerms, getTermsStatus } from '../services/termsService';

const TermsContext = createContext();

export const TermsProvider = ({ children }) => {
  const [state, setState] = useState(() => {
    const status = getTermsStatus();
    return transformStatus(status);
  });

  useEffect(() => {
    const initializeTerms = async () => {
      if (!state.isReady && !state.isLoading) {
        await loadTerms();
        setState(transformStatus(getTermsStatus()));
      }
    };

    initializeTerms();
  }, [state.isReady, state.isLoading]);

  return <TermsContext.Provider value={state}>{children}</TermsContext.Provider>;
};

// Transform the terms status to the format components expect
const transformStatus = status => {
  const { isReady, isLoading, terms } = status;

  // Create termData with the keys components expect
  const termData = terms
    ? {
        // Original keys
        alwaysTopLevel: terms.alwaysTopLevel || [],
        officersPositions: terms.officersPositions || [],

        // Aliases that components expect
        alwaysTopLevelDisplayNames: terms.alwaysTopLevel || [],
        allOfficerRoles: terms.officersPositions || [],
      }
    : null;

  return {
    isReady,
    isLoading,
    terms,
    termData, // Add termData for components that expect this key
  };
};

export const useTermsContext = () => {
  const context = useContext(TermsContext);
  if (!context) {
    throw new Error('useTermsContext must be used within a TermsProvider');
  }
  return context;
};
