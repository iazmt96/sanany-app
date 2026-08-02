type TapCustomerPhone = {
  country_code: string;
  number: string;
};

type TapChargeTransaction = {
  url?: string;
};

type TapChargeResponse = {
  id?: string;
  status?: string;
  transaction?: TapChargeTransaction | null;
  response?: { message?: string | null } | null;
};

type CreateTapChargeInput = {
  amount: number;
  currency: string;
  listingId: string;
  sellerId: string;
  language: "ar" | "en";
  redirectUrl: string;
  customer: {
    firstName: string;
    email: string | null;
    phone: TapCustomerPhone | null;
  };
};

const TAP_API_BASE_URL = "https://api.tap.company/v2";

function requireTapSecretKey(): string {
  const tapSecretKey = process.env.TAP_SECRET_KEY?.trim();
  if (!tapSecretKey) {
    throw new Error("Missing TAP_SECRET_KEY. Define it in apps/web/.env.local and in deployment secrets.");
  }
  return tapSecretKey;
}

function normalizeTapErrorMessage(payload: unknown, fallbackMessage: string): string {
  if (!payload || typeof payload !== "object") {
    return fallbackMessage;
  }
  const message = (payload as { message?: unknown }).message;
  if (typeof message === "string" && message.trim().length > 0) {
    return message.trim();
  }
  const errors = (payload as { errors?: unknown }).errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const firstError = errors[0];
    if (firstError && typeof firstError === "object") {
      const firstDescription = (firstError as { description?: unknown }).description;
      if (typeof firstDescription === "string" && firstDescription.trim().length > 0) {
        return firstDescription.trim();
      }
    }
  }
  return fallbackMessage;
}

async function tapRequest<T>(path: string, init: RequestInit, fallbackMessage: string): Promise<T> {
  const secretKey = requireTapSecretKey();
  const response = await fetch(`${TAP_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    },
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw new Error(normalizeTapErrorMessage(payload, fallbackMessage));
  }
  return payload as T;
}

export function resolveTapOutcome(status: string | null | undefined): "paid" | "failed" | "cancelled" | "pending" {
  const normalizedStatus = (status ?? "").trim().toUpperCase();
  if (normalizedStatus === "CAPTURED" || normalizedStatus === "PAID") {
    return "paid";
  }
  if (normalizedStatus === "FAILED" || normalizedStatus === "DECLINED") {
    return "failed";
  }
  if (normalizedStatus === "CANCELLED" || normalizedStatus === "VOID" || normalizedStatus === "VOIDED" || normalizedStatus === "ABANDONED" || normalizedStatus === "EXPIRED") {
    return "cancelled";
  }
  return "pending";
}

export async function createTapCharge(input: CreateTapChargeInput): Promise<{
  id: string;
  status: string;
  checkoutUrl: string | null;
}> {
  const payload = await tapRequest<TapChargeResponse>(
    "/charges",
    {
      method: "POST",
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency,
        threeDSecure: true,
        save_card: false,
        description: `SANANY commission for listing ${input.listingId}`,
        statement_descriptor: "SANANY",
        reference: {
          transaction: `listing-${input.listingId}`,
          order: `listing-${input.listingId}`
        },
        customer: {
          first_name: input.customer.firstName,
          email: input.customer.email ?? undefined,
          phone: input.customer.phone ?? undefined
        },
        source: {
          id: "src_all"
        },
        redirect: {
          url: input.redirectUrl
        },
        metadata: {
          listingId: input.listingId,
          sellerId: input.sellerId,
          language: input.language
        }
      })
    },
    "Tap checkout creation failed."
  );

  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  if (!id) {
    throw new Error("Tap checkout creation failed: missing charge id.");
  }

  const status = typeof payload.status === "string" ? payload.status : "UNKNOWN";
  const checkoutUrl = typeof payload.transaction?.url === "string" && payload.transaction.url.trim().length > 0 ? payload.transaction.url : null;

  return { id, status, checkoutUrl };
}

export async function getTapCharge(chargeId: string): Promise<TapChargeResponse> {
  const normalizedChargeId = chargeId.trim();
  if (!normalizedChargeId) {
    throw new Error("Tap charge id is required.");
  }
  return tapRequest<TapChargeResponse>(`/charges/${encodeURIComponent(normalizedChargeId)}`, { method: "GET" }, "Tap payment verification failed.");
}

export function normalizeTapFailureReason(charge: TapChargeResponse): string | null {
  const responseMessage = charge.response?.message;
  if (typeof responseMessage === "string" && responseMessage.trim().length > 0) {
    return responseMessage.trim();
  }
  const status = typeof charge.status === "string" ? charge.status.trim().toLowerCase() : "";
  if (!status) {
    return null;
  }
  return `tap_${status}`;
}
