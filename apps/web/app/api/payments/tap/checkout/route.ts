import { NextResponse } from "next/server";
import { createTapCharge } from "../../../../../src/lib/tap";
import { createClient } from "../../../../../utils/supabase/server";

type CheckoutRequestBody = {
  listingId?: string;
  amount?: number;
  language?: string;
};

function normalizeLanguage(value: string | undefined): "ar" | "en" {
  return value === "en" ? "en" : "ar";
}

function normalizeTapPhone(rawPhone: string | null): { country_code: string; number: string } | null {
  if (!rawPhone || rawPhone.trim().length === 0) {
    return null;
  }
  const digits = rawPhone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+966")) {
    return { country_code: "966", number: digits.slice(4) };
  }
  if (digits.startsWith("966")) {
    return { country_code: "966", number: digits.slice(3) };
  }
  if (digits.startsWith("0")) {
    return { country_code: "966", number: digits.slice(1) };
  }
  return { country_code: "966", number: digits.replace(/^\+/, "") };
}

function resolveSiteOrigin(request: Request): string {
  const configuredSiteUrl = process.env.SANANY_SITE_URL?.trim();
  if (configuredSiteUrl) {
    return configuredSiteUrl.replace(/\/+$/, "");
  }
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  let body: CheckoutRequestBody;
  try {
    body = (await request.json()) as CheckoutRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const listingId = body.listingId?.trim();
  const amount = Number(body.amount);
  if (!listingId) {
    return NextResponse.json({ error: "Missing listing id." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than zero." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const language = normalizeLanguage(typeof body.language === "string" ? body.language : undefined);
  const origin = resolveSiteOrigin(request);
  const redirectUrl = `${origin}/${language}/my-ads?listingId=${encodeURIComponent(listingId)}&tapCheckout=1`;
  const firstName =
    (typeof user.user_metadata?.display_name === "string" && user.user_metadata.display_name.trim().length > 0
      ? user.user_metadata.display_name.trim()
      : "SANANY User");

  try {
    const charge = await createTapCharge({
      amount,
      currency: "SAR",
      listingId,
      sellerId: user.id,
      language,
      redirectUrl,
      customer: {
        firstName,
        email: typeof user.email === "string" ? user.email : null,
        phone: normalizeTapPhone(typeof user.phone === "string" ? user.phone : null)
      }
    });

    if (!charge.checkoutUrl) {
      return NextResponse.json({ error: "Tap did not return a checkout URL for this payment." }, { status: 502 });
    }

    return NextResponse.json({
      tapChargeId: charge.id,
      tapStatus: charge.status,
      checkoutUrl: charge.checkoutUrl
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tap checkout creation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
