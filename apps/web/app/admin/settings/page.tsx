import { hasAdminPermission, resources } from "@sanany/shared";
import { getAdminAuthContext } from "../../../src/admin/auth";
import { resolveAdminLanguage } from "../../../src/admin/locale";
import { getAdminSettingsData } from "../../../src/admin/settings";
import { AdminForbidden } from "../../../src/components/admin/admin-forbidden";

export default async function AdminSettingsPage() {
  const language = await resolveAdminLanguage();
  const dictionary = resources[language].translation;
  const auth = await getAdminAuthContext();

  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "settings.manage")) {
    return <AdminForbidden language={language} />;
  }

  const data = await getAdminSettingsData();

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">{dictionary.admin.settingsPanel.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{dictionary.admin.settingsPanel.subtitle}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.settingsPanel.sections.configuration}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {data.flags.map((flag) => (
              <div key={flag.key} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{dictionary.admin.settingsPanel.flags[flag.key]}</p>
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                      flag.status === "configured" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {flag.status === "configured"
                      ? dictionary.admin.settingsPanel.status.configured
                      : dictionary.admin.settingsPanel.status.missing}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  {flag.key === "adminWhitelist"
                    ? dictionary.admin.settingsPanel.values.adminWhitelist.replace("{{count}}", flag.value)
                    : flag.value || dictionary.admin.settingsPanel.values.statusOnly}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.settingsPanel.sections.metrics}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {data.metrics.map((metric) => (
              <div key={metric.key} className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {dictionary.admin.settingsPanel.metrics[metric.key]}
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {metric.value === null ? dictionary.admin.dashboard.unavailable : metric.value.toLocaleString(language === "ar" ? "ar-SA" : "en-US")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.settingsPanel.sections.roles}</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-start">{dictionary.admin.settingsPanel.columns.role}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.settingsPanel.columns.permissionsCount}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.settingsPanel.columns.permissions}</th>
              </tr>
            </thead>
            <tbody>
              {data.roleSummaries.map((item) => (
                <tr key={item.role} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 font-medium text-slate-900">{item.role}</td>
                  <td className="px-3 py-2 text-slate-700">{item.permissionsCount}</td>
                  <td className="px-3 py-2 text-slate-700">{item.permissions.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
