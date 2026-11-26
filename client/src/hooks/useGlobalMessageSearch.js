import { useCallback, useEffect, useRef, useState } from 'react';
import { searchMessagesApi } from '../api/api';
import { doesMessageMatchQuery } from '../utils/searchUtils';

const DEBOUNCE_MS = 500;
const MIN_QUERY_LENGTH = 2;
const BACKEND_RESULT_LIMIT = 20;

/**
 * Encapsulates Global Sidebar Message Search:
 * - 500ms debounce
 * - Instant trigger on Enter
 * - Client-side Map cache + Subset Filtering (if a shorter prefix returned < 20 results,
 *   longer queries are guaranteed subsets and are filtered locally with 0 API calls)
 * - AbortController to cancel stale in-flight requests
 */
export const useGlobalMessageSearch = (searchQuery = '') => {
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const cacheRef = useRef(new Map());
  const abortControllerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // If any shorter prefix returned fewer than BACKEND_RESULT_LIMIT (20) items,
  // we already have 100% of possible matches in memory and can filter locally (0 API calls).
  const getSubsetResultsFromPrefix = useCallback((trimmedQuery, normalizedQuery) => {
    for (let len = normalizedQuery.length - 1; len >= MIN_QUERY_LENGTH; len -= 1) {
      const prefix = normalizedQuery.slice(0, len);
      const cached = cacheRef.current.get(prefix);
      if (Array.isArray(cached) && cached.length < BACKEND_RESULT_LIMIT) {
        return cached.filter((msg) => doesMessageMatchQuery(msg, trimmedQuery));
      }
    }
    return null;
  }, []);

  const executeSearch = useCallback(async (rawQuery) => {
    const trimmed = rawQuery.trim();
    const normalized = trimmed.toLowerCase();

    if (normalized.length < MIN_QUERY_LENGTH) {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setResults([]);
      setIsSearching(false);
      return;
    }

    // 1. Check exact client Map cache (0ms)
    if (cacheRef.current.has(normalized)) {
      setResults(cacheRef.current.get(normalized));
      setIsSearching(false);
      return;
    }

    // 2. Subset filtering from any non-truncated cached prefix (0ms, 0 API calls)
    const subsetMatches = getSubsetResultsFromPrefix(trimmed, normalized);
    if (subsetMatches !== null) {
      cacheRef.current.set(normalized, subsetMatches);
      setResults(subsetMatches);
      setIsSearching(false);
      return;
    }

    // 3. Abort any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsSearching(true);
    try {
      const response = await searchMessagesApi(trimmed, controller.signal);
      const matched = response?.data?.data || [];
      cacheRef.current.set(normalized, matched);
      setResults(matched);
    } catch (error) {
      if (error?.name !== 'CanceledError' && error?.code !== 'ERR_CANCELED') {
        console.warn('Global message search failed:', error);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsSearching(false);
      }
    }
  }, [getSubsetResultsFromPrefix]);

  // Debounced search on query change
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = searchQuery.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setResults([]);
      setIsSearching(false);
      return;
    }

    const normalized = trimmed.toLowerCase();
    if (cacheRef.current.has(normalized)) {
      setResults(cacheRef.current.get(normalized));
      setIsSearching(false);
      return;
    }

    const subsetMatches = getSubsetResultsFromPrefix(trimmed, normalized);
    if (subsetMatches !== null) {
      cacheRef.current.set(normalized, subsetMatches);
      setResults(subsetMatches);
      setIsSearching(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      executeSearch(trimmed);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, executeSearch, getSubsetResultsFromPrefix]);

  // Instant search trigger on Enter key
  const triggerImmediateSearch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    executeSearch(searchQuery);
  }, [searchQuery, executeSearch]);

  // Invalidate cache when messages are sent, edited, or deleted across devices
  const invalidateSearchCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  return {
    globalSearchResults: results,
    isSearchingMessages: isSearching,
    triggerImmediateSearch,
    invalidateSearchCache,
  };
};
