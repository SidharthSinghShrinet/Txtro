import React, { useRef, useState } from 'react';
import Sidebar from '../components/chat/Sidebar';
import ChatContainer from '../components/chat/ChatContainer';
import NoChatSelected from '../components/chat/NoChatSelected';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';
import { getAllUsersWithMetadataApi, getMessagesApi, sendMessageApi, toggleReactionApi, deleteForMeApi, deleteForEveryoneApi, editMessageApi } from '../api/api';
import { useEffect } from 'react';
import { uploadFilesDirectlyToCloud } from '../utils/fileUpload';
import {
    saveDraftToStorage,
    deleteDraftFromStorage,
    getAllDraftFromStorage,
} from '../utils/draftStorage';

function HomePage() {
    const { user, logout } = useAuth();
    const { socket, onlineUsers } = useSocket();

    // Pure UI state placeholders (You can replace/wire with your API data)
    const [selectedUser, setSelectedUser] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [messageInput, setMessageInput] = useState('');
    const [replyingToMessage, setReplyingToMessage] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);
    const editingMessageRef = useRef(null);
    const draftBeforeEditRef = useRef('');
    const [isTyping, setIsTyping] = useState(false);
    const typingTimeoutRef = useRef(null);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const abortUploadRef = useRef(null);
    const [draftsMap, setDraftsMap] = useState({});
    const draftDebounceRef = useRef(null);
    //All users
    const [users, setUsers] = useState([]);

    // Load saved drafts from IndexedDB on initial mount
    useEffect(() => {
        async function loadDrafts() {
            try {
                const drafts = await getAllDraftFromStorage();
                setDraftsMap(drafts || {});
            } catch (err) {
                console.warn("Could not load drafts from IndexedDB:", err);
            }
        }
        loadDrafts();
    }, []);

    // Sample contacts (Replace with your actual users from GET /api/v1/users/all)
    useEffect(() => {
        async function getAllUsers() {
            try {
                const response = await getAllUsersWithMetadataApi();
                console.log(response)
                if (response?.status === 200) {
                    setUsers(response?.data?.data);
                }
            } catch (error) {

                toast.error(error?.response?.data?.message || error?.message);
            }
        }
        getAllUsers();
    }, []);

    // All Messages between LoggedInUser and Selected User
    const [messages, setMessages] = useState([]);

    // Sample messages (Replace with your actual messages from GET /api/v1/messages/:id)
    useEffect(() => {
        async function getMessages() {
            if (!selectedUser) return;
            setMessages([]);
            try {
                const response = await getMessagesApi(selectedUser?._id);
                if (response?.status === 200) {
                    const fetchedMessages = response?.data?.data || [];
                    setMessages(fetchedMessages);

                    const latestMessage = fetchedMessages.length > 0
                        ? fetchedMessages[fetchedMessages.length - 1]
                        : null;

                    // Ensure unread counter is reset & lastMessage strictly mirrors DB source of truth
                    setUsers((prev) =>
                        prev.map((u) =>
                            u?._id === selectedUser?._id
                                ? {
                                    ...u,
                                    unreadCount: 0,
                                    lastMessage: latestMessage,
                                }
                                : u
                        )
                    );
                }
            } catch (error) {
                toast.error(error?.response?.data?.message || error?.message)
            }
        }
        getMessages();
    }, [selectedUser]);


    // UI Handlers
    const handleSelectUser = (contact) => {
        // 1. Save active draft for previous contact before switching
        if (selectedUser && selectedUser._id !== contact?._id) {
            const outgoingText = editingMessageRef.current ? (draftBeforeEditRef.current || "") : messageInput;
            const outgoingFiles = selectedFiles;
            saveDraftToStorage(selectedUser._id, outgoingText, outgoingFiles);
            setDraftsMap((prev) => {
                const hasDraft = Boolean(outgoingText?.trim()) || outgoingFiles?.length > 0;
                if (!hasDraft) {
                    const copy = { ...prev };
                    delete copy[selectedUser._id];
                    return copy;
                }
                return {
                    ...prev,
                    [selectedUser._id]: { text: outgoingText, files: outgoingFiles },
                };
            });
        }

        setSelectedUser(contact);
        setReplyingToMessage(null);
        setEditingMessage(null);
        editingMessageRef.current = null;
        draftBeforeEditRef.current = '';
        setIsTyping(false);
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // 2. Restore incoming contact's draft (text + staged files)
        const incomingDraft = draftsMap[contact?._id] || null;
        setMessageInput(incomingDraft?.text || "");
        setSelectedFiles(incomingDraft?.files || []);

        // Always reset unread counter for this contact to 0
        setUsers((prev) =>
            prev.map((u) =>
                u?._id === contact?._id
                    ? {
                        ...u,
                        unreadCount: 0,
                        lastMessage: u.lastMessage
                            ? { ...u.lastMessage, status: "read" }
                            : u.lastMessage,
                    }
                    : u
            )
        );
    };

    const handleBackToSidebar = () => {
        // Save current draft before going back on mobile
        if (selectedUser) {
            const outgoingText = editingMessageRef.current ? (draftBeforeEditRef.current || "") : messageInput;
            const outgoingFiles = selectedFiles;
            saveDraftToStorage(selectedUser._id, outgoingText, outgoingFiles);
            setDraftsMap((prev) => {
                const hasDraft = Boolean(outgoingText?.trim()) || outgoingFiles?.length > 0;
                if (!hasDraft) {
                    const copy = { ...prev };
                    delete copy[selectedUser._id];
                    return copy;
                }
                return {
                    ...prev,
                    [selectedUser._id]: { text: outgoingText, files: outgoingFiles },
                };
            });
        }

        setSelectedUser(null);
        setReplyingToMessage(null);
        setEditingMessage(null);
        editingMessageRef.current = null;
        draftBeforeEditRef.current = '';
        setIsTyping(false);
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
    };

    // Handle typing debounce on input change
    const handleMessageInputChange = (e) => {
        const value = e.target.value;
        setMessageInput(value);

        // Auto-save draft to IndexedDB (debounced ~300ms)
        // ⚠️ CRITICAL: Never overwrite/save draft while user is editing an existing message!
        if (selectedUser && !editingMessageRef.current) {
            if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current);
            draftDebounceRef.current = setTimeout(() => {
                saveDraftToStorage(selectedUser._id, value, selectedFiles);
                setDraftsMap((prev) => {
                    const hasDraft = Boolean(value?.trim()) || selectedFiles?.length > 0;
                    if (!hasDraft) {
                        const copy = { ...prev };
                        delete copy[selectedUser._id];
                        return copy;
                    }
                    return {
                        ...prev,
                        [selectedUser._id]: { text: value, files: selectedFiles },
                    };
                });
            }, 300);
        }

        if (!socket || !selectedUser) return;

        // Emit that logged-in user started typing
        socket.emit("typing", { receiverId: selectedUser._id });

        // Reset previous timer
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Emit stopTyping after 2 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit("stopTyping", { receiverId: selectedUser._id });
        }, 2000);
    };

    const handleStartEdit = (msg) => {
        if (!msg || msg.messageType !== "text") return;
        if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current);
        draftBeforeEditRef.current = messageInput;
        setEditingMessage(msg);
        editingMessageRef.current = msg;
        setMessageInput(msg.message || "");
        setReplyingToMessage(null);
    };

    const handleCancelEdit = () => {
        if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current);
        setEditingMessage(null);
        editingMessageRef.current = null;
        const restoredDraft = draftBeforeEditRef.current || "";
        setMessageInput(restoredDraft);
        draftBeforeEditRef.current = "";

        // Synchronize draft state and IndexedDB with the restored draft
        if (selectedUser) {
            const hasDraft = Boolean(restoredDraft?.trim()) || selectedFiles.length > 0;
            if (hasDraft) {
                saveDraftToStorage(selectedUser._id, restoredDraft, selectedFiles);
                setDraftsMap((prev) => ({
                    ...prev,
                    [selectedUser._id]: { text: restoredDraft, files: selectedFiles },
                }));
            } else {
                deleteDraftFromStorage(selectedUser._id);
                setDraftsMap((prev) => {
                    const copy = { ...prev };
                    delete copy[selectedUser._id];
                    return copy;
                });
            }
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if ((!messageInput.trim() && selectedFiles.length === 0) || !selectedUser) return;

        // Stop typing immediately when message is submitted
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        if (socket && selectedUser) {
            socket.emit("stopTyping", { receiverId: selectedUser._id });
        }

        // Live Message Edit Flow (Phase 13)
        if (editingMessage) {
            if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current);

            const trimmed = messageInput.trim();
            if (!trimmed) {
                toast.error("Message content cannot be empty");
                return;
            }
            const msgId = editingMessage._id;
            const originalText = editingMessage.message;
            const originalIsEdited = editingMessage.isEdited;
            const originalEditedAt = editingMessage.editedAt;
            const nowIso = new Date().toISOString();

            // 1. Optimistic Update (0ms perceived latency)
            setMessages((prev) =>
                prev.map((m) =>
                    m._id === msgId
                        ? { ...m, message: trimmed, isEdited: true, editedAt: nowIso }
                        : m
                )
            );
            setUsers((prev) =>
                prev.map((u) => {
                    if (u._id === selectedUser._id && u.lastMessage?._id === msgId) {
                        return {
                            ...u,
                            lastMessage: {
                                ...u.lastMessage,
                                message: trimmed,
                                isEdited: true,
                                editedAt: nowIso,
                            },
                        };
                    }
                    return u;
                })
            );

            // Exit edit mode & restore prior draft
            setEditingMessage(null);
            editingMessageRef.current = null;
            const restoredDraft = draftBeforeEditRef.current || "";
            setMessageInput(restoredDraft);
            draftBeforeEditRef.current = "";

            // Synchronize draft state and IndexedDB with the restored draft
            if (selectedUser) {
                const hasDraft = Boolean(restoredDraft?.trim()) || selectedFiles.length > 0;
                if (hasDraft) {
                    saveDraftToStorage(selectedUser._id, restoredDraft, selectedFiles);
                    setDraftsMap((prev) => ({
                        ...prev,
                        [selectedUser._id]: { text: restoredDraft, files: selectedFiles },
                    }));
                } else {
                    deleteDraftFromStorage(selectedUser._id);
                    setDraftsMap((prev) => {
                        const copy = { ...prev };
                        delete copy[selectedUser._id];
                        return copy;
                    });
                }
            }

            try {
                const res = await editMessageApi(msgId, trimmed);
                if (res?.data?.data) {
                    const confirmed = res.data.data;
                    setMessages((prev) =>
                        prev.map((m) => (m._id === msgId ? confirmed : m))
                    );
                }
                toast.success("Message edited");
            } catch (err) {
                console.error("Failed to edit message:", err);
                // Rollback optimistic update on error
                setMessages((prev) =>
                    prev.map((m) =>
                        m._id === msgId
                            ? { ...m, message: originalText, isEdited: originalIsEdited, editedAt: originalEditedAt }
                            : m
                    )
                );
                toast.error(err?.response?.data?.message || "Could not edit message");
            }
            return;
        }

        const currentText = messageInput.trim();
        const currentFiles = [...selectedFiles];
        const currentReplyTo = replyingToMessage;

        // 1. Clear input & staging dock immediately (snappy instant feel)
        setMessageInput("");
        setSelectedFiles([]);
        setReplyingToMessage(null);

        // Clear active draft from IndexedDB & memory
        if (selectedUser) {
            deleteDraftFromStorage(selectedUser._id);
            setDraftsMap((prev) => {
                const copy = { ...prev };
                delete copy[selectedUser._id];
                return copy;
            });
        }

        // 2. Build local Optimistic Message (0 ms latency!)
        const tempId = `temp-${Date.now()}`;
        const optimisticAttachments = currentFiles.map((file) => ({
            fileUrl: URL.createObjectURL(file), // Instant in-memory blob preview
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
        }));

        const hasImages = currentFiles.some((f) => f.type?.startsWith("image/"));
        const hasAudio = currentFiles.some((f) => f.type?.startsWith("audio/"));
        const hasDocs = currentFiles.some((f) => !f.type?.startsWith("image/") && !f.type?.startsWith("audio/"));

        let optimisticMessageType = "text";
        if (currentFiles.length > 0) {
            if (hasImages && hasDocs) optimisticMessageType = "mixed";
            else if (hasAudio) optimisticMessageType = "audio";
            else if (hasImages) optimisticMessageType = "image";
            else optimisticMessageType = "document";
        }

        const optimisticMessage = {
            _id: tempId,
            senderId: user._id,
            receiverId: selectedUser._id,
            message: currentText,
            status: "sending", // Shows the sleek clock icon
            messageType: optimisticMessageType,
            attachments: optimisticAttachments,
            replyTo: currentReplyTo?._id || null,
            replySnapshot: currentReplyTo ? {
                senderId: currentReplyTo.senderId?._id || currentReplyTo.senderId,
                senderName: (currentReplyTo.senderId?._id || currentReplyTo.senderId) === user._id
                    ? "You"
                    : (selectedUser?.fullname || selectedUser?.username || "User"),
                message: currentReplyTo.message || "",
                messageType: currentReplyTo.messageType || "text",
                fileUrl: currentReplyTo.attachments?.[0]?.fileUrl || null,
                fileName: currentReplyTo.attachments?.[0]?.fileName || null,
            } : null,
            createdAt: new Date().toISOString(),
        };

        // Instantly push optimistic bubble into chat stream
        setMessages((prev) => [...prev, optimisticMessage]);

        // Capture previous lastMessage before optimistic update for clean rollback on error
        const previousLastMessage = users.find((u) => u._id === selectedUser._id)?.lastMessage;

        // Optimistically update last message in sidebar
        setUsers((prev) => {
            return prev
                .map((u) => (u._id === selectedUser._id ? { ...u, lastMessage: optimisticMessage } : u))
                .sort((a, b) => {
                    const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
                    const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
                    return timeB - timeA;
                });
        });

        try {
            let uploadedAttachments = [];
            let uploadIntentId = null;
            // 3. Upload files to OCI in background with live progress tracking & abort capability
            if (currentFiles.length > 0) {
                setIsUploading(true);
                setUploadProgress(0);
                const uploadResult = await uploadFilesDirectlyToCloud(
                    currentFiles,
                    (percent) => {
                        setUploadProgress(percent);
                    },
                    (abortFn) => {
                        abortUploadRef.current = abortFn;
                    }
                );
                uploadedAttachments = uploadResult?.attachments || [];
                uploadIntentId = uploadResult?.uploadIntentId || null;
            }

            // 4. Send message to backend
            const response = await sendMessageApi({
                message: currentText,
                attachments: uploadedAttachments,
                uploadIntentId,
                replyTo: currentReplyTo?._id || null
            }, selectedUser._id);

            if (response?.status === 200 || response?.status === 201) {
                const confirmedMsg = response?.data?.data;

                // 5. Swap out optimistic message with the confirmed permanent message
                setMessages((prev) =>
                    prev.map((msg) => (msg._id === tempId ? confirmedMsg : msg))
                );

                // Update sidebar with confirmed message
                setUsers((prev) =>
                    prev.map((u) => (u._id === selectedUser._id ? { ...u, lastMessage: confirmedMsg } : u))
                );

                // Revoke temporary blob URLs to free browser RAM
                optimisticAttachments.forEach((att) => {
                    if (typeof att.fileUrl === "string" && att.fileUrl.startsWith("blob:")) {
                        try { URL.revokeObjectURL(att.fileUrl); } catch { }
                    }
                });
            }
        } catch (error) {
            // Revoke temporary blob URLs if message aborted or failed
            optimisticAttachments.forEach((att) => {
                if (typeof att.fileUrl === "string" && att.fileUrl.startsWith("blob:")) {
                    try { URL.revokeObjectURL(att.fileUrl); } catch { }
                }
            });

            // Revert optimistic lastMessage in sidebar so failed message never lingers as ghost
            setUsers((prev) =>
                prev.map((u) => (u._id === selectedUser._id ? { ...u, lastMessage: previousLastMessage } : u))
            );

            if (error?.message === "Upload aborted by user") {
                toast("Upload cancelled", { icon: "🚫" });
                // Remove the optimistic bubble completely from the stream
                setMessages((prev) => prev.filter((msg) => msg._id !== tempId));
            } else {
                toast.error(error?.response?.data?.message || error?.message || "Failed to send message");
                // Mark optimistic message as failed with a red indicator
                setMessages((prev) =>
                    prev.map((msg) => (msg._id === tempId ? { ...msg, status: "failed" } : msg))
                );
            }
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
            abortUploadRef.current = null;
        }
    };

    const handleSendAudio = async (audioFile, duration, waveform = []) => {
        if (!audioFile || !selectedUser) return;

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        if (socket && selectedUser) {
            socket.emit("stopTyping", { receiverId: selectedUser._id });
        }

        const currentReplyTo = replyingToMessage;
        setReplyingToMessage(null);

        const tempId = `temp-audio-${Date.now()}`;
        const blobUrl = URL.createObjectURL(audioFile);
        const optimisticAttachment = {
            fileUrl: blobUrl,
            fileName: audioFile.name,
            fileSize: audioFile.size,
            mimeType: audioFile.type || "audio/webm",
            duration: duration || 1,
            waveform: waveform || [],
        };

        const optimisticMessage = {
            _id: tempId,
            senderId: user._id,
            receiverId: selectedUser._id,
            message: "",
            status: "sending",
            messageType: "audio",
            attachments: [optimisticAttachment],
            replyTo: currentReplyTo?._id || null,
            replySnapshot: currentReplyTo ? {
                senderId: currentReplyTo.senderId?._id || currentReplyTo.senderId,
                senderName: (currentReplyTo.senderId?._id || currentReplyTo.senderId) === user._id
                    ? "You"
                    : (selectedUser?.fullname || selectedUser?.username || "User"),
                message: currentReplyTo.message || "",
                messageType: currentReplyTo.messageType || "text",
                fileUrl: currentReplyTo.attachments?.[0]?.fileUrl || null,
                fileName: currentReplyTo.attachments?.[0]?.fileName || null,
            } : null,
            createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, optimisticMessage]);

        const previousLastMessage = users.find((u) => u._id === selectedUser._id)?.lastMessage;

        setUsers((prev) => {
            return prev
                .map((u) => (u._id === selectedUser._id ? { ...u, lastMessage: optimisticMessage } : u))
                .sort((a, b) => {
                    const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
                    const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
                    return timeB - timeA;
                });
        });

        try {
            setIsUploading(true);
            setUploadProgress(0);

            // Upload audio file directly to Oracle Cloud Infrastructure (OCI)
            const uploadResult = await uploadFilesDirectlyToCloud(
                [audioFile],
                (percent) => setUploadProgress(percent),
                (abortFn) => { abortUploadRef.current = abortFn; }
            );

            const uploadedAttachments = uploadResult?.attachments?.map((att) => ({
                ...att,
                duration: duration || 1,
                waveform: waveform || [],
            })) || [];
            const uploadIntentId = uploadResult?.uploadIntentId || null;

            const response = await sendMessageApi({
                message: "",
                attachments: uploadedAttachments,
                messageType: "audio",
                uploadIntentId,
                replyTo: currentReplyTo?._id || null
            }, selectedUser._id);

            if (response?.status === 200 || response?.status === 201) {
                const confirmedMsg = response?.data?.data;

                setMessages((prev) =>
                    prev.map((msg) => (msg._id === tempId ? confirmedMsg : msg))
                );

                setUsers((prev) =>
                    prev.map((u) => (u._id === selectedUser._id ? { ...u, lastMessage: confirmedMsg } : u))
                );

                try { URL.revokeObjectURL(blobUrl); } catch { }
            }
        } catch (error) {
            try { URL.revokeObjectURL(blobUrl); } catch { }

            setUsers((prev) =>
                prev.map((u) => (u._id === selectedUser._id ? { ...u, lastMessage: previousLastMessage } : u))
            );

            if (error?.message === "Upload aborted by user") {
                toast("Audio upload cancelled", { icon: "🚫" });
                setMessages((prev) => prev.filter((msg) => msg._id !== tempId));
            } else {
                toast.error(error?.response?.data?.message || error?.message || "Failed to send audio note");
                setMessages((prev) =>
                    prev.map((msg) => (msg._id === tempId ? { ...msg, status: "failed" } : msg))
                );
            }
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
            abortUploadRef.current = null;
        }
    };

    // Toggle Reaction on a Message with 0ms Optimistic UI
    const handleToggleReaction = async (messageId, emoji) => {
        if (!messageId || !emoji || !user?._id) return;

        // 1. Optimistic UI update (0ms perceived latency)
        let previousMessages;
        setMessages((prevMessages) => {
            previousMessages = prevMessages;
            return prevMessages.map((msg) => {
                if (msg._id !== messageId) return msg;

                const currentReactions = Array.isArray(msg.reactions) ? [...msg.reactions] : [];
                const existingIdx = currentReactions.findIndex(
                    (r) => (r.userId?._id || r.userId)?.toString() === user._id.toString()
                );

                if (existingIdx > -1) {
                    if (currentReactions[existingIdx].emoji === emoji) {
                        // Clicked same emoji -> Toggle off (remove)
                        currentReactions.splice(existingIdx, 1);
                    } else {
                        // Clicked different emoji -> Update to new emoji
                        currentReactions[existingIdx] = {
                            ...currentReactions[existingIdx],
                            emoji,
                        };
                    }
                } else {
                    // New reaction from current user
                    currentReactions.push({
                        userId: user._id,
                        emoji,
                    });
                }

                return { ...msg, reactions: currentReactions };
            });
        });

        // 2. Persist to backend
        try {
            const res = await toggleReactionApi(messageId, emoji);
            if (res.data?.data?.reactions) {
                // Synchronize with server confirmation
                setMessages((prev) =>
                    prev.map((m) =>
                        m._id === messageId ? { ...m, reactions: res.data.data.reactions } : m
                    )
                );
            }
        } catch (err) {
            console.error("Failed to toggle reaction:", err);
            // Rollback optimistic update
            if (previousMessages) {
                setMessages(previousMessages);
            }
            toast.error(err?.response?.data?.message || "Could not update reaction");
        }
    };

    // Handle Delete Message (Phase 12: Dual Deletion Modes)
    const handleDeleteMessage = async (messageId, deleteType) => {
        if (!messageId || !selectedUser) return;

        const previousMessages = [...messages];
        const targetMsg = messages.find((m) => m._id === messageId);
        if (!targetMsg) return;

        if (deleteType === "me") {
            // 1. Optimistic removal for current user (0ms perceived latency)
            const updatedMessages = messages.filter((m) => m._id !== messageId);
            setMessages(updatedMessages);

            const newLatestMessage = updatedMessages.length > 0 ? updatedMessages[updatedMessages.length - 1] : null;
            setUsers((prev) =>
                prev.map((u) => (u._id === selectedUser._id ? { ...u, lastMessage: newLatestMessage } : u))
            );

            try {
                await deleteForMeApi(messageId);
                toast.success("Message deleted for you");
            } catch (err) {
                console.error("Failed to delete message for me:", err);
                setMessages(previousMessages);
                toast.error(err?.response?.data?.message || "Could not delete message");
            }
        } else if (deleteType === "everyone") {
            // 1. Optimistic tombstone update for everyone (0ms perceived latency)
            setMessages((prev) =>
                prev.map((m) =>
                    m._id === messageId
                        ? { ...m, isDeletedForEveryone: true, message: "", attachments: [] }
                        : m
                )
            );

            setUsers((prev) =>
                prev.map((u) => {
                    if (u._id === selectedUser._id && u.lastMessage?._id === messageId) {
                        return {
                            ...u,
                            lastMessage: {
                                ...u.lastMessage,
                                isDeletedForEveryone: true,
                                message: "",
                                attachments: []
                            }
                        };
                    }
                    return u;
                })
            );

            try {
                await deleteForEveryoneApi(messageId);
                toast.success("Message deleted for everyone");
            } catch (err) {
                console.error("Failed to delete message for everyone:", err);
                setMessages(previousMessages);
                toast.error(err?.response?.data?.message || "Could not delete message for everyone");
            }
        }
    };

    // Listen for Incoming Messages, Read Receipts & Live Typing in real-time
    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (incomingMessage) => {
            const isChatOpen = selectedUser && selectedUser._id === incomingMessage.senderId;

            if (isChatOpen) {
                setMessages((prev) => [...prev, incomingMessage]);

                // Tell server to mark this message as read immediately after receiving it
                socket.emit("markAsRead", {
                    conversationId: incomingMessage.conversationId,
                    senderId: incomingMessage.senderId,
                });
            }

            // Update lastMessage and unreadCount in sidebar
            setUsers((prevUsers) => {
                return prevUsers
                    .map((u) => {
                        if (u._id === incomingMessage.senderId) {
                            return {
                                ...u,
                                lastMessage: incomingMessage,
                                unreadCount: isChatOpen ? 0 : (u.unreadCount || 0) + 1,
                            };
                        }
                        return u;
                    })
                    .sort((a, b) => {
                        const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
                        const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
                        return timeB - timeA;
                    });
            });
        };

        const handleUserTyping = ({ senderId }) => {
            if (selectedUser && selectedUser._id === senderId) {
                setIsTyping(true);
            }
        };

        const handleUserStoppedTyping = ({ senderId }) => {
            if (selectedUser && selectedUser._id === senderId) {
                setIsTyping(false);
            }
        };

        // When other user opens your chat, turn your sent message ticks to 'read' (blue ticks)
        const handleMessageSeen = ({ seenBy }) => {
            if (selectedUser && selectedUser._id === seenBy) {
                setMessages((prevMessages) =>
                    prevMessages.map((msg) =>
                        msg.senderId === user?._id ? { ...msg, status: "read" } : msg
                    )
                );
            }
        };

        // When Receipient Connects to the Internet, turn your 'sent' ticks(1 ) into 'delivered'(2)
        const handleMessageDelievered = ({ delieveredTo }) => {
            if (selectedUser && selectedUser?._id === delieveredTo) {
                setMessages((prevMessages) =>
                    prevMessages.map((msg) =>
                        msg.senderId === user?._id && msg.status === "sent" ? { ...msg, status: "delivered" } : msg
                    )
                );
            }
        };

        // Listen for when someone goes online or offline in real-time
        const handleUserStatusUpdate = ({ userId, isOnline, lastSeen }) => {
            // 1. Update the chat window if you are currently chatting with this user
            setSelectedUser((prev) => {
                if (prev && prev._id === userId) {
                    return { ...prev, isOnline, lastSeen };
                }
                return prev;
            });
            // 2. Update the contact in the sidebar list
            setUsers((prevUsers) =>
                prevUsers.map((u) =>
                    u._id === userId ? { ...u, isOnline, lastSeen } : u
                )
            );
        };

        // Real-time reactions sync (Phase 10)
        const handleMessageReactionUpdated = ({ messageId, reactions }) => {
            setMessages((prevMessages) =>
                prevMessages.map((msg) =>
                    msg._id === messageId ? { ...msg, reactions } : msg
                )
            );
        };

        // Real-time message deletion sync (Phase 12)
        const handleMessageDeleted = ({ messageId, deleteType }) => {
            if (deleteType === "everyone") {
                setMessages((prevMessages) =>
                    prevMessages.map((msg) =>
                        msg._id === messageId
                            ? { ...msg, isDeletedForEveryone: true, message: "", attachments: [] }
                            : msg
                    )
                );

                setUsers((prevUsers) =>
                    prevUsers.map((u) => {
                        if (u.lastMessage?._id === messageId) {
                            return {
                                ...u,
                                lastMessage: {
                                    ...u.lastMessage,
                                    isDeletedForEveryone: true,
                                    message: "",
                                    attachments: []
                                }
                            };
                        }
                        return u;
                    })
                );
            }
        };

        // Real-time message edit sync (Phase 13)
        const handleMessageEdited = ({ messageId, conversationId, message: newText, isEdited, editedAt }) => {
            setMessages((prevMessages) =>
                prevMessages.map((msg) =>
                    msg._id === messageId
                        ? { ...msg, message: newText, isEdited, editedAt }
                        : msg
                )
            );

            setUsers((prevUsers) =>
                prevUsers.map((u) => {
                    if (u.lastMessage?._id === messageId) {
                        return {
                            ...u,
                            lastMessage: {
                                ...u.lastMessage,
                                message: newText,
                                isEdited,
                                editedAt,
                            },
                        };
                    }
                    return u;
                })
            );
        };

        socket.on("newMessage", handleNewMessage);
        socket.on("userTyping", handleUserTyping);
        socket.on("userStoppedTyping", handleUserStoppedTyping);
        socket.on("messageSeen", handleMessageSeen);
        socket.on("userStatusUpdate", handleUserStatusUpdate);
        socket.on("messageDelivered", handleMessageDelievered);
        socket.on("messageReactionUpdated", handleMessageReactionUpdated);
        socket.on("messageDeleted", handleMessageDeleted);
        socket.on("messageEdited", handleMessageEdited);

        return () => {
            socket.off("newMessage", handleNewMessage);
            socket.off("userTyping", handleUserTyping);
            socket.off("userStoppedTyping", handleUserStoppedTyping);
            socket.off("messageSeen", handleMessageSeen);
            socket.off("userStatusUpdate", handleUserStatusUpdate);
            socket.off("messageDelivered", handleMessageDelievered);
            socket.off("messageReactionUpdated", handleMessageReactionUpdated);
            socket.off("messageDeleted", handleMessageDeleted);
            socket.off("messageEdited", handleMessageEdited);
        };
    }, [socket, selectedUser, user?._id]);

    const filteredUsers = users.filter((u) => u?.fullname?.toLowerCase().includes(searchQuery.toLowerCase()) || u?.username?.toLowerCase().includes(searchQuery.toLowerCase()))

    return (
        <div className="h-[100dvh] w-screen flex bg-slate-50 dark:bg-slate-950 overflow-hidden select-none transition-colors duration-200">
            {/* Background Ambient Glows */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/5 dark:bg-indigo-600/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-fuchsia-600/5 dark:bg-fuchsia-600/10 rounded-full blur-3xl" />
            </div>

            {/* Main Chat Layout */}
            <div className="relative z-10 w-full h-full flex overflow-hidden">
                {/* Left Sidebar: Visible on desktop, or on mobile when no chat is open */}
                <div className={`h-full ${selectedUser ? 'hidden md:flex' : 'flex w-full md:w-auto'}`}>
                    <Sidebar
                        currentUser={user}
                        users={filteredUsers}
                        selectedUser={selectedUser}
                        onSelectUser={handleSelectUser}
                        onlineUsers={onlineUsers || []}
                        searchQuery={searchQuery}
                        onSearchChange={(e) => setSearchQuery(e.target.value)}
                        onLogout={logout}
                        draftsMap={draftsMap}
                    />
                </div>

                {/* Right Area: Chat Window or Empty State */}
                <div className={`flex-1 h-full ${!selectedUser ? 'hidden md:flex' : 'flex'}`}>
                    {selectedUser ? (
                        <ChatContainer
                            key={selectedUser?._id}
                            selectedUser={selectedUser}
                            currentUser={user}
                            isOnline={onlineUsers?.includes(selectedUser?._id)}
                            isTyping={isTyping}
                            messages={messages}
                            messageText={messageInput}
                            onMessageChange={handleMessageInputChange}
                            onSendMessage={handleSendMessage}
                            onSendAudio={handleSendAudio}
                            onToggleReaction={handleToggleReaction}
                            onDeleteMessage={handleDeleteMessage}
                            onBack={handleBackToSidebar}
                            selectedFiles={selectedFiles}
                            onFilesSelect={(newFiles) => {
                                if (selectedFiles.length + newFiles.length > 10) {
                                    toast.error("You can select up to 10 files at once");
                                    return;
                                }
                                const updatedFiles = [...selectedFiles, ...newFiles];
                                setSelectedFiles(updatedFiles);
                                if (selectedUser) {
                                    saveDraftToStorage(selectedUser._id, messageInput, updatedFiles);
                                    setDraftsMap((prev) => ({
                                        ...prev,
                                        [selectedUser._id]: { text: messageInput, files: updatedFiles },
                                    }));
                                }
                            }}
                            onFileRemove={(indexToRemove) => {
                                const updatedFiles = indexToRemove === 'all'
                                    ? []
                                    : selectedFiles.filter((_, idx) => idx !== indexToRemove);
                                setSelectedFiles(updatedFiles);
                                if (selectedUser) {
                                    saveDraftToStorage(selectedUser._id, messageInput, updatedFiles);
                                    setDraftsMap((prev) => {
                                        const hasDraft = Boolean(messageInput?.trim()) || updatedFiles.length > 0;
                                        if (!hasDraft) {
                                            const copy = { ...prev };
                                            delete copy[selectedUser._id];
                                            return copy;
                                        }
                                        return {
                                            ...prev,
                                            [selectedUser._id]: { text: messageInput, files: updatedFiles },
                                        };
                                    });
                                }
                            }}
                            isUploading={isUploading}
                            uploadProgress={uploadProgress}
                            replyingToMessage={replyingToMessage}
                            onSelectReply={setReplyingToMessage}
                            onCancelReply={() => setReplyingToMessage(null)}
                            editingMessage={editingMessage}
                            onStartEdit={handleStartEdit}
                            onCancelEdit={handleCancelEdit}
                            onCancelUpload={() => {
                                if (abortUploadRef.current) {
                                    abortUploadRef.current();
                                }
                            }}
                        />
                    ) : (
                        <NoChatSelected />
                    )}
                </div>
            </div>
        </div>
    );
}

export default HomePage;