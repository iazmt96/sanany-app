import { notFound } from "next/navigation";
import { resources } from "@sanany/shared";
import { resolveAdminLanguage } from "../../../src/admin/locale";

const ALLOWED_SECTIONS = new Set([
  "users",
  "companies",
  "listings",
  "categories",
  "reports",
  "reviews",
  "verifications",
  "notifications",
  "settings",
  "audit-logs"
]);

const SECTION_LABEL_KEY: Record<string, keyof typeof resources.ar.translation.admin.sidebar> = {
  users: "users",
  companies: "companies",
  listings: "listings",
  categories: "categories",
  reports: "reports",
  reviews: "reviews",
  verifications: "verifications",
  notifications: "notifications",
  settings: "settings",
  "audit-logs": "auditLogs"
};

type AdminSectionPageProps = {
  params: Promise<{ section: string }>;
};

export default async function AdminSectionPlaceholderPage({ params }: AdminSectionPageProps) {
  const { section } = await params;
  if (!ALLOWED_SECTIONS.has(section)) {
    notFound();
  }
  const language = await resolveAdminLanguage();
  const dictionary = resources[language].translation;
  const labelKey = SECTION_LABEL_KEY[section];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900">{dictionary.admin.sidebar[labelKey]}</h2>
      <p className="mt-2 text-sm text-slate-600">{dictionary.admin.status.phaseOnePlaceholder}</p>
    </section>
  );
}
