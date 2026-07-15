import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { hasAdminPermission, resources, formatCurrencySar, formatDateTimeFull } from "@sanany/shared";
import { getAdminAuthContext } from "../../../../../../src/admin/auth";
import { resolveAdminLanguage } from "../../../../../../src/admin/locale";

function requireServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase server configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createSupabaseClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function GET(_: Request, context: { params: Promise<{ paymentId: string }> }) {
  const auth = await getAdminAuthContext();
  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "finance.manage")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const language = await resolveAdminLanguage();
  const dictionary = resources[language].translation;
  const { paymentId } = await context.params;
  const adminClient = requireServiceRoleClient();
  const { data, error } = await adminClient
    .from("listing_sale_payments")
    .select(
      "id,listing_id,seller_id,final_sale_amount,commission_rate_percent,commission_amount,payment_status,payment_method,payment_date,invoice_number,transaction_reference,profiles!listing_sale_payments_seller_id_fkey(display_name,username),listings!listing_sale_payments_listing_id_fkey(title)"
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const listing = Array.isArray(data.listings) ? data.listings[0] : data.listings;
  const seller = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
  const paymentStatusKey = String(data.payment_status ?? "pending") as keyof typeof dictionary.admin.commissionPayments.status;
  const html = `<!doctype html>
<html lang="${language === "ar" ? "ar" : "en"}" dir="${language === "ar" ? "rtl" : "ltr"}">
  <head>
    <meta charset="utf-8" />
    <title>${data.invoice_number ?? paymentId}</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; padding: 32px; }
      .card { max-width: 760px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 28px; }
      .brand { font-size: 28px; font-weight: 700; color: #0f766e; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 24px; }
      .item { border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; }
      .label { color: #64748b; font-size: 13px; margin-bottom: 6px; }
      .value { font-size: 16px; font-weight: 600; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="brand">SANANY</div>
      <div class="grid">
        <div class="item"><div class="label">${dictionary.admin.commissionPayments.columns.invoiceNumber}</div><div class="value">${data.invoice_number ?? "-"}</div></div>
        <div class="item"><div class="label">${dictionary.admin.commissionPayments.columns.status}</div><div class="value">${dictionary.admin.commissionPayments.status[paymentStatusKey]}</div></div>
        <div class="item"><div class="label">${dictionary.admin.commissionPayments.columns.listing}</div><div class="value">${listing?.title ?? data.listing_id}</div></div>
        <div class="item"><div class="label">${dictionary.admin.commissionPayments.columns.seller}</div><div class="value">${seller?.display_name ?? seller?.username ?? data.seller_id}</div></div>
        <div class="item"><div class="label">${dictionary.admin.commissionPayments.columns.saleAmount}</div><div class="value">${formatCurrencySar(Number(data.final_sale_amount ?? 0), language)}</div></div>
        <div class="item"><div class="label">${dictionary.admin.commissionPayments.columns.commission}</div><div class="value">${formatCurrencySar(Number(data.commission_amount ?? 0), language)}</div></div>
        <div class="item"><div class="label">${dictionary.admin.commissionPayments.columns.rate}</div><div class="value">${Number(data.commission_rate_percent ?? 0)}%</div></div>
        <div class="item"><div class="label">${dictionary.admin.commissionPayments.columns.paymentDate}</div><div class="value">${data.payment_date ? formatDateTimeFull(data.payment_date, language) : "-"}</div></div>
        <div class="item"><div class="label">${dictionary.admin.commissionPayments.columns.transactionReference}</div><div class="value">${data.transaction_reference ?? "-"}</div></div>
        <div class="item"><div class="label">${dictionary.myAds.saleFlow.paymentMethod}</div><div class="value">${data.payment_method ?? "digital_checkout"}</div></div>
      </div>
    </div>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${data.invoice_number ?? paymentId}.html"`
    }
  });
}
