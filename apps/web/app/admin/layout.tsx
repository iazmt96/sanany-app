import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { resources } from "@sanany/shared";
import { getDirection } from "@sanany/utils";
import { AppProviders } from "../../src/providers";
import { getAdminAuthContext } from "../../src/admin/auth";
import { resolveAdminLanguage } from "../../src/admin/locale";
import { AdminLayoutShell } from "../../src/components/admin/admin-layout-shell";

export const metadata: Metadata = {
  title: "Admin | SANANY",
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const language = await resolveAdminLanguage();
  const auth = await getAdminAuthContext();
  const dictionary = resources[language].translation;
  const direction = getDirection(language);

  if (auth.status === "unauthenticated") {
    redirect("/admin/login");
  }

  if (auth.status === "forbidden") {
    return (
      <div dir={direction} className="min-h-screen bg-slate-100 p-4 sm:p-6">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">{dictionary.admin.status.forbiddenTitle}</h1>
          <p className="mt-2 text-sm text-slate-600">{dictionary.admin.status.forbiddenHint}</p>
          <Link
            href={`/${language}`}
            className="mt-4 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            {dictionary.admin.status.backToMarketplace}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AppProviders language={language}>
      <AdminLayoutShell language={language} role={auth.role} displayName={auth.displayName} email={auth.email}>
        {children}
      </AdminLayoutShell>
    </AppProviders>
  );
}
