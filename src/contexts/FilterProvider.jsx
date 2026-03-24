import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { statsService } from '../services/statsService';

const FilterContext = createContext(null);

export function useFilters() {
  return useContext(FilterContext);
}

export function FilterProvider({ children }) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse initial state from URL
  const [dateFrom, setDateFrom] = useState(searchParams.get('from') || '2009-01-01');
  const [dateTo, setDateTo] = useState(searchParams.get('to') || '');
  const [interval, setInterval] = useState(searchParams.get('interval') || 'month');
  const [provinces, setProvinces] = useState(() => searchParams.getAll('province'));
  const [companyTypes, setCompanyTypes] = useState(() => searchParams.getAll('company_type'));
  const [eventCategories, setEventCategories] = useState(() => searchParams.getAll('event_category'));

  // Filter options (populated from API)
  const [filterOptions, setFilterOptions] = useState({ provinces: [], company_types: [], event_categories: [] });

  // Fetch filter options once
  useEffect(() => {
    statsService.getFilterOptions().then(setFilterOptions).catch(() => {});
  }, []);

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (dateFrom && dateFrom !== '2009-01-01') params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    if (interval !== 'month') params.set('interval', interval);
    provinces.forEach((p) => params.append('province', p));
    companyTypes.forEach((t) => params.append('company_type', t));
    eventCategories.forEach((c) => params.append('event_category', c));
    setSearchParams(params, { replace: true });
  }, [dateFrom, dateTo, interval, provinces, companyTypes, eventCategories, setSearchParams]);

  // Build query params object for statsService
  const filterParams = useMemo(() => {
    const params = { interval };
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    // Multi-value params need special handling in fetchStats
    if (provinces.length) params._provinces = provinces;
    if (companyTypes.length) params._companyTypes = companyTypes;
    if (eventCategories.length) params._eventCategories = eventCategories;
    return params;
  }, [dateFrom, dateTo, interval, provinces, companyTypes, eventCategories]);

  // Serialized key for useEffect dependencies
  const filterKey = useMemo(
    () => JSON.stringify(filterParams),
    [filterParams]
  );

  const hasActiveFilters = provinces.length > 0 || companyTypes.length > 0 || eventCategories.length > 0 ||
    (dateFrom && dateFrom !== '2009-01-01') || dateTo;

  const clearAll = useCallback(() => {
    setDateFrom('2009-01-01');
    setDateTo('');
    setProvinces([]);
    setCompanyTypes([]);
    setEventCategories([]);
  }, []);

  const value = useMemo(() => ({
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    interval, setInterval,
    provinces, setProvinces,
    companyTypes, setCompanyTypes,
    eventCategories, setEventCategories,
    filterOptions,
    filterParams,
    filterKey,
    hasActiveFilters,
    clearAll,
  }), [dateFrom, dateTo, interval, provinces, companyTypes, eventCategories,
       filterOptions, filterParams, filterKey, hasActiveFilters, clearAll]);

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}
