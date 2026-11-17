import React from 'react';
import { Search, LogOut, MessageSquare, Users, Sun, Moon, Image as ImageIcon, FileText, Mic, FolderOpen, Ban } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const Sidebar = ({
  currentUser = null,
  users = [],
  selectedUser = null,
  onSelectUser = () => { },
  onlineUsers = [],
  searchQuery = '',
  onSearchChange = () => { },
  onLogout = () => { },
  draftsMap = {},
}) => {
  const { theme, toggleTheme } = useTheme();

  const formatLastMessageTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    return isToday
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getDraftSnippet = (draft) => {
    if (!draft) return '';
    if (draft.text?.trim()) return draft.text.trim();

    const files = draft.files || [];
    if (files.length === 0) return '';

    const hasImages = files.some((f) => f.type?.startsWith('image/'));
    const hasDocs = files.some((f) => !f.type?.startsWith('image/'));

    if (hasImages && hasDocs) {
      return `${files.length} Files`;
    }
    if (hasDocs) {
      return files.length > 1 ? `${files.length} Documents` : (files[0]?.name || 'Document');
    }
    return files.length > 1 ? `${files.length} Photos` : 'Photo';
  };

  return (
    <aside className="w-full md:w-80 lg:w-96 h-full flex flex-col bg-white/80 dark:bg-slate-900/40 border-r border-slate-200 dark:border-slate-800/80 backdrop-blur-xl shrink-0 transition-colors duration-200">
      {/* Top Header: Current User & Actions */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20 uppercase">
              {currentUser?.fullname?.slice(0, 2) || 'ME'}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-950" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
              {currentUser?.fullname || 'My Profile'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              @{currentUser?.username || 'user'}
            </p>
          </div>
        </div>

        {/* Action Buttons: Theme Toggle & Logout */}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            type="button"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-2 rounded-xl text-slate-500 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all cursor-pointer"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            onClick={onLogout}
            type="button"
            title="Log out"
            className="p-2 rounded-xl text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20 transition-all cursor-pointer"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-slate-200/80 dark:border-slate-800/50">
        <div className="relative flex items-center">
          <Search size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search contacts..."
            className="w-full h-10 pl-10 pr-4 text-xs font-medium text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
          />
        </div>
      </div>

      {/* Contacts List Header */}
      <div className="px-4 py-2.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <Users size={13} className="text-indigo-500 dark:text-indigo-400" />
          Contacts
        </span>
        <span className="text-slate-400 dark:text-slate-500">
          {onlineUsers.length} Online
        </span>
      </div>

      {/* Contacts Scrollable List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {users.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
            <MessageSquare size={24} className="opacity-40" />
            <p className="text-xs">No contacts available</p>
          </div>
        ) : (
          users.map((contact) => {
            const isSelected = selectedUser?._id === contact._id;
            const isOnline = onlineUsers.includes(contact._id);

            return (
              <div
                key={contact._id}
                onClick={() => onSelectUser(contact)}
                className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all cursor-pointer select-none text-left
                  ${isSelected
                    ? 'bg-indigo-50 dark:bg-indigo-600/15 border border-indigo-200 dark:border-indigo-500/30 text-indigo-950 dark:text-white shadow-sm dark:shadow-lg dark:shadow-indigo-950/40'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-transparent text-slate-700 dark:text-slate-300'
                  }
                `}
              >
                {/* Avatar with Online Status */}
                <div className="relative shrink-0">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-xs uppercase
                    ${isSelected
                      ? 'bg-gradient-to-tr from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/25'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700/60'
                    }
                  `}>
                    {contact.fullname?.slice(0, 2) || contact.username?.slice(0, 2) || 'US'}
                  </div>

                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 transition-colors ${isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-400 dark:bg-slate-600'
                      }`}
                    title={isOnline ? 'Online' : 'Offline'}
                  />
                </div>

                {/* Contact Info */}
                <div className="flex-1 min-w-0">
                  {/* Row 1: Contact Fullname & Last Message Timestamp */}
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className={`text-sm truncate ${contact.unreadCount > 0 && !isSelected ? 'font-bold text-slate-950 dark:text-white' : 'font-semibold text-slate-800 dark:text-slate-200'} ${isSelected ? 'text-indigo-950 dark:text-white' : ''}`}>
                      {contact.fullname}
                    </h3>
                    {contact.lastMessage?.createdAt && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 ml-1">
                        {formatLastMessageTime(contact.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>

                  {/* Row 2: Last Message Snippet (or @username) & Unread Badge */}
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <div className={`truncate max-w-[150px] sm:max-w-[180px] flex items-center gap-1 ${contact.unreadCount > 0 && !isSelected ? 'font-semibold text-slate-900 dark:text-slate-100' : ''}`}>
                      {draftsMap[contact._id] && (draftsMap[contact._id].text?.trim() || draftsMap[contact._id].files?.length > 0) ? (
                        <span className="inline-flex items-center gap-1 font-medium truncate">
                          <span className="text-green-500 dark:text-green-500 font-semibold shrink-0">Draft:</span>
                          <span className="text-slate-500 dark:text-slate-400 truncate font-normal">
                            {getDraftSnippet(draftsMap[contact._id])}
                          </span>
                        </span>
                      ) : contact.lastMessage ? (
                        <>
                          {contact.lastMessage.isDeletedForEveryone ? (
                            <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500 italic truncate">
                              <Ban size={12} className="shrink-0 opacity-70" />
                              <span className="truncate">This message was deleted</span>
                            </span>
                          ) : (
                            <>
                              {contact.lastMessage.senderId === currentUser?._id && (
                                <span className="text-slate-400 dark:text-slate-500 font-normal shrink-0">You: </span>
                              )}

                              {/* Media Type Badges */}
                              {contact.lastMessage.messageType === 'mixed' || (contact.lastMessage.attachments?.some(a => a.mimeType?.startsWith('image/')) && contact.lastMessage.attachments?.some(a => !a.mimeType?.startsWith('image/'))) ? (
                                <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 truncate">
                                  <FolderOpen size={13} className="shrink-0" />
                                  <span className="truncate">
                                    {contact.lastMessage.message || `${contact.lastMessage.attachments?.length || 0} Files`}
                                  </span>
                                </span>
                              ) : contact.lastMessage.messageType === 'image' || contact.lastMessage.attachments?.some(a => a.mimeType?.startsWith('image/')) ? (
                                <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 truncate">
                                  <ImageIcon size={13} className="shrink-0" />
                                  <span className="truncate">
                                    {contact.lastMessage.message || (
                                      (contact.lastMessage.attachments?.filter(a => a.mimeType?.startsWith('image/')).length || 1) > 1
                                        ? `${contact.lastMessage.attachments.filter(a => a.mimeType?.startsWith('image/')).length} Photos`
                                        : 'Photo'
                                    )}
                                  </span>
                                </span>
                              ) : contact.lastMessage.messageType === 'audio' || contact.lastMessage.attachments?.some(a => a.mimeType?.startsWith('audio/')) ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 truncate">
                                  <Mic size={13} className="shrink-0" />
                                  <span className="truncate">Voice note</span>
                                </span>
                              ) : contact.lastMessage.messageType === 'document' || contact.lastMessage.attachments?.some(a => !a.mimeType?.startsWith('image/') && !a.mimeType?.startsWith('audio/')) ? (
                                <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 truncate">
                                  <FileText size={13} className="shrink-0" />
                                  <span className="truncate">
                                    {contact.lastMessage.message || contact.lastMessage.attachments?.[0]?.fileName || 'Document'}
                                  </span>
                                </span>
                              ) : (
                                <span className="truncate">{contact.lastMessage.message}</span>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <span className="truncate">@{contact.username}</span>
                      )}
                    </div>

                    {/* Unread Message Count Badge */}
                    {contact.unreadCount > 0 && !isSelected && (
                      <span className="ml-1 px-1.5 py-0.5 min-w-[18px] text-[10px] font-bold text-center bg-indigo-600 text-white rounded-full shrink-0 shadow-sm shadow-indigo-600/40">
                        {contact.unreadCount}
                      </span>
                    )}
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
