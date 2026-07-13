"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { ConversationMessage, ConversationSummary } from "@sanany/types";
import { canSendConversationMessage, formatRelativeTime } from "@sanany/shared";
import { Card } from "@sanany/ui";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { RequireAuth } from "../auth/guards";
import { getWebMessagingRepository } from "../lib/messaging-repository";
import { getWebSupabaseClient } from "../lib/supabase-client";
import { AppNavigation } from "./app-navigation";
import { LanguageSwitcher } from "./language-switcher";

type ChatShellProps = {
  language: string;
};

export function ChatShell({ language }: ChatShellProps) {
  const { t, i18n } = useTranslation();
  const { snapshot } = useAuth();
  const searchParams = useSearchParams();
  const repository = useMemo(() => getWebMessagingRepository(), []);
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const locale = (i18n.language || "ar").startsWith("ar") ? "ar" : "en";

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [composer, setComposer] = useState("");
  const [imageUrlDraft, setImageUrlDraft] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isMutatingThread, setIsMutatingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const userId = snapshot.user?.id ?? null;
  const selectedConversation = conversations.find((item) => item.id === selectedConversationId) ?? null;

  const loadConversations = useCallback(async (preferConversationId?: string | null) => {
    if (!userId) {
      return;
    }
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
    if (!userId) {
      return;
    }
    void loadConversations();
  }, [loadConversations, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    const listingId = searchParams.get("listingId");
    const sellerId = searchParams.get("sellerId");
    if (!listingId || !sellerId || sellerId === userId) {
      return;
    }
    void repository
      .ensureConversation({ listingId, buyerId: userId, sellerId })
      .then((conversation) => {
        void loadConversations(conversation.id);
      })
      .catch(() => {
        setError(t("chat.ensureConversationFailed"));
      });
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
      .then((result) => {
        setMessages(result.items);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : t("chat.loadMessagesError"));
      })
      .finally(() => {
        setIsLoadingMessages(false);
      });
    void repository.markConversationRead({ conversationId: selectedConversationId, userId }).then(() => loadConversations(selectedConversationId));
  }, [loadConversations, repository, selectedConversationId, t, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }
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
    return () => {
      void client.removeChannel(channel);
    };
  }, [loadConversations, repository, selectedConversationId, userId]);

  const onSend = async () => {
    if (!userId || !selectedConversation || isSending || selectedConversation.isBlocked || selectedConversation.isBlockedByOther) {
      return;
    }
    const text = composer.trim();
    const imageUrl = imageUrlDraft.trim();
    if (!canSendConversationMessage({ body: text, imageUrl })) {
      return;
    }
    setIsSending(true);
    setError(null);
    try {
      await repository.sendMessage({
        conversationId: selectedConversation.id,
        senderId: userId,
        body: text || undefined,
        imageUrl: imageUrl || undefined
      });
      setComposer("");
      setImageUrlDraft("");
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
    if (!userId || !selectedConversation || isMutatingThread || selectedConversation.isBlockedByOther) {
      return;
    }
    setIsMutatingThread(true);
    setError(null);
    try {
      await repository.setConversationBlocked({
        conversationId: selectedConversation.id,
        userId,
        blocked: !selectedConversation.isBlocked
      });
      setActionMessage(!selectedConversation.isBlocked ? t("chat.blockedSuccess") : t("chat.unblockedSuccess"));
      await loadConversations(selectedConversation.id);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : t("chat.blockFailed"));
    } finally {
      setIsMutatingThread(false);
    }
  };

  const onReport = async () => {
    if (!userId || !selectedConversation || isMutatingThread) {
      return;
    }
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

  return (
    <RequireAuth language={resolvedLanguage}>
      <main dir={resolvedLanguage === "ar" ? "rtl" : "ltr"} className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <Image src="/brand/sanany-logo.png" alt={t("app.title")} width={500} height={220} className="h-9 w-auto" priority />
            <h1 className="text-2xl font-bold text-slate-900">{t("chat.pageTitle")}</h1>
            <p className="text-sm text-slate-600">{t("chat.pageSubtitle")}</p>
          </div>
          <LanguageSwitcher />
        </header>

        <AppNavigation language={resolvedLanguage} />

        {isLoadingConversations ? <p className="text-sm text-slate-600">{t("common.loading")}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {actionMessage ? <p className="text-sm text-slate-600">{actionMessage}</p> : null}

        {!isLoadingConversations && conversations.length === 0 ? (
          <Card className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">{t("chat.emptyTitle")}</h2>
            <p className="text-sm text-slate-600">{t("chat.emptyHint")}</p>
          </Card>
        ) : null}

        {conversations.length > 0 ? (
          <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)_300px]">
            <Card className="h-fit space-y-2">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedConversationId(conversation.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-start transition ${
                    selectedConversationId === conversation.id
                      ? "border-brand bg-brand/5"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{conversation.otherUserName}</p>
                    {conversation.unreadCount > 0 ? (
                      <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">{conversation.unreadCount}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">{conversation.listing.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">{conversation.lastMessagePreview ?? t("chat.noMessagesYet")}</p>
                </button>
              ))}
            </Card>

            <Card className="flex min-h-[420px] flex-col gap-3">
              {selectedConversation ? (
                <>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{selectedConversation.otherUserName}</p>
                      <p className="text-xs text-slate-500">{selectedConversation.listing.title}</p>
                    </div>
                    <p className="text-xs text-slate-500">{formatRelativeTime(selectedConversation.lastMessageAt, locale)}</p>
                  </div>

                  <div className="max-h-[420px] flex-1 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-2">
                    {isLoadingMessages ? <p className="text-sm text-slate-500">{t("common.loading")}</p> : null}
                    {messages.map((message) => {
                      const mine = message.senderId === userId;
                      return (
                        <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[82%] rounded-2xl px-3 py-2 ${mine ? "bg-brand text-white" : "bg-white text-slate-800"}`}>
                            {message.body ? <p className="whitespace-pre-wrap text-sm">{message.body}</p> : null}
                            {message.imageUrl ? (
                              <a href={message.imageUrl} target="_blank" rel="noreferrer" className="mt-1 block text-xs underline">
                                {t("chat.openImage")}
                              </a>
                            ) : null}
                            <div className={`mt-1 flex items-center gap-1 text-[10px] ${mine ? "text-white/80" : "text-slate-500"}`}>
                              <span>{formatRelativeTime(message.createdAt, locale)}</span>
                              {mine ? <span>{message.readAt ? "✓✓" : "✓"}</span> : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      value={imageUrlDraft}
                      onChange={(event) => setImageUrlDraft(event.currentTarget.value)}
                      placeholder={t("chat.imageUrlPlaceholder")}
                      disabled={selectedConversation.isBlocked || selectedConversation.isBlockedByOther}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={composer}
                        onChange={(event) => setComposer(event.currentTarget.value)}
                        placeholder={t("chat.detail.inputPlaceholder")}
                        disabled={selectedConversation.isBlocked || selectedConversation.isBlockedByOther}
                        className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand"
                      />
                      <button
                        type="button"
                        onClick={() => void onSend()}
                        disabled={isSending || selectedConversation.isBlocked || selectedConversation.isBlockedByOther}
                        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {t("chat.send")}
                      </button>
                    </div>
                    {selectedConversation.isBlocked ? <p className="text-xs text-amber-700">{t("chat.blockedByYou")}</p> : null}
                    {selectedConversation.isBlockedByOther ? <p className="text-xs text-rose-700">{t("chat.blockedByOther")}</p> : null}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-600">{t("chat.noThreadSelected")}</p>
              )}
            </Card>

            <Card className="h-fit space-y-3">
              {selectedConversation ? (
                <>
                  <p className="text-sm font-semibold text-slate-900">{t("chat.detailsPanel.title")}</p>
                  <Link href={`/${resolvedLanguage}/listing/${selectedConversation.listing.id}`} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    {t("chat.openListing")}
                  </Link>
                  <Link href={`/${resolvedLanguage}/seller/${selectedConversation.otherUserId}`} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    {t("chat.openSeller")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void onToggleBlock()}
                    disabled={isMutatingThread || selectedConversation.isBlockedByOther}
                    className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 disabled:opacity-60"
                  >
                    {selectedConversation.isBlocked ? t("chat.unblockAction") : t("chat.blockAction")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onReport()}
                    disabled={isMutatingThread || selectedConversation.isReported}
                    className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 disabled:opacity-60"
                  >
                    {selectedConversation.isReported ? t("chat.reportedAction") : t("chat.reportAction")}
                  </button>
                </>
              ) : (
                <p className="text-sm text-slate-600">{t("chat.noThreadSelected")}</p>
              )}
            </Card>
          </section>
        ) : null}
      </main>
    </RequireAuth>
  );
}
