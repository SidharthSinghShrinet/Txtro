import { useState, useEffect, useCallback, useRef } from 'react';
import { getStarredMessagesApi } from '../api/api';

const VAULT_PAGE_LIMIT = 20;

const matchesVaultCategory = (msg, category) => {
    if (!msg) return false;
    if (category === 'all') return true;

    const hasUrlInText = typeof msg.message === 'string' && /https?:\/\//i.test(msg.message);
    const hasLinkPreview = Boolean(msg.linkPreview?.url);

    if (category === 'links') {
        return hasLinkPreview || hasUrlInText;
    }
    if (category === 'text') {
        return msg.messageType === 'text' && !hasLinkPreview && !hasUrlInText;
    }
    if (category === 'media') {
        return ['image', 'audio', 'mixed'].includes(msg.messageType);
    }
    if (category === 'docs') {
        return ['document', 'mixed'].includes(msg.messageType);
    }
    return true;
};

/**
 * Manages Starred Messages ("Saved Vault") state, category tabs,
 * 2-field cursor pagination, and real-time sync across edits/deletes/stars.
 */
export function useStarredMessages() {
    const [isVaultOpen, setIsVaultOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState('all');
    const [starredMessages, setStarredMessages] = useState([]);
    const [hasMoreStarred, setHasMoreStarred] = useState(false);
    const [nextCursor, setNextCursor] = useState(null);
    const [isLoadingStarred, setIsLoadingStarred] = useState(false);
    const [isLoadingMoreStarred, setIsLoadingMoreStarred] = useState(false);

    const abortControllerRef = useRef(null);

    const fetchStarredPage = useCallback(async (category, cursor = null, append = false) => {
        if (!append && abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        if (!append) {
            abortControllerRef.current = controller;
            setIsLoadingStarred(true);
        } else {
            setIsLoadingMoreStarred(true);
        }

        try {
            const response = await getStarredMessagesApi(
                category,
                {
                    before: cursor?.before,
                    beforeId: cursor?.beforeId,
                    limit: VAULT_PAGE_LIMIT,
                },
                controller.signal
            );

            if (response?.status === 200) {
                const payload = response?.data?.data || {};
                const incoming = Array.isArray(payload.results) ? payload.results : [];

                setStarredMessages((prev) => {
                    if (!append) return incoming;
                    const existingIds = new Set(prev.map((m) => m._id));
                    const uniqueIncoming = incoming.filter((m) => !existingIds.has(m._id));
                    return [...prev, ...uniqueIncoming];
                });
                setHasMoreStarred(Boolean(payload.hasMore));
                setNextCursor(payload.nextCursor || null);
            }
        } catch (err) {
            if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;
            console.error('Failed to fetch starred messages:', err);
        } finally {
            if (!append) {
                setIsLoadingStarred(false);
            } else {
                setIsLoadingMoreStarred(false);
            }
        }
    }, []);

    // Fetch whenever Vault opens or the active category tab changes
    useEffect(() => {
        if (!isVaultOpen) {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            return;
        }

        fetchStarredPage(activeCategory, null, false);

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [isVaultOpen, activeCategory, fetchStarredPage]);

    const loadMoreStarred = useCallback(() => {
        if (!hasMoreStarred || isLoadingMoreStarred || !nextCursor) return;
        fetchStarredPage(activeCategory, nextCursor, true);
    }, [hasMoreStarred, isLoadingMoreStarred, nextCursor, activeCategory, fetchStarredPage]);

    const syncStarredUpdate = useCallback(({ messageId, isStarred, message = null }) => {
        if (!messageId) return;

        if (!isStarred) {
            setStarredMessages((prev) => prev.filter((m) => m._id !== messageId));
            return;
        }

        if (!isVaultOpen) return;

        if (message) {
            if (!matchesVaultCategory(message, activeCategory)) return;
            setStarredMessages((prev) => {
                if (prev.some((m) => m._id === messageId)) return prev;
                return [message, ...prev].sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
            });
        } else {
            // If full message wasn't in local state (e.g. starred from another device), refresh current tab
            fetchStarredPage(activeCategory, null, false);
        }
    }, [isVaultOpen, activeCategory, fetchStarredPage]);

    const syncDeletedStarredMessage = useCallback((messageId) => {
        if (!messageId) return;
        setStarredMessages((prev) => prev.filter((m) => m._id !== messageId));
    }, []);

    const syncEditedStarredMessage = useCallback((messageId, newText, isEdited = true) => {
        if (!messageId) return;
        setStarredMessages((prev) =>
            prev.map((m) =>
                m._id === messageId
                    ? { ...m, message: newText, isEdited }
                    : m
            )
        );
    }, []);

    return {
        isVaultOpen,
        setIsVaultOpen,
        activeCategory,
        setActiveCategory,
        starredMessages,
        hasMoreStarred,
        isLoadingStarred,
        isLoadingMoreStarred,
        loadMoreStarred,
        syncStarredUpdate,
        syncDeletedStarredMessage,
        syncEditedStarredMessage,
    };
}
