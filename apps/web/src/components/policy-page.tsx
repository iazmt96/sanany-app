import Link from "next/link";
import type { AppLanguage } from "@sanany/utils";
import { ResponsiveContainer } from "./layout/responsive-container";
import {
  POLICY_CONTACT_EMAIL,
  POLICY_LAST_UPDATED_AR,
  POLICY_LAST_UPDATED_EN,
  POLICY_ORG_NAME_AR,
  POLICY_ORG_NAME_EN,
  POLICY_VERSION,
  type PolicyBlock,
  type PolicyDocument
} from "../content/policies";

const labels = {
  ar: {
    lastUpdated: "آخر تحديث",
    version: "الإصدار",
    orgName: POLICY_ORG_NAME_AR,
    lastUpdatedValue: POLICY_LAST_UPDATED_AR,
    toc: "محتويات الصفحة",
    contactTitle: "للتواصل والاستفسارات",
    contactText: "لأي استفسار حول هذه السياسة يمكنكم التواصل عبر البريد الإلكتروني:",
    backToTop: "العودة إلى أعلى الصفحة",
    switchLabel: "English version",
    switchLang: "en" as AppLanguage,
    switchDir: "ltr" as const,
    otherLangName: "English"
  },
  en: {
    lastUpdated: "Last updated",
    version: "Version",
    orgName: POLICY_ORG_NAME_EN,
    lastUpdatedValue: POLICY_LAST_UPDATED_EN,
    toc: "On this page",
    contactTitle: "Contact us",
    contactText: "For any inquiries about this policy, contact us by email:",
    backToTop: "Back to top",
    switchLabel: "النسخة العربية",
    switchLang: "ar" as AppLanguage,
    switchDir: "rtl" as const,
    otherLangName: "العربية"
  }
};

function PolicyBlockView({ block }: { block: PolicyBlock }) {
  if (block.type === "ul") {
    return (
      <ul className="list-disc space-y-2 ps-6 text-slate-700">
        {block.items.map((item) => (
          <li key={item} className="leading-relaxed">
            {item}
          </li>
        ))}
      </ul>
    );
  }
  return <p className="leading-relaxed text-slate-700">{block.text}</p>;
}

type PolicyPageShellProps = {
  language: AppLanguage;
  document: PolicyDocument;
};

export function PolicyPageShell({ language, document }: PolicyPageShellProps) {
  const content = language === "en" ? document.en : document.ar;
  const l = language === "en" ? labels.en : labels.ar;
  const dir = language === "en" ? "ltr" : "rtl";
  const topId = `policy-top-${document.slug}`;

  return (
    <div dir={dir} lang={language}>
      <ResponsiveContainer className="py-8 sm:py-10">
        <div id={topId} className="mx-auto max-w-3xl space-y-6">
          <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-brand">{l.orgName}</p>
                <h1 className="text-2xl font-bold leading-snug text-slate-900 sm:text-3xl">{content.title}</h1>
                <p className="text-sm text-slate-500">
                  {l.lastUpdated}: {l.lastUpdatedValue} · {l.version} {POLICY_VERSION}
                </p>
              </div>
              <Link
                href={`/${l.switchLang}/${document.slug}`}
                dir={l.switchDir}
                lang={l.switchLang}
                hrefLang={l.switchLang}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand/40 hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                aria-label={l.switchLabel}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3.6 9h16.8M3.6 15h16.8" />
                  <path d="M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18" />
                </svg>
                {l.switchLabel}
              </Link>
            </div>
            {content.intro?.length ? (
              <div className="mt-5 space-y-3 border-t border-slate-100 pt-5">
                {content.intro.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-relaxed text-slate-600">
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : null}
          </header>

          <nav aria-label={l.toc} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{l.toc}</h2>
            <ol className="mt-3 columns-1 gap-6 space-y-2 sm:columns-2">
              {content.sections.map((section) => (
                <li key={section.id} className="break-inside-avoid">
                  <a href={`#${section.id}`} className="text-sm text-slate-700 underline-offset-4 hover:text-brand hover:underline">
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="space-y-10">
              {content.sections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-24 space-y-3">
                  <h2 className="text-lg font-bold text-slate-900 sm:text-xl">{section.title}</h2>
                  {section.blocks.map((block, index) => (
                    <PolicyBlockView key={`${section.id}-${index}`} block={block} />
                  ))}
                </section>
              ))}
            </div>
          </article>

          <aside className="rounded-2xl border border-brand/20 bg-brand/5 p-6 sm:p-8">
            <h2 className="text-base font-bold text-slate-900">{l.contactTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{l.contactText}</p>
            <a
              href={`mailto:${POLICY_CONTACT_EMAIL}`}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
              dir="ltr"
            >
              {POLICY_CONTACT_EMAIL}
            </a>
          </aside>

          <div className="flex justify-center pb-2">
            <a href={`#${topId}`} className="text-sm font-medium text-slate-500 underline-offset-4 hover:text-brand hover:underline">
              ↑ {l.backToTop}
            </a>
          </div>
        </div>
      </ResponsiveContainer>
    </div>
  );
}
