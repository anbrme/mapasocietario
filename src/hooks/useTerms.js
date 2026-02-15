// src/hooks/useTerms.js - React hook for terms

import { useTermsContext } from '../contexts/TermsProvider';

export const useTerms = () => {
  return useTermsContext();
};
