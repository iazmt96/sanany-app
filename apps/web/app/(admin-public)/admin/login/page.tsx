import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminAuthContext } from "../../../../src/admin/auth";
import { AppProviders } from "../../../../src/providers";
import { AdminLoginShell } from "../../../../src/components/admin/admin-login-shell";

export const metadata: Metadata = {
  title: "دخول المشرف | SANANY",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLoginPage() {
  const auth = await getAdminAuthContext();

  // Already authenticated admin → go straight to dashboard
  if (auth.status === "authorized") {
    redirect("/admin/dashboard");
  }

  return (
    <AppProviders language="ar">
      <AdminLoginShell />
    </AppProviders>
  );
}
