"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MarketplaceListing } from "@sanany/types";
import { Card } from "@sanany/ui";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { RequireAuth } from "../auth/guards";
import { getWebListingsRepository } from "../lib/listings-repository";
import { AppNavigation } from "./app-navigation";
import { LanguageSwitcher } from "./language-switcher";

type ChatShellProps = {
  language: string;
};

type ChatMessage = {
  id: string;
  text: string;
  sender: "me" | "them";
  timestamp: string;
};

type ChatThread = {
  id: string;
  listing: MarketplaceListing;
  preview: string;
  updatedAt: string;
  unreadCount: number;
};

const QUICK_REPLY_KEYS = ["chat.detail.quickReplies.duration", "chat.detail.quickReplies.finalPrice", "chat.detail.quickReplies.latest"] as const;

function createThreadSeed(listing: MarketplaceListing): ChatMessage[] {
  return [
    {
      id: `${listing.id}-initial`,
      text: listing.title,
      sender: "them",
      timestamp: listing.createdAt
    },
    {
      id: `${listing.id}-latest`,
      text: listing.description ?? "",
      sender: "them",
      timestamp: listing.createdAt
    }
  ];
}

export function ChatShell({ language }: ChatShellProps) {
  const { t } = useTranslation();
  const { snapshot } = useAuth();
  const repository = useMemo(() => getWebListingsRepository(), []);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [messagesByThread, setMessagesByThread] = useState<Record<string, ChatMessage[]>>({});
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    const loadThreads = async () => {
      try {
        const response = await repository.list({
          search: "",
          status: "all",
          page: 1,
          pageSize: 20,
          sort: "newest"
        });

        const mapped = response.items.map<ChatThread>((listing, index) => ({
          id: listing.id,
          listing,
          preview: listing.description ?? "",
          updatedAt: listing.createdAt,
          unreadCount: index === 0 ? 1 : 0
        }));

        if (!active) {
          return;
        }

        setThreads(mapped);
        setMessagesByThread(
          mapped.reduce<Record<string, ChatMessage[]>>((acc, thread) => {
            acc[thread.id] = createThreadSeed(thread.listing);
            return acc;
          }, {})
        );
        setSelectedThreadId((current) => current ?? mapped[0]?.id ?? null);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadThreads();
    return () => {
      active = false;
    };
  }, [repository]);

  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) ?? null;
  const selectedMessages = selectedThread ? messagesByThread[selectedThread.id] ?? [] : [];

  const handleSend = () => {
    if (!selectedThread || !draft.trim()) {
      return;
    }

    const nextMessage: ChatMessage = {
      id: `${selectedThread.id}-${Date.now()}`,
      text: draft.trim(),
      sender: "me",
      timestamp: new Date().toISOString()
    };

    setMessagesByThread((current) => ({
      ...current,
      [selectedThread.id]: [...(current[selectedThread.id] ?? []), nextMessage]
    }));
    setThreads((current) =>
      current.map((thread) =>
        thread.id === selectedThread.id
          ? {
              ...thread,
              preview: nextMessage.text,
              updatedAt: nextMessage.timestamp,
              unreadCount: 0
            }
          : thread
      )
    );
    setDraft("");
  };

  const quickReplies = QUICK_REPLY_KEYS.map((key) => t(key));

  return (
    <RequireAuth language={resolvedLanguage}>
      <main dir={resolvedLanguage === "ar" ? "rtl" : "ltr"} className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <Image src="/brand/sanany-logo.png" alt={t("app.title")} width={500} height={220} className="h-9 w-auto" priority />
            <h1 className="text-2xl font-bold text-slate-900">{t("chat.pageTitle")}</h1>
            <p className="text-sm text-slate-600">{t("chat.pageSubtitle")}</p>
          </div>
          <LanguageSwitcher />
        </header>

        <AppNavigation language={resolvedLanguage} />

        {isLoading ? <p className="text-sm text-slate-600">{t("common.loading")}</p> : null}

        {!isLoading && threads.length === 0 ? (
          <Card className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">{t("chat.emptyTitle")}</h2>
            <p className="text-sm text-slate-600">{t("chat.emptyHint")}</p>
          </Card>
        ) : null}

        {threads.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-[340px,1fr]">
            <Card className="space-y-2">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-start transition ${
                    selectedThreadId === thread.id
                      ? "border-sky-200 bg-sky-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-slate-900">{thread.listing.title}</p>
                    {thread.unreadCount > 0 ? (
                      <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">{thread.unreadCount}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">{thread.preview}</p>
                </button>
              ))}
            </Card>

            <Card className="space-y-3">
              {selectedThread ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{selectedThread.listing.title}</p>
                      <p className="text-xs text-slate-500">{t("chat.headerSubtitle")}</p>
                    </div>
                    <Link
                      href={`/${resolvedLanguage}/listing/${selectedThread.listing.id}`}
                      className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300"
                    >
                      {t("chat.openListing")}
                    </Link>
                  </div>

                  <div className="max-h-[380px] space-y-2 overflow-y-auto">
                    {selectedMessages.map((message) => (
                      <div key={message.id} className={`flex ${message.sender === "me" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                            message.sender === "me" ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {message.text}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {quickReplies.map((reply) => (
                      <button
                        key={reply}
                        type="button"
                        onClick={() => setDraft(reply)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 transition hover:border-slate-300"
                      >
                        {reply}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={draft}
                      onChange={(event) => setDraft(event.currentTarget.value)}
                      placeholder={t("chat.detail.inputPlaceholder")}
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400"
                    />
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!draft.trim()}
                      className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {t("chat.send")}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-600">{t("chat.noThreadSelected")}</p>
              )}
            </Card>
          </div>
        ) : null}

        <footer className="text-center text-xs text-slate-500">{snapshot.user?.email}</footer>
      </main>
    </RequireAuth>
  );
}
