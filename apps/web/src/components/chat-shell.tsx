"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { ConversationMessage, ConversationSummary } from "@sanany/types";
import { canSendConversationMessage, formatRelativeTime } from "@sanany/shared";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { RequireAuth } from "../auth/guards";
import { getWebMessagingRepository } from "../lib/messaging-repository";
import { getWebSupabaseClient } from "../lib/supabase-client";

type ChatFilter = "all" | "buyer" | "seller";

type ChatShellProps = {
  language: string;
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ChatShell({ language }: ChatShellProps) {
  const { t, i18n } = useTranslation();
  const { snapshot } = useAuth();
  const searchParams = useSearchParams();
  const repository = useMemo(() => getWebMessagingRepository(), []);
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const locale = (i18n.language || "ar").startsWith("ar") ? "ar" : "en";
  const isRtl = resolvedLanguage === "ar";
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [composer, setComposer] = useState("");
  const [activeFilter, setActiveFilter] = useState<ChatFilter>("all");
  const [showMobileList, setShowMobileList] = useState(true);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isMutatingThread, setIsMutatingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const userId = snapshot.user?.id ?? null;
  const selectedConversation = conversations.find((item) => item.id === selectedConversationId) ?? null;

  const filteredConversations = useMemo(() => {
    if (activeFilter === "all") return conversations;
    return conversations.filter((c) => {
      const isSeller = c.listing.ownerId === userId;
      return activeFilter === "seller" ? isSeller : !isSeller;
    });
  }, [conversations, activeFilter, userId]);

  const loadConversations = useCallback(async (preferConversationId?: string | null) => {
    if (!userId) return;
    setIsLoadingConversations(true);
    setError(null);
    try {
      const result = await repository.listConversations({ userId, page: 1, pageSize: 30 });
      setConversations(result.items);
      setSelectedConversationId((current) => {
        if (preferConversationId && result.items.some((item) => item.id === preferConversationId)) {
          return preferConversationId;
        }
        if (current && result.items.some((item) => item.id === current)) {
          return current;
        }
        return result.items[0]?.id ?? null;
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t("chat.loadError"));
    } finally {
      setIsLoadingConversations(false);
    }
  }, [repository, t, userId]);

  useEffect(() => {
    if (!userId) return;
    void loadConversations();
  }, [loadConversations, userId]);

  useEffect(() => {
    if (!userId) return;
    const listingId = searchParams.get("listingId");
    const sellerId = searchParams.get("sellerId");
    if (!listingId || !sellerId || sellerId === userId) return;
    void repository
      .ensureConversation({ listingId, buyerId: userId, sellerId })
      .then((conversation) => { void loadConversations(conversation.id); })
      .catch(() => { setError(t("chat.ensureConversationFailed")); });
  }, [loadConversations, repository, searchParams, userId, t]);

  useEffect(() => {
    if (!userId || !selectedConversationId) {
      setMessages([]);
      return;
    }
    setIsLoadingMessages(true);
    setError(null);
    void repository
      .listMessages({ conversationId: selectedConversationId, userId, page: 1, pageSize: 200 })
      .then((result) => { setMessages(result.items); })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : t("chat.loadMessagesError"));
      })
      .finally(() => { setIsLoadingMessages(false); });
    void repository.markConversationRead({ conversationId: selectedConversationId, userId })
      .then(() => loadConversations(selectedConversationId));
  }, [loadConversations, repository, selectedConversationId, t, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!userId) return;
    const client = getWebSupabaseClient();
    const channel = client.channel(`chat-${userId}`);
    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_messages" }, () => {
        void loadConversations(selectedConversationId);
        if (selectedConversationId) {
          void repository
            .listMessages({ conversationId: selectedConversationId, userId, page: 1, pageSize: 200 })
            .then((result) => setMessages(result.items));
          void repository.markConversationRead({ conversationId: selectedConversationId, userId });
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, () => {
        void loadConversations(selectedConversationId);
      })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [loadConversations, repository, selectedConversationId, userId]);

  const onSend = async () => {
    if (!userId || !selectedConversation || isSending || selectedConversation.isBlocked || selectedConversation.isBlockedByOther) return;
    const text = composer.trim();
    if (!canSendConversationMessage({ body: text, imageUrl: undefined })) return;
    setIsSending(true);
    setError(null);
    try {
      await repository.sendMessage({ conversationId: selectedConversation.id, senderId: userId, body: text || undefined });
      setComposer("");
      const result = await repository.listMessages({ conversationId: selectedConversation.id, userId, page: 1, pageSize: 200 });
      setMessages(result.items);
      await repository.markConversationRead({ conversationId: selectedConversation.id, userId });
      await loadConversations(selectedConversation.id);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : t("chat.sendFailed"));
    } finally {
      setIsSending(false);
    }
  };

  const onToggleBlock = async () => {
    if (!userId || !selectedConversation || isMutatingThread || selectedConversation.isBlockedByOther) return;
    setIsMutatingThread(true);
    setError(null);
    try {
      await repository.setConversationBlocked({ conversationId: selectedConversation.id, userId, blocked: !selectedConversation.isBlocked });
      setActionMessage(!selectedConversation.isBlocked ? t("chat.blockedSuccess") : t("chat.unblockedSuccess"));
      await loadConversations(selectedConversation.id);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : t("chat.blockFailed"));
    } finally {
      setIsMutatingThread(false);
    }
  };

  const onReport = async () => {
    if (!userId || !selectedConversation || isMutatingThread) return;
    setIsMutatingThread(true);
    setError(null);
    try {
      await repository.reportConversation({ conversationId: selectedConversation.id, userId });
      setActionMessage(t("chat.reportedSuccess"));
      await loadConversations(selectedConversation.id);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : t("chat.reportFailed"));
    } finally {
      setIsMutatingThread(false);
    }
  };

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    setShowMobileList(false);
    setActionMessage(null);
  };

  const filterLabels: Record<ChatFilter, string> = {
    all: t("chat.filters.all"),
    buyer: t("chat.filters.buyer"),
    seller: t("chat.filters.seller")
  };

  return (
    <RequireAuth language={resolvedLanguage}>
      <div
        dir={isRtl ? "rtl" : "ltr"}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        style={{ height: "calc(100vh - 160px)", minHeight: 520 }}
      >
        <div className="flex h-full">
          {/* ── Conversation list sidebar ── */}
          <aside className={`flex w-full flex-col border-e border-slate-200 bg-white sm:w-80 sm:flex-none ${showMobileList ? "flex" : "hidden sm:flex"}`}>
            {/* Sidebar header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-base font-black text-slate-950">{t("chat.pageTitle")}</h2>
              {error ? (
                <span className="h-2 w-2 rounded-full bg-rose-500" title={error} />
              ) : null}
            </div>

            {/* Filter tabs */}
            <div className="flex border-b border-slate-100 bg-slate-50">
              {(["all", "buyer", "seller"] as ChatFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`flex-1 py-2.5 text-sm font-semibold transition ${
                    activeFilter === filter
                      ? "border-b-2 border-brand text-brand"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {filterLabels[filter]}
                </button>
              ))}
            </div>

            {/* Thread list */}
            <div className="flex-1 overflow-y-auto">
              {isLoadingConversations ? (
                <div className="space-y-3 p-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
                      <div className="h-10 w-10 flex-none animate-pulse rounded-full bg-slate-200" />
                      <div className="flex-1 space-y-2 pt-1">
                        <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
                        <div className="h-2.5 w-full animate-pulse rounded bg-slate-100" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl">💬</div>
                  <p className="text-sm font-semibold text-slate-700">{t("chat.emptyTitle")}</p>
                  <p className="text-xs text-slate-500">{t("chat.emptyHint")}</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredConversations.map((conversation) => {
                    const isActive = selectedConversationId === conversation.id;
                    const initials = getInitials(conversation.otherUserName);
                    return (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => handleSelectConversation(conversation.id)}
                        className={`group w-full px-3 py-3 text-start transition-colors ${
                          isActive ? "bg-brand/8" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className={`flex items-start gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                          {/* Avatar */}
                          {conversation.otherUserAvatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={conversation.otherUserAvatarUrl}
                              alt={conversation.otherUserName}
                              className="h-10 w-10 flex-none rounded-full object-cover"
                            />
                          ) : (
                            <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-full text-sm font-bold text-white ${isActive ? "bg-brand" : "bg-slate-400"}`}>
                              {initials}
                            </div>
                          )}

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <div className={`flex items-center justify-between gap-1 ${isRtl ? "flex-row-reverse" : ""}`}>
                              <p className="truncate text-sm font-bold text-slate-950">{conversation.otherUserName}</p>
                              <span className="flex-none text-[11px] text-slate-400">
                                {formatRelativeTime(conversation.lastMessageAt, locale)}
                              </span>
                            </div>
                            <p className={`mt-0.5 truncate text-xs font-semibold text-brand ${isRtl ? "text-right" : "text-left"}`}>
                              {conversation.listing.title}
                            </p>
                            <div className={`mt-0.5 flex items-center justify-between gap-1 ${isRtl ? "flex-row-reverse" : ""}`}>
                              <p className="flex-1 truncate text-xs text-slate-500">
                                {conversation.lastMessagePreview ?? t("chat.noMessagesYet")}
                              </p>
                              {conversation.unreadCount > 0 ? (
                                <span className="flex-none rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                  {conversation.unreadCount}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          {/* ── Chat main area ── */}
          <main className={`flex min-w-0 flex-1 flex-col ${!showMobileList ? "flex" : "hidden sm:flex"}`}>
            {selectedConversation ? (
              <>
                {/* Chat header */}
                <div className={`flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                  {/* Back button (mobile only) */}
                  <button
                    type="button"
                    onClick={() => setShowMobileList(true)}
                    className="flex-none text-slate-500 hover:text-slate-800 sm:hidden"
                    aria-label={t("common.back")}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {/* Avatar */}
                  {selectedConversation.otherUserAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedConversation.otherUserAvatarUrl}
                      alt={selectedConversation.otherUserName}
                      className="h-9 w-9 flex-none rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                      {getInitials(selectedConversation.otherUserName)}
                    </div>
                  )}

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-950">{selectedConversation.otherUserName}</p>
                    <p className="truncate text-xs text-brand">{selectedConversation.listing.title}</p>
                  </div>

                  {/* Listing thumbnail */}
                  {selectedConversation.listing.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedConversation.listing.imageUrl}
                      alt={selectedConversation.listing.title}
                      className="hidden h-10 w-16 flex-none rounded-lg object-cover sm:block"
                    />
                  ) : null}

                  {/* Action buttons */}
                  <div className={`flex flex-none items-center gap-1 ${isRtl ? "flex-row-reverse" : ""}`}>
                    <Link
                      href={`/${resolvedLanguage}/listing/${selectedConversation.listing.id}`}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-brand"
                      title={t("chat.openListing")}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </Link>
                    <button
                      type="button"
                      onClick={() => void onToggleBlock()}
                      disabled={isMutatingThread || selectedConversation.isBlockedByOther}
                      title={selectedConversation.isBlocked ? t("chat.unblockAction") : t("chat.blockAction")}
                      className={`rounded-lg border p-1.5 transition disabled:opacity-40 ${
                        selectedConversation.isBlocked
                          ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-amber-700"
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => void onReport()}
                      disabled={isMutatingThread || selectedConversation.isReported}
                      title={selectedConversation.isReported ? t("chat.reportedAction") : t("chat.reportAction")}
                      className={`rounded-lg border p-1.5 transition disabled:opacity-40 ${
                        selectedConversation.isReported
                          ? "border-rose-300 bg-rose-50 text-rose-700"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-rose-700"
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Feedback banners */}
                {actionMessage ? (
                  <div className="border-b border-slate-100 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700">
                    {actionMessage}
                  </div>
                ) : null}
                {error ? (
                  <div className="border-b border-slate-100 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700">
                    {error}
                  </div>
                ) : null}

                {/* Messages area */}
                <div className="flex-1 overflow-y-auto bg-slate-50/60 px-4 py-4">
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                      <div className="text-3xl">👋</div>
                      <p className="text-sm text-slate-500">{t("chat.noMessagesYet")}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {messages.map((message) => {
                        const mine = message.senderId === userId;
                        return (
                          <div key={message.id} className={`flex ${mine ? (isRtl ? "justify-start" : "justify-end") : (isRtl ? "justify-end" : "justify-start")}`}>
                            <div className={`max-w-[72%] rounded-2xl px-3.5 py-2.5 shadow-sm ${mine ? "bg-brand text-white" : "bg-white text-slate-800"}`}>
                              {message.body ? (
                                <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
                              ) : null}
                              {message.imageUrl ? (
                                <a href={message.imageUrl} target="_blank" rel="noreferrer" className={`mt-1 block text-xs underline ${mine ? "text-white/80" : "text-brand"}`}>
                                  {t("chat.openImage")}
                                </a>
                              ) : null}
                              <div className={`mt-1 flex items-center gap-1 text-[10px] ${mine ? "text-white/70" : "text-slate-400"} ${mine ? (isRtl ? "flex-row-reverse justify-start" : "justify-end") : (isRtl ? "justify-start" : "justify-start")}`}>
                                <span>{formatRelativeTime(message.createdAt, locale)}</span>
                                {mine ? <span className="font-semibold">{message.readAt ? "✓✓" : "✓"}</span> : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                {/* Blocked notices */}
                {selectedConversation.isBlocked ? (
                  <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-700">
                    {t("chat.blockedByYou")}
                  </div>
                ) : selectedConversation.isBlockedByOther ? (
                  <div className="border-t border-rose-200 bg-rose-50 px-4 py-2 text-center text-xs font-medium text-rose-700">
                    {t("chat.blockedByOther")}
                  </div>
                ) : null}

                {/* Composer */}
                <div className={`flex items-center gap-2 border-t border-slate-200 bg-white px-4 py-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                  <input
                    type="text"
                    value={composer}
                    onChange={(event) => setComposer(event.currentTarget.value)}
                    onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void onSend(); } }}
                    placeholder={t("chat.detail.inputPlaceholder")}
                    disabled={selectedConversation.isBlocked || selectedConversation.isBlockedByOther}
                    className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => void onSend()}
                    disabled={isSending || !composer.trim() || selectedConversation.isBlocked || selectedConversation.isBlockedByOther}
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand text-white shadow transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-slate-300"
                    aria-label={t("chat.send")}
                  >
                    {isSending ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                      </svg>
                    )}
                  </button>
                </div>
              </>
            ) : (
              /* Empty state — no conversation selected */
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl">💬</div>
                <p className="text-sm font-semibold text-slate-700">{t("chat.noThreadSelected")}</p>
                <p className="text-xs text-slate-400">{t("chat.emptyHint")}</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </RequireAuth>
  );
}
