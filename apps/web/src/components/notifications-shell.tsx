"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { NotificationItem } from "@sanany/types";
import { formatRelativeTime } from "@sanany/shared";
import { Card } from "@sanany/ui";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { RequireAuth } from "../auth/guards";
import { getWebMessagingRepository } from "../lib/messaging-repository";
import { getNotificationContent, resolveNotificationHref } from "../lib/notification-ui";
import { getWebSupabaseClient } from "../lib/supabase-client";
import { AppNavigation } from "./app-navigation";
import { LanguageSwitcher } from "./language-switcher";

type NotificationsShellProps = {
  language: string;
};

export function NotificationsShell({ language }: NotificationsShellProps) {
  const { t, i18n } = useTranslation();
  const { snapshot } = useAuth();
  const repository = useMemo(() => getWebMessagingRepository(), []);
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const locale = (i18n.language || "ar").startsWith("ar") ? "ar" : "en";

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = snapshot.user?.id ?? null;

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await repository.listNotifications({ userId, page: 1, pageSize: 80 });
      setItems(result.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t("notifications.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [repository, t, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    void loadNotifications();
  }, [loadNotifications, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    const client = getWebSupabaseClient();
    const channel = client.channel(`notifications-${userId}`);
    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_messages" }, () => {
        void loadNotifications();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "follows" }, () => {
        void loadNotifications();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ratings" }, () => {
        void loadNotifications();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "listing_status_events" }, () => {
        void loadNotifications();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_notification_deliveries" }, () => {
        void loadNotifications();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "admin_notification_deliveries" }, () => {
        void loadNotifications();
      })
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [loadNotifications, userId]);

  const markAllRead = async () => {
    if (!userId) {
      return;
    }
    const unread = items.filter((item) => !item.isRead);
    if (unread.length === 0) {
      return;
    }
    await repository.markNotificationsRead({
      userId,
      items: unread.map((item) => ({ kind: item.kind, referenceId: item.referenceId }))
    });
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
  };

  return (
    <RequireAuth language={resolvedLanguage}>
      <main dir={resolvedLanguage === "ar" ? "rtl" : "ltr"} className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <Image src="/brand/sanany-logo.png" alt={t("app.title")} width={500} height={220} className="h-9 w-auto" priority />
            <h1 className="text-2xl font-bold text-slate-900">{t("notifications.pageTitle")}</h1>
            <p className="text-sm text-slate-600">{t("notifications.pageSubtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              {t("notifications.markAllRead")}
            </button>
          </div>
        </header>

        <AppNavigation language={resolvedLanguage} />

        {isLoading ? <p className="text-sm text-slate-600">{t("common.loading")}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {!isLoading && items.length === 0 ? (
          <Card className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">{t("notifications.emptyTitle")}</h2>
            <p className="text-sm text-slate-600">{t("notifications.emptyHint")}</p>
          </Card>
        ) : null}

        <section className="space-y-2">
          {items.map((item) => (
            (() => {
              const content = getNotificationContent(item, t);
              return (
                <Link
                  key={item.id}
                  href={resolveNotificationHref(resolvedLanguage, item)}
                  className={`block rounded-xl border px-4 py-3 transition ${
                    item.isRead ? "border-slate-200 bg-white" : "border-brand/30 bg-brand/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{t(`notifications.kind.${item.kind}`)}</p>
                        {!item.isRead ? <span className="h-2 w-2 rounded-full bg-brand" /> : null}
                      </div>
                      <p className="text-sm text-slate-700">{content.title}</p>
                      {content.body ? <p className="text-xs text-slate-600">{content.body}</p> : null}
                    </div>
                    <p className="text-xs text-slate-500">{formatRelativeTime(item.createdAt, locale)}</p>
                  </div>
                </Link>
              );
            })()
          ))}
        </section>
      </main>
    </RequireAuth>
  );
}
