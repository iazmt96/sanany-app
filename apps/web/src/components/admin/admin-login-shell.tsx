"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { OTP_LENGTH, isValidPhoneNumber, normalizePhoneNumber, resolveAuthErrorKey } from "@sanany/shared";
import { useAuth } from "../../auth/auth-context";

type Step = "phone" | "otp";

const COUNTRIES = [
  { id: "sa", code: "+966", flag: "🇸🇦" },
  { id: "ae", code: "+971", flag: "🇦🇪" },
  { id: "kw", code: "+965", flag: "🇰🇼" },
  { id: "qa", code: "+974", flag: "🇶🇦" },
  { id: "bh", code: "+973", flag: "🇧🇭" },
] as const;

function formatPhoneInput(raw: string, countryCode: string): string {
  const countryDigits = countryCode.replace(/\D/g, "");
  let digits = raw.replace(/\D/g, "");
  if (countryDigits && digits.startsWith(countryDigits)) digits = digits.slice(countryDigits.length);
  if (digits.startsWith("0")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

export function AdminLoginShell() {
  const router = useRouter();
  const { requestPhoneOtp, verifyPhoneOtp, snapshot } = useAuth();

  const [step, setStep] = useState<Step>("phone");
  const [selectedCountryId, setSelectedCountryId] = useState<(typeof COUNTRIES)[number]["id"]>("sa");
  const [phoneInput, setPhoneInput] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const selectedCountry = COUNTRIES.find((c) => c.id === selectedCountryId) ?? COUNTRIES[0];

  const normalizedPhone = useMemo(() => {
    const digits = phoneInput.replace(/\D/g, "");
    if (!digits) return "";
    const countryDigits = selectedCountry.code.replace(/\D/g, "");
    if (phoneInput.trim().startsWith("+")) return normalizePhoneNumber(phoneInput);
    if (countryDigits && digits.startsWith(countryDigits)) return normalizePhoneNumber(`+${digits}`);
    const local = digits.startsWith("0") ? digits.slice(1) : digits;
    return normalizePhoneNumber(`${selectedCountry.code}${local}`);
  }, [phoneInput, selectedCountry.code]);

  // If already logged in, redirect to admin dashboard (layout will handle auth check)
  useEffect(() => {
    if (snapshot.status === "authenticated") {
      router.replace("/admin/dashboard");
    }
  }, [snapshot.status, router]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => setResendSeconds((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!isValidPhoneNumber(normalizedPhone)) {
      setErrorMsg("رقم الجوال غير صحيح");
      return;
    }
    setIsSubmitting(true);
    try {
      await requestPhoneOtp({ phone: normalizedPhone });
      setStep("otp");
      setResendSeconds(60);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      const key = resolveAuthErrorKey(err instanceof Error ? err.message : "");
      setErrorMsg(key === "auth.errors.tooManyRequests" ? "طلبات كثيرة، انتظر قليلاً" : "حدث خطأ، حاول مجدداً");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (otpValue.length !== OTP_LENGTH) {
      setErrorMsg("أدخل رمز التحقق كاملاً");
      return;
    }
    setIsSubmitting(true);
    try {
      await verifyPhoneOtp({ phone: normalizedPhone, token: otpValue });
      // Redirect handled by useEffect above
    } catch (err) {
      const key = resolveAuthErrorKey(err instanceof Error ? err.message : "");
      setErrorMsg(key === "auth.errors.invalidOtp" ? "رمز التحقق غير صحيح" : "انتهت صلاحية الرمز، اطلب رمزاً جديداً");
      setOtpValue("");
      otpRefs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOtpInput(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const arr = otpValue.padEnd(OTP_LENGTH, " ").split("");
    arr[index] = digit || " ";
    const next = arr.join("").trimEnd();
    setOtpValue(next.replace(/ /g, ""));
    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      const arr = otpValue.padEnd(OTP_LENGTH, " ").split("");
      if (arr[index]?.trim()) {
        arr[index] = " ";
        setOtpValue(arr.join("").trimEnd().replace(/ /g, ""));
      } else if (index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
    }
  }

  return (
    <div className="flex min-h-screen" dir="rtl">
      {/* Left panel — branding */}
      <div className="hidden w-80 flex-col justify-between bg-slate-900 p-8 lg:flex">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand">
              <span className="text-sm font-bold text-white">S</span>
            </div>
            <span className="text-lg font-bold text-white">SANANY</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">لوحة التحكم الإدارية</p>
        </div>

        <div className="space-y-4">
          {[
            { icon: "🏷️", label: "إدارة التصنيفات والأقسام" },
            { icon: "📋", label: "مراجعة الإعلانات والمحتوى" },
            { icon: "👥", label: "إدارة المستخدمين والشركات" },
            { icon: "📊", label: "التقارير والإحصائيات" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm text-slate-300">{item.label}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500">هذه الصفحة مخصصة للمشرفين فقط</p>
      </div>

      {/* Right panel — login form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
              <span className="text-sm font-bold text-white">S</span>
            </div>
            <span className="font-bold text-slate-900">SANANY — لوحة التحكم</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            {step === "phone" ? (
              <>
                <h1 className="text-xl font-bold text-slate-900">دخول المشرف</h1>
                <p className="mt-1 text-sm text-slate-500">أدخل رقم الجوال المسجل للوحة التحكم</p>

                <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">رقم الجوال</label>
                    <div className="flex gap-2">
                      <select
                        value={selectedCountryId}
                        onChange={(e) => setSelectedCountryId(e.target.value as typeof selectedCountryId)}
                        className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.flag} {c.code}
                          </option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        dir="ltr"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(formatPhoneInput(e.target.value, selectedCountry.code))}
                        placeholder="5XX XXX XXXX"
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                        autoComplete="tel"
                      />
                    </div>
                  </div>

                  {errorMsg && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errorMsg}</p>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting || !phoneInput.trim()}
                    className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
                  >
                    {isSubmitting ? "جاري الإرسال…" : "إرسال رمز التحقق"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h1 className="text-xl font-bold text-slate-900">رمز التحقق</h1>
                <p className="mt-1 text-sm text-slate-500">
                  أرسلنا رمزاً مكوناً من {OTP_LENGTH} أرقام إلى{" "}
                  <span dir="ltr" className="font-medium text-slate-700">
                    {selectedCountry.code} {phoneInput}
                  </span>
                </p>

                <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
                  <div className="flex justify-center gap-2" dir="ltr">
                    {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                      <input
                        key={i}
                        ref={(el) => { otpRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={otpValue[i] ?? ""}
                        onChange={(e) => handleOtpInput(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className="h-12 w-10 rounded-lg border border-slate-200 text-center text-lg font-bold focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                      />
                    ))}
                  </div>

                  {errorMsg && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errorMsg}</p>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting || otpValue.length < OTP_LENGTH}
                    className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
                  >
                    {isSubmitting ? "جاري التحقق…" : "تأكيد الدخول"}
                  </button>

                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={() => { setStep("phone"); setOtpValue(""); setErrorMsg(null); }}
                      className="text-slate-500 hover:text-slate-700"
                    >
                      تغيير الرقم
                    </button>
                    {resendSeconds > 0 ? (
                      <span className="text-slate-400">إعادة الإرسال بعد {resendSeconds}ث</span>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          setErrorMsg(null);
                          setIsSubmitting(true);
                          try {
                            await requestPhoneOtp({ phone: normalizedPhone });
                            setResendSeconds(60);
                            setOtpValue("");
                          } catch {
                            setErrorMsg("حدث خطأ، حاول مجدداً");
                          } finally {
                            setIsSubmitting(false);
                          }
                        }}
                        className="font-medium text-brand hover:text-brand-dark"
                      >
                        إعادة الإرسال
                      </button>
                    )}
                  </div>
                </form>
              </>
            )}
          </div>

          <p className="mt-4 text-center text-xs text-slate-400">
            هذه الصفحة مخصصة للمشرفين فقط •{" "}
            <Link href="/ar" className="hover:text-slate-600">العودة للموقع</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
