"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { hasAdminPermission, type AdminPermission, type AdminRole } from "@sanany/shared";
import { useAuth } from "../../auth/auth-context";
import { defaultLanguage, getDirection, isSupportedLanguage, type AppLanguage } from "@sanany/utils";

type AdminLayoutShellProps = {
  children: ReactNode;
  language: AppLanguage;
  role: AdminRole;
  displayName: string;
  email: string;
};

type AdminNavItem = {
  href: string;
  labelKey: string;
  permission: AdminPermission | null;
};

const NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin/dashboard", labelKey: "dashboard", permission: "dashboard.view" },
  { href: "/admin/users", labelKey: "users", permission: "users.view" },
  { href: "/admin/companies", labelKey: "companies", permission: "companies.verify" },
  { href: "/admin/listings", labelKey: "listings", permission: "listings.view" },
  { href: "/admin/categories", labelKey: "categories", permission: "categories.manage" },
  { href: "/admin/reports", labelKey: "reports", permission: "reports.manage" },
  { href: "/admin/reviews", labelKey: "reviews", permission: "reviews.manage" },
  { href: "/admin/verifications", labelKey: "verifications", permission: "companies.verify" },
  { href: "/admin/notifications", labelKey: "notifications", permission: "notifications.send" },
  { href: "/admin/settings", labelKey: "settings", permission: "settings.manage" },
  { href: "/admin/audit-logs", labelKey: "auditLogs", permission: "audit_logs.view" }
];

export function AdminLayoutShell({ children, language, role, displayName, email }: AdminLayoutShellProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { signOut } = useAuth();
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const direction = getDirection(resolvedLanguage);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") ?? "");

  const visibleNavItems = NAV_ITEMS.filter((item) => (item.permission ? hasAdminPermission(role, item.permission) : true));

  useEffect(() => {
    setSearchTerm(searchParams.get("q") ?? "");
  }, [searchParams]);

  const onSignOut = async () => {
    await signOut();
    router.replace(`/${resolvedLanguage}/auth`);
  };

  const onSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = searchTerm.trim();
    router.push(trimmed.length > 0 ? `/admin/search?q=${encodeURIComponent(trimmed)}` : "/admin/search");
  };

  return (
    <div dir={direction} className="min-h-screen bg-slate-100">
      <div className="mx-auto grid min-h-screen w-full max-w-[1600px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-slate-200 bg-slate-900 text-slate-100 lg:border-e">
          <div className="border-b border-slate-800 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">SANANY</p>
            <p className="mt-1 text-lg font-bold">{t("admin.title")}</p>
          </div>
          <nav className="space-y-1 p-3">
            {visibleNavItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active ? "bg-brand text-white" : "text-slate-200 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {t(`admin.sidebar.${item.labelKey}`)}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div>
                <p className="text-xs text-slate-500">{t("admin.header.welcome")}</p>
                <h1 className="text-sm font-semibold text-slate-900 sm:text-base">{displayName}</h1>
                <p className="text-xs text-slate-500">{email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <form onSubmit={onSearchSubmit} className="flex items-center gap-2">
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder={t("admin.search.placeholder")}
                    className="h-9 w-48 rounded-lg border border-slate-300 px-3 text-xs text-slate-900 outline-none ring-brand/30 transition focus:border-brand focus:ring sm:w-64"
                  />
                  <button
                    type="submit"
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    {t("admin.search.submit")}
                  </button>
                </form>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {t("admin.header.role")}: {role}
                </span>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  {t("admin.sidebar.signOut")}
                </button>
              </div>
            </div>
          </header>
          <main className="p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
