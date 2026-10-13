'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import { ApiClient } from '../../../lib/api';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import {
  MessageSquare,
  Search,
  Plus,
  Send,
  User,
  Shield,
  Paperclip,
  Camera,
  Image as ImageIcon,
  Check,
  CheckCheck,
  MoreVertical,
  Edit2,
  Trash2,
  X,
  Eye,
  Download,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface ConversationItem {
  id: string;
  type: string;
  updatedAt: string;
  isMuted: boolean;
  unreadCount?: number;
  lastReadAt?: string;
  otherUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    lastReadAt?: string;
    memberProfile?: { memberNumber: string; photoUrl?: string };
    staffRole?: string;
  } | null;
  lastMessage?: {
    id: string;
    content: string;
    status: string;
    createdAt: string;
    senderId: string;
    senderName: string;
  } | null;
}

interface MessageAttachment {
  id?: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes?: number;
}

interface MessageItem {
  id: string;
  content: string;
  status: 'SENT' | 'DELIVERED' | 'READ' | 'DELETED';
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  senderUserId: string;
  sender: { id: string; firstName: string; lastName: string };
  attachments?: MessageAttachment[];
}

export default function MessagesPage() {
  const { user, activeOrg, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Attachment state for composer
  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File;
    previewUrl: string;
    uploadedUrl?: string;
  } | null>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);

  // Edit Message Modal / State
  const [editingMessage, setEditingMessage] = useState<MessageItem | null>(null);
  const [editContentText, setEditContentText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Confirmation Modal
  const [deletingMessage, setDeletingMessage] = useState<MessageItem | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  // Full-size Image Viewer Lightbox Modal
  const [lightboxImage, setLightboxImage] = useState<{ url: string; filename: string } | null>(null);

  // New Chat modal
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [candidateUsers, setCandidateUsers] = useState<any[]>([]);

  // Hidden file inputs
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (activeOrg) {
      loadConversations();
    }
  }, [activeOrg, isAuthenticated, authLoading]);

  useEffect(() => {
    if (activeConversationId && activeOrg) {
      loadMessages(activeConversationId);
      // Auto-poll messages every 3 seconds for reliable sync
      const timer = setInterval(() => {
        loadMessages(activeConversationId, true);
        loadConversations(true);
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [activeConversationId, activeOrg]);

  const loadConversations = async (silent = false) => {
    if (!activeOrg) return;
    if (!silent) setLoading(true);
    try {
      const res = await ApiClient.get<ConversationItem[]>('/messages/conversations', {
        tenantId: activeOrg.id,
      });
      const list = Array.isArray(res) ? res : [];
      setConversations(list);
      if (list.length > 0 && !activeConversationId) {
        setActiveConversationId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadMessages = async (convId: string, silent = false) => {
    if (!activeOrg) return;
    try {
      const res = await ApiClient.get<MessageItem[]>(
        `/messages/conversations/${convId}`,
        { tenantId: activeOrg.id },
      );
      setMessages(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load messages', err);
    }
  };

  // Image Selection Handler (Gallery or Camera)
  const handleSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (JPEG, PNG, WebP, GIF)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Photo size cannot exceed 10MB');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setPendingAttachment({ file, previewUrl });
    setShowAttachmentMenu(false);

    // Reset input value
    e.target.value = '';
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!newMessageText.trim() && !pendingAttachment) || !activeConversationId || !activeOrg) return;

    setSending(true);
    try {
      let attachmentsPayload: any[] | undefined = undefined;

      // If an image is attached, upload it securely first
      if (pendingAttachment) {
        setUploadingImage(true);
        const uploadRes = await ApiClient.uploadFile<{ url: string; originalName?: string; mimeType?: string; sizeBytes?: number }>(
          pendingAttachment.file,
          { tenantId: activeOrg.id },
        );

        if (uploadRes && uploadRes.url) {
          attachmentsPayload = [
            {
              url: uploadRes.url,
              filename: uploadRes.originalName || pendingAttachment.file.name,
              mimeType: uploadRes.mimeType || pendingAttachment.file.type,
              sizeBytes: uploadRes.sizeBytes || pendingAttachment.file.size,
            },
          ];
        }
      }

      await ApiClient.post(
        `/messages/conversations/${activeConversationId}`,
        {
          content: newMessageText.trim() || undefined,
          attachments: attachmentsPayload,
        },
        { tenantId: activeOrg.id },
      );

      setNewMessageText('');
      setPendingAttachment(null);
      loadMessages(activeConversationId);
      loadConversations(true);
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setSending(false);
      setUploadingImage(false);
    }
  };

  const handleOpenEdit = (msg: MessageItem) => {
    setEditingMessage(msg);
    setEditContentText(msg.content || '');
  };

  const handleSaveEdit = async () => {
    if (!editingMessage || !editContentText.trim() || !activeOrg) return;
    setSavingEdit(true);
    try {
      await ApiClient.patch(
        `/messages/${editingMessage.id}`,
        { content: editContentText.trim() },
        { tenantId: activeOrg.id },
      );
      setEditingMessage(null);
      if (activeConversationId) {
        loadMessages(activeConversationId);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to edit message');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingMessage || !activeOrg) return;
    setDeletingInProgress(true);
    try {
      await ApiClient.delete(
        `/messages/${deletingMessage.id}`,
        { tenantId: activeOrg.id },
      );
      setDeletingMessage(null);
      if (activeConversationId) {
        loadMessages(activeConversationId);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete message');
    } finally {
      setDeletingInProgress(false);
    }
  };

  const searchUsersForNewChat = async (q: string) => {
    setUserSearchQuery(q);
    if (!activeOrg) return;
    try {
      const res = await ApiClient.get<any[]>(`/messages/users/search?q=${encodeURIComponent(q)}`, {
        tenantId: activeOrg.id,
      });
      setCandidateUsers(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error(err);
    }
  };

  const startNewConversation = async (targetUserId: string) => {
    if (!activeOrg) return;
    try {
      const res: any = await ApiClient.post(
        '/messages/conversations',
        { recipientUserId: targetUserId },
        { tenantId: activeOrg.id },
      );
      setNewChatModalOpen(false);
      await loadConversations();
      if (res?.id) {
        setActiveConversationId(res.id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to start conversation');
    }
  };

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 h-[calc(100vh-5rem)] flex flex-col">
      {/* Hidden File Inputs for Gallery & Camera */}
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleSelectFile}
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleSelectFile}
      />

      {/* Top Banner */}
      <div className="flex items-center justify-between pb-4 border-b border-surface-200 dark:border-surface-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-50 dark:bg-amber-950/60 text-brand-700 dark:text-amber-300 border border-brand-200 dark:border-amber-800">
              {activeOrg?.name || '4Baye'}
            </span>
            <span className="text-xs text-surface-400">Telegram-Inspired Private Chat</span>
          </div>
          <h1 className="text-2xl font-extrabold text-surface-950 dark:text-white mt-1">
            Direct Messages
          </h1>
        </div>
        <Button
          size="sm"
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setNewChatModalOpen(true);
            searchUsersForNewChat('');
          }}
        >
          New Chat
        </Button>
      </div>

      {/* Main Telegram-style Two-Pane Layout */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 pt-4 overflow-hidden min-h-0">
        {/* Left Pane: Conversations List */}
        <div className="md:col-span-4 lg:col-span-4 flex flex-col border border-surface-200 dark:border-surface-800 rounded-2xl bg-white/80 dark:bg-surface-900/80 backdrop-blur-xs overflow-hidden">
          <div className="p-3 border-b border-surface-100 dark:border-surface-800">
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-surface-400" />}
            />
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-surface-100 dark:divide-surface-800/60">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-surface-400 space-y-2">
                <MessageSquare className="w-8 h-8 text-surface-300 mx-auto" />
                <p>No conversations yet</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setNewChatModalOpen(true);
                    searchUsersForNewChat('');
                  }}
                >
                  Start your first chat
                </Button>
              </div>
            ) : (
              conversations
                .filter((c) => {
                  if (!searchQuery.trim()) return true;
                  const name = `${c.otherUser?.firstName || ''} ${c.otherUser?.lastName || ''}`.toLowerCase();
                  return name.includes(searchQuery.toLowerCase());
                })
                .map((conv) => {
                  const isActive = conv.id === activeConversationId;
                  const name = conv.otherUser
                    ? `${conv.otherUser.firstName} ${conv.otherUser.lastName}`
                    : 'Community Member';
                  const unread = conv.unreadCount || 0;

                  return (
                    <button
                      key={conv.id}
                      onClick={() => setActiveConversationId(conv.id)}
                      className={`w-full p-3 text-left transition-colors flex items-center gap-3 ${
                        isActive
                          ? 'bg-brand-50/80 dark:bg-amber-950/40 border-l-4 border-brand-600 dark:border-amber-400'
                          : 'hover:bg-surface-50 dark:hover:bg-surface-800/40'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-amber-300 font-bold flex items-center justify-center shrink-0">
                        {name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-xs text-surface-900 dark:text-white truncate">
                            {name}
                          </h4>
                          {conv.lastMessage && (
                            <span className="text-[10px] text-surface-400 shrink-0">
                              {new Date(conv.lastMessage.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-[11px] text-surface-500 truncate pr-2">
                            {conv.lastMessage?.content || 'No text content'}
                          </p>
                          {unread > 0 && (
                            <span className="px-1.5 py-0.2 bg-brand-600 text-white dark:bg-amber-500 dark:text-stone-950 rounded-full text-[10px] font-bold shrink-0">
                              {unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
            )}
          </div>
        </div>

        {/* Right Pane: Active Chat Window */}
        <div className="md:col-span-8 lg:col-span-8 flex flex-col border border-surface-200 dark:border-surface-800 rounded-2xl bg-white/80 dark:bg-surface-900/80 backdrop-blur-xs overflow-hidden">
          {activeConv ? (
            <>
              {/* Chat Header */}
              <div className="p-3.5 px-4 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between bg-surface-50/50 dark:bg-surface-800/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-amber-300 font-bold flex items-center justify-center">
                    {activeConv.otherUser?.firstName?.[0] || 'U'}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-surface-950 dark:text-white">
                      {activeConv.otherUser
                        ? `${activeConv.otherUser.firstName} ${activeConv.otherUser.lastName}`
                        : 'Conversation'}
                    </h3>
                    <p className="text-[11px] text-surface-400">
                      {activeConv.otherUser?.staffRole ? (
                        <span className="text-brand-600 dark:text-amber-400 font-semibold">
                          {activeConv.otherUser.staffRole}
                        </span>
                      ) : activeConv.otherUser?.memberProfile?.memberNumber ? (
                        <span>ID: {activeConv.otherUser.memberProfile.memberNumber}</span>
                      ) : (
                        'Verified Member'
                      )}
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => loadMessages(activeConv.id)}
                  title="Refresh conversation"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-surface-400" />
                </Button>
              </div>

              {/* Message Bubbles Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 flex flex-col-reverse">
                <div ref={messagesEndRef} />
                {messages.length === 0 ? (
                  <div className="text-center text-xs text-surface-400 my-auto py-12">
                    <p>No messages yet in this conversation.</p>
                    <p className="text-[11px] mt-1">Say hello below!</p>
                  </div>
                ) : (
                  [...messages].reverse().map((msg) => {
                    const isMine = msg.senderUserId === user?.id;
                    const isDeleted = msg.deletedAt || msg.status === 'DELETED';

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col group relative ${isMine ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-xs shadow-2xs relative ${
                            isMine
                              ? 'bg-brand-600 text-white rounded-br-xs'
                              : 'bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-surface-100 rounded-bl-xs border border-surface-200 dark:border-surface-700/60'
                          } ${isDeleted ? 'opacity-70 italic' : ''}`}
                        >
                          {!isMine && (
                            <p className="text-[10px] font-bold opacity-80 mb-1">
                              {msg.sender.firstName}
                            </p>
                          )}

                          {/* Image Attachments */}
                          {msg.attachments && msg.attachments.length > 0 && !isDeleted && (
                            <div className="space-y-1.5 mb-2">
                              {msg.attachments.map((att, idx) => (
                                <div
                                  key={idx}
                                  className="rounded-xl overflow-hidden cursor-pointer relative group/img border border-black/10 dark:border-white/10"
                                  onClick={() => setLightboxImage({ url: att.url, filename: att.filename })}
                                >
                                  <img
                                    src={att.url}
                                    alt={att.filename}
                                    className="max-h-60 w-full object-cover transition-transform group-hover/img:scale-102"
                                  />
                                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                                    <Eye className="w-5 h-5 drop-shadow-sm" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Text Message Content */}
                          {msg.content && (
                            <p className="whitespace-pre-wrap leading-relaxed text-xs">
                              {msg.content}
                            </p>
                          )}

                          {/* Footer: Timestamp, Edited label, and Telegram Checkmarks */}
                          <div
                            className={`flex items-center gap-1 justify-end mt-1 text-[9px] ${
                              isMine ? 'text-brand-100 dark:text-amber-200' : 'text-surface-400'
                            }`}
                          >
                            {msg.editedAt && !isDeleted && (
                              <span className="italic mr-1">edited</span>
                            )}

                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>

                            {/* Telegram Read Receipt Indicators for Sender */}
                            {isMine && !isDeleted && (
                              <span title={msg.status === 'READ' ? 'Read by recipient' : 'Sent and delivered'}>
                                {msg.status === 'READ' ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-sky-300 dark:text-amber-300 inline" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 opacity-80 inline" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Hover Actions Menu (Edit & Delete for Sender) */}
                        {isMine && !isDeleted && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-0.5 px-1">
                            <button
                              onClick={() => handleOpenEdit(msg)}
                              className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 p-1"
                              title="Edit message"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setDeletingMessage(msg)}
                              className="text-rose-400 hover:text-rose-600 p-1"
                              title="Delete message"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pending Photo Attachment Preview Banner */}
              {pendingAttachment && (
                <div className="p-2.5 px-4 bg-surface-100 dark:bg-surface-800 border-t border-surface-200 dark:border-surface-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={pendingAttachment.previewUrl}
                      alt="Preview"
                      className="w-12 h-12 rounded-lg object-cover border border-surface-300 dark:border-surface-600"
                    />
                    <div>
                      <p className="text-xs font-semibold text-surface-900 dark:text-white truncate max-w-xs">
                        {pendingAttachment.file.name}
                      </p>
                      <p className="text-[10px] text-surface-400">
                        Ready to send with message
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPendingAttachment(null)}
                    className="p-1 rounded-full text-surface-400 hover:text-surface-600 hover:bg-surface-200 dark:hover:bg-surface-700"
                    title="Remove attachment"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Attachment Picker Menu Popup */}
              {showAttachmentMenu && (
                <div className="p-2 border-t border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 flex items-center gap-4 px-4 shadow-lg">
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs text-surface-700 dark:text-surface-300 hover:text-brand-600 dark:hover:text-amber-400 p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800"
                  >
                    <ImageIcon className="w-4 h-4 text-emerald-500" />
                    <span>Choose Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs text-surface-700 dark:text-surface-300 hover:text-brand-600 dark:hover:text-amber-400 p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800"
                  >
                    <Camera className="w-4 h-4 text-sky-500" />
                    <span>Take Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAttachmentMenu(false)}
                    className="ml-auto text-xs text-surface-400 hover:text-surface-600"
                  >
                    Close
                  </button>
                </div>
              )}

              {/* Input Composer Area */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 border-t border-surface-100 dark:border-surface-800 bg-surface-50/40 dark:bg-surface-800/20 flex items-center gap-2"
              >
                {/* (+) Attachment Button */}
                <button
                  type="button"
                  onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                  className={`p-2 rounded-xl border transition-colors ${
                    showAttachmentMenu || pendingAttachment
                      ? 'bg-brand-50 border-brand-300 text-brand-600 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-300'
                      : 'border-surface-200 dark:border-surface-700 text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800'
                  }`}
                  title="Attach Photo or Take Picture"
                >
                  <Plus className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  placeholder={pendingAttachment ? 'Add a caption...' : 'Write a message...'}
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  className="flex-1 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-4 py-2 text-xs text-surface-950 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                />

                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  isLoading={sending || uploadingImage}
                  rightIcon={<Send className="w-3.5 h-3.5" />}
                >
                  Send
                </Button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8 text-surface-400">
              <div className="space-y-2">
                <MessageSquare className="w-12 h-12 text-surface-300 mx-auto" />
                <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300">
                  Select a conversation
                </h3>
                <p className="text-xs">Choose a chat from the left or start a new one.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Message Modal */}
      {editingMessage && (
        <Modal
          isOpen={!!editingMessage}
          onClose={() => setEditingMessage(null)}
          title="Edit Message"
        >
          <div className="space-y-4">
            <textarea
              className="w-full px-3 py-2 border rounded-xl dark:bg-surface-900 border-surface-300 dark:border-surface-700 text-xs focus:ring-2 focus:ring-brand-500 outline-none"
              rows={4}
              value={editContentText}
              onChange={(e) => setEditContentText(e.target.value)}
              placeholder="Edit your message..."
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingMessage(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={savingEdit}
                disabled={savingEdit || !editContentText.trim()}
                onClick={handleSaveEdit}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deletingMessage && (
        <Modal
          isOpen={!!deletingMessage}
          onClose={() => setDeletingMessage(null)}
          title="Delete Message"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-surface-600 dark:text-surface-300 leading-relaxed">
              Are you sure you want to delete this message? It will be replaced with a tombstone label for all conversation participants.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingMessage(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={deletingInProgress}
                disabled={deletingInProgress}
                onClick={handleConfirmDelete}
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Lightbox Modal for Full-Size Image Viewing */}
      {lightboxImage && (
        <Modal
          isOpen={!!lightboxImage}
          onClose={() => setLightboxImage(null)}
          title={lightboxImage.filename || 'Image Attachment'}
          maxWidth="lg"
        >
          <div className="space-y-3">
            <div className="max-h-[70vh] overflow-hidden rounded-xl bg-black flex items-center justify-center">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.filename}
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
            <div className="flex justify-between items-center pt-2">
              <a
                href={lightboxImage.url}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-1.5 text-xs text-brand-600 dark:text-amber-400 font-semibold hover:underline"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Open in Full View / Download</span>
              </a>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLightboxImage(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* New Chat Modal */}
      {newChatModalOpen && (
        <Modal
          isOpen={newChatModalOpen}
          onClose={() => setNewChatModalOpen(false)}
          title="Start a New Conversation"
        >
          <div className="space-y-4">
            <Input
              placeholder="Search members by name or ID..."
              value={userSearchQuery}
              onChange={(e) => searchUsersForNewChat(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-surface-400" />}
            />

            <div className="max-h-64 overflow-y-auto divide-y divide-surface-100 dark:divide-surface-800">
              {candidateUsers.length === 0 ? (
                <p className="p-4 text-center text-xs text-surface-400">
                  No other members found
                </p>
              ) : (
                candidateUsers.map((candidate) => (
                  <button
                    key={candidate.userId}
                    type="button"
                    onClick={() => startNewConversation(candidate.userId)}
                    className="group w-full p-2.5 flex items-center justify-between text-left hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-amber-300 font-bold flex items-center justify-center text-xs">
                        {candidate.firstName[0]}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-surface-900 dark:text-white">
                          {candidate.firstName} {candidate.lastName}
                        </p>
                        <p className="text-[10px] text-surface-400">
                          {candidate.staffRole ? (
                            <span className="text-brand-600 dark:text-amber-400 font-bold">{candidate.staffRole}</span>
                          ) : (
                            candidate.memberNumber
                          )}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center justify-center font-medium rounded-lg text-xs px-3 py-1.5 select-none bg-surface-200 text-surface-900 group-hover:bg-surface-300 dark:bg-surface-800 dark:text-surface-100 dark:group-hover:bg-surface-700 border border-transparent dark:border-surface-700 transition-colors pointer-events-none">
                      Message
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
