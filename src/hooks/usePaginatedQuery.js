import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useClinic } from '@/lib/useClinic';

/**
 * Server-side paginated query hook.
 * Uses the getPaginatedRecords backend function for real skip/limit pagination.
 * Never downloads the full collection to the browser.
 *
 * @param {string} entity - Entity key: patients, appointments, payments, lab_cases,
 *                          patient_treatments, staff, doctors, laboratories
 * @param {object} options - { pageSize, sort, filters, searchDebounceMs }
 * @returns { records, page, setPage, pageSize, setPageSize, hasMore, isLoading, isFetching, search, setSearch, refetch }
 */
export function usePaginatedQuery(entity, options = {}) {
  const {
    pageSize: initialPageSize = 20,
    sort = '-created_date',
    filters = {},
    searchDebounceMs = 350,
  } = options;

  const { clinic } = useClinic();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      setDebouncedSearch(search);
    }, searchDebounceMs);
    return () => clearTimeout(timer);
  }, [search, searchDebounceMs]);

  const queryKey = ['paginated', entity, clinic?.id, page, pageSize, sort, debouncedSearch, JSON.stringify(filters)];

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!clinic) return { records: [], has_more: false };
      const res = await appClient.functions.invoke('getPaginatedRecords', {
        entity,
        page,
        page_size: pageSize,
        sort,
        search: debouncedSearch || undefined,
        filters,
      });
      return res.data;
    },
    enabled: !!clinic,
    keepPreviousData: true,
  });

  const records = data?.records || [];
  const hasMore = data?.has_more || false;

  const nextPage = useCallback(() => {
    if (hasMore) setPage(p => p + 1);
  }, [hasMore]);

  const prevPage = useCallback(() => {
    setPage(p => Math.max(0, p - 1));
  }, []);

  const goToPage = useCallback((p) => {
    setPage(Math.max(0, p));
  }, []);

  return {
    records,
    page,
    setPage: goToPage,
    nextPage,
    prevPage,
    pageSize,
    setPageSize: (size) => { setPageSize(size); setPage(0); },
    hasMore,
    hasPrev: page > 0,
    isLoading,
    isFetching,
    search,
    setSearch,
    debouncedSearch,
    refetch,
  };
}