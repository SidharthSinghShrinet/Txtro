import { useCallback, useEffect, useRef, useState } from 'react';
import { searchMessagesApi } from '../api/api';
import { doesMessageMatchQuery } from '../utils/searchUtils';

const DEBOUNCE_MS = 500;
const MIN_QUERY_LENGTH = 2;

/**
 * Encapsulates Global Sidebar Message Search:
 * - 500ms debounce + instant trigger on Enter
 * - Cursor-based pagination ("Load older messages")
 * - Client-side Map cache ({ results, hasMore, nextCursor }) + Subset Filtering when !hasMore
 * - Real-time in-memory sync on send / receive / edit / delete (0 extra API calls)
 * - AbortController to cancel stale in-flight requests
 */
export const useGlobalMessageSearch = (searchQuery = '') => {
  const [results, setResults] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const cacheRef = useRef(new Map());
  const abortControllerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const activeQueryRef = useRef(searchQuery);
  activeQueryRef.current = searchQuery;

  // If a shorter cached prefix has hasMore === false, we already have 100% of matches
  // in memory and can filter locally with 0 API calls.
  const getSubsetEntryFromPrefix = useCallback((trimmedQuery, normalizedQuery) => {
    for (let len = normalizedQuery.length - 1; len >= MIN_QUERY_LENGTH; len -= 1) {
      const prefix = normalizedQuery.slice(0, len);
      const cached = cacheRef.current.get(prefix);
      if (cached && cached.hasMore === false && Array.isArray(cached.results)) {
        return {
          results: cached.results.filter((msg) => doesMessageMatchQuery(msg, trimmedQuery)),
          hasMore: false,
          nextCursor: null,
        };
      }
    }
    return null;
  }, []);

  const applyEntry = useCallback((entry) => {
    setResults(entry.results || []);
    setHasMore(Boolean(entry.hasMore));
    setNextCursor(entry.nextCursor || null);
  }, []);

  const executeSearch = useCallback(async (rawQuery) => {
    const trimmed = rawQuery.trim();
    const normalized = trimmed.toLowerCase();

    if (normalized.length < MIN_QUERY_LENGTH) {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      applyEntry({ results: [], hasMore: false, nextCursor: null });
      setIsSearching(false);
      return;
    }

    // 1. Check exact client Map cache (0ms)
    if (cacheRef.current.has(normalized)) {
      applyEntry(cacheRef.current.get(normalized));
      setIsSearching(false);
      return;
    }

    // 2. Subset filtering from any complete (!hasMore) cached prefix (0ms, 0 API calls)
    const subsetEntry = getSubsetEntryFromPrefix(trimmed, normalized);
    if (subsetEntry !== null) {
      cacheRef.current.set(normalized, subsetEntry);
      applyEntry(subsetEntry);
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
    setIsLoadingMore(false);
    try {
      const response = await searchMessagesApi(trimmed, {}, controller.signal);
      const payload = response?.data?.data || {};
      const entry = {
        results: Array.isArray(payload.results) ? payload.results : [],
        hasMore: Boolean(payload.hasMore),
        nextCursor: payload.nextCursor || null,
      };
      cacheRef.current.set(normalized, entry);
      applyEntry(entry);
    } catch (error) {
      if (error?.name !== 'CanceledError' && error?.code !== 'ERR_CANCELED') {
        console.warn('Global message search failed:', error);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsSearching(false);
      }
    }
  }, [applyEntry, getSubsetEntryFromPrefix]);

  // Debounced search on query change
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = searchQuery.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      applyEntry({ results: [], hasMore: false, nextCursor: null });
      setIsSearching(false);
      return;
    }

    const normalized = trimmed.toLowerCase();
    if (cacheRef.current.has(normalized)) {
      applyEntry(cacheRef.current.get(normalized));
      setIsSearching(false);
      return;
    }

    const subsetEntry = getSubsetEntryFromPrefix(trimmed, normalized);
    if (subsetEntry !== null) {
      cacheRef.current.set(normalized, subsetEntry);
      applyEntry(subsetEntry);
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
  }, [searchQuery, executeSearch, applyEntry, getSubsetEntryFromPrefix]);

  // Load older search results using 2-field cursor (before, beforeId)
  const loadMoreMessages = useCallback(async () => {
    const trimmed = activeQueryRef.current.trim();
    const normalized = trimmed.toLowerCase();

    if (trimmed.length < MIN_QUERY_LENGTH || !hasMore || !nextCursor || isLoadingMore || isSearching) {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoadingMore(true);

    try {
      const response = await searchMessagesApi(
        trimmed,
        { before: nextCursor.before, beforeId: nextCursor.beforeId },
        controller.signal
      );
      const payload = response?.data?.data || {};
      const incoming = Array.isArray(payload.results) ? payload.results : [];

      setResults((prev) => {
        const seenIds = new Set(prev.map((item) => item._id));
        const merged = [...prev, ...incoming.filter((item) => !seenIds.has(item._id))];
        const updatedEntry = {
          results: merged,
          hasMore: Boolean(payload.hasMore),
          nextCursor: payload.nextCursor || null,
        };
        cacheRef.current.set(normalized, updatedEntry);
        return merged;
      });
      setHasMore(Boolean(payload.hasMore));
      setNextCursor(payload.nextCursor || null);
    } catch (error) {
      if (error?.name !== 'CanceledError' && error?.code !== 'ERR_CANCELED') {
        console.warn('Load more search messages failed:', error);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoadingMore(false);
      }
    }
  }, [hasMore, nextCursor, isLoadingMore, isSearching]);

  // Instant search trigger on Enter key
  const triggerImmediateSearch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    executeSearch(searchQuery);
  }, [searchQuery, executeSearch]);

  const invalidateSearchCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  // Pattern A: Real-time in-memory live sync (0 extra API calls, preserves loaded pages)
  const syncNewMessageInSearch = useCallback((newMsg) => {
    cacheRef.current.clear();
    if (!newMsg?._id) return;
    const trimmed = activeQueryRef.current.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return;
    if (!doesMessageMatchQuery(newMsg, trimmed)) return;

    setResults((prev) => {
      if (prev.some((m) => m._id === newMsg._id)) return prev;
      return [newMsg, ...prev];
    });
  }, []);

  const syncDeletedMessageInSearch = useCallback((messageId) => {
    cacheRef.current.clear();
    if (!messageId) return;
    setResults((prev) => prev.filter((m) => m._id !== messageId));
  }, []);

  const syncEditedMessageInSearch = useCallback((editedFields) => {
    cacheRef.current.clear();
    if (!editedFields?._id) return;
    const trimmed = activeQueryRef.current.trim();

    setResults((prev) => {
      const exists = prev.some((m) => m._id === editedFields._id);
      if (!exists) return prev;

      return prev
        .map((m) => (m._id === editedFields._id ? { ...m, ...editedFields } : m))
        .filter((m) => (trimmed.length >= MIN_QUERY_LENGTH ? doesMessageMatchQuery(m, trimmed) : true));
    });
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  return {
    globalSearchResults: results,
    hasMoreMessages: hasMore,
    isSearchingMessages: isSearching,
    isLoadingMoreMessages: isLoadingMore,
    loadMoreMessages,
    triggerImmediateSearch,
    invalidateSearchCache,
    syncNewMessageInSearch,
    syncDeletedMessageInSearch,
    syncEditedMessageInSearch,
  };
};
