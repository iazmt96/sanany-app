"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { NotificationItem } from "@sanany/types";
import { countUnreadNotifications, formatRelativeTime } from "@sanany/shared";
import { useAuth } from "../../auth/auth-context";
import { getWebMessagingRepository } from "../../lib/messaging-repository";
import { getNotificationContent, resolveNotificationHref } from "../../lib/notification-ui";
import { getWebSupabaseClient } from "../../lib/supabase-client";

type NotificationsDropdownProps = {
  language: string;
};

export function NotificationsDropdown({ language }: NotificationsDropdownProps) {
  const { t, i18n } = useTranslation();
  const { snapshot } = useAuth();
  const repository = useMemo(() => getWebMessagingRepository(), []);
  const locale = (i18n.language || "ar").startsWith("ar") ? "ar" : "en";
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);

  const userId = snapshot.user?.id ?? null;
  const unreadCount = countUnreadNotifications(items);

  const load = useCallback(async () => {
    if (!userId) {
      return;
    }
    const result = await repository.listNotifications({ userId, page: 1, pageSize: 8 });
    setItems(result.items);
  }, [repository, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    void load();
  }, [load, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    const client = getWebSupabaseClient();
    const channel = client.channel(`header-notifications-${userId}`);
    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_messages" }, () => {
        void load();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "follows" }, () => {
        void load();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ratings" }, () => {
        void load();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "listing_status_events" }, () => {
        void load();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_notification_deliveries" }, () => {
        void load();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "admin_notification_deliveries" }, () => {
        void load();
      })
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [load, userId]);

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
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="relative rounded-lg px-2 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
      >
        {t("nav.notifications")}
        {unreadCount > 0 ? (
          <span className="absolute -end-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{unreadCount}</span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute end-0 top-full z-50 mt-2 w-[320px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-sm font-semibold text-slate-900">{t("notifications.pageTitle")}</p>
            <button type="button" onClick={() => void markAllRead()} className="text-xs text-brand hover:underline">
              {t("notifications.markAllRead")}
            </button>
          </div>
          {items.length === 0 ? <p className="px-2 py-3 text-xs text-slate-500">{t("notifications.emptyTitle")}</p> : null}
          <div className="max-h-[340px] space-y-1 overflow-y-auto">
            {items.map((item) => (
              <Link
                key={item.id}
                href={resolveNotificationHref(language, item)}
                onClick={() => setIsOpen(false)}
                className={`block rounded-lg px-2 py-2 ${item.isRead ? "bg-white" : "bg-brand/5"}`}
              >
                {(() => {
                  const content = getNotificationContent(item, t);
                  return (
                    <>
                <p className="text-xs font-semibold text-slate-900">{t(`notifications.kind.${item.kind}`)}</p>
                <p className="line-clamp-1 text-xs text-slate-700">{content.title}</p>
                {content.body ? <p className="line-clamp-1 text-[11px] text-slate-500">{content.body}</p> : null}
                <p className="mt-1 text-[10px] text-slate-400">{formatRelativeTime(item.createdAt, locale)}</p>
                    </>
                  );
                })()}
              </Link>
            ))}
          </div>
          <Link href={`/${language}/notifications`} onClick={() => setIsOpen(false)} className="mt-2 block rounded-md border border-slate-200 px-2 py-1.5 text-center text-xs text-slate-700 hover:bg-slate-50">
            {t("notifications.viewAll")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
