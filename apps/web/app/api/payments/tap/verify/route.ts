import { NextResponse } from "next/server";
import { getTapCharge, normalizeTapFailureReason, resolveTapOutcome } from "../../../../../src/lib/tap";
import { createRequestSupabaseClient, resolveRequestUser } from "../../../../../src/lib/request-user";

type VerifyRequestBody = {
  listingId?: string;
  tapId?: string;
};

type PaymentOutcome = "paid" | "failed" | "cancelled" | "pending";

type SalePaymentStatusRow = {
  payment_status: string;
};

export async function POST(request: Request) {
  let body: VerifyRequestBody;
  try {
    body = (await request.json()) as VerifyRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const listingId = body.listingId?.trim();
  const tapId = body.tapId?.trim();
  if (!listingId || !tapId) {
    return NextResponse.json({ error: "Missing listing id or Tap payment id." }, { status: 400 });
  }

  const { user, error: userError } = await resolveRequestUser(request);
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = await createRequestSupabaseClient(request);

  let tapStatus = "UNKNOWN";
  let outcome: PaymentOutcome = "pending";
  let failureReason: string | null = null;
  try {
    const charge = await getTapCharge(tapId);
    tapStatus = typeof charge.status === "string" ? charge.status : "UNKNOWN";
    outcome = resolveTapOutcome(charge.status);
    failureReason = normalizeTapFailureReason(charge);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tap payment verification failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { data: existingPayment, error: existingPaymentError } = await supabase
    .from("listing_sale_payments")
    .select("payment_status")
    .eq("listing_id", listingId)
    .eq("seller_id", user.id)
    .maybeSingle();

  if (existingPaymentError) {
    return NextResponse.json({ error: existingPaymentError.message }, { status: 500 });
  }

  if (!existingPayment) {
    return NextResponse.json({ error: "No prepared commission payment was found for this listing." }, { status: 404 });
  }

  const paymentStatus = (existingPayment as SalePaymentStatusRow).payment_status;
  if (paymentStatus === "paid") {
    return NextResponse.json({
      listingId,
      tapId,
      tapStatus,
      outcome: "paid"
    });
  }

  if (outcome !== "pending") {
    const { error: finalizeError } = await supabase.rpc("finalize_listing_sale_payment", {
      p_listing_id: listingId,
      p_payment_status: outcome,
      p_payment_method: `tap:${tapId}`,
      p_failure_reason: outcome === "failed" ? failureReason ?? "tap_failed" : outcome === "cancelled" ? failureReason ?? "tap_cancelled" : null
    });

    if (finalizeError) {
      return NextResponse.json({ error: finalizeError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    listingId,
    tapId,
    tapStatus,
    outcome,
    failureReason
  });
}
