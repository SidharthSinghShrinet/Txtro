import { useCallback, useEffect, useMemo, useState } from 'react';
import { doesMessageMatchQuery } from '../utils/searchUtils';

/**
 * Encapsulates In-Chat Search (0 API calls — pure in-memory search over loaded messages):
 * - Ctrl/Cmd+F shortcut
 * - Newest-first 1-of-N match ordering
 * - Smooth jump-to-message navigation
 */
export const useInChatSearch = ({
  messages = [],
  conversationKey = null,
  onJumpToMessage = () => { },
  onClearHighlight = () => { },
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  // Reset in-chat search when switching contacts
  useEffect(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setActiveMatchIndex(0);
  }, [conversationKey]);

  // Compute matching message IDs in newest-first order (1 of N = most recent match)
  const matchedMessageIds = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (!isSearchOpen || trimmed.length < 2) return [];

    const ids = [];
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (doesMessageMatchQuery(messages[i], trimmed)) {
        ids.push(messages[i]._id);
      }
    }
    return ids;
  }, [messages, isSearchOpen, searchQuery]);

  // Debounce auto-scroll while typing so intermediate letters ("r", "re", "p")
  // don't yank the user around mid-word; clear highlight immediately if 0 matches.
  useEffect(() => {
    if (!isSearchOpen || matchedMessageIds.length === 0) {
      onClearHighlight();
      return;
    }

    const safeIndex = Math.min(activeMatchIndex, matchedMessageIds.length - 1);
    const targetId = matchedMessageIds[safeIndex];

    const timer = setTimeout(() => {
      onJumpToMessage(targetId);
    }, 300);

    return () => clearTimeout(timer);
  }, [isSearchOpen, matchedMessageIds, activeMatchIndex, onJumpToMessage, onClearHighlight]);

  // Ctrl+F / Cmd+F keyboard shortcut when a conversation is open
  useEffect(() => {
    if (!conversationKey) return;
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [conversationKey]);

  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setActiveMatchIndex(0);
  }, []);

  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);
    setActiveMatchIndex(0);
  }, []);

  // Older match (↑ button) moves forward in newest-first array
  const goToOlderMatch = useCallback(() => {
    if (matchedMessageIds.length === 0) return;
    setActiveMatchIndex((prev) => (prev + 1) % matchedMessageIds.length);
  }, [matchedMessageIds.length]);

  // Newer match (↓ button) moves backward in newest-first array
  const goToNewerMatch = useCallback(() => {
    if (matchedMessageIds.length === 0) return;
    setActiveMatchIndex((prev) =>
      (prev - 1 + matchedMessageIds.length) % matchedMessageIds.length
    );
  }, [matchedMessageIds.length]);

  const activeMessageId =
    isSearchOpen && matchedMessageIds.length > 0
      ? matchedMessageIds[Math.min(activeMatchIndex, matchedMessageIds.length - 1)]
      : null;

  return {
    isSearchOpen,
    searchQuery,
    matchedCount: matchedMessageIds.length,
    activeMatchPosition: matchedMessageIds.length > 0 ? Math.min(activeMatchIndex, matchedMessageIds.length - 1) + 1 : 0,
    activeMessageId,
    openSearch,
    closeSearch,
    handleSearchChange,
    goToOlderMatch,
    goToNewerMatch,
  };
};
