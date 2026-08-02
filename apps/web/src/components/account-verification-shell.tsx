"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { isSupportedLanguage, defaultLanguage } from "@sanany/utils";
import { Card } from "@sanany/ui";
import { useAuth } from "../auth/auth-context";
import { RequireAuth } from "../auth/guards";
import { getWebSupabaseClient } from "../lib/supabase-client";

type VerificationType = "individual" | "company";

type VerificationStatus =
  | "unverified"
  | "pending"
  | "additional_info_required"
  | "verified"
  | "rejected";

type VerificationRequest = {
  id: string;
  status: VerificationStatus;
  legal_full_name: string | null;
  national_id: string | null;
  birth_date: string | null;
  city: string | null;
  email: string | null;
  document_front_url: string | null;
  document_back_url: string | null;
  selfie_url: string | null;
  business_name: string | null;
  business_registration: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
};

type IndividualFormData = {
  legalFullName: string;
  nationalId: string;
  birthDate: string;
  city: string;
  email: string;
};

type CompanyFormData = {
  representativeName: string;
  businessName: string;
  businessRegistration: string;
  businessType: string;
  taxNumber: string;
  city: string;
  email: string;
  website: string;
  description: string;
};

type FormErrors = Partial<Record<string, string>>;

const BUSINESS_TYPES = [
  "retail",
  "wholesale",
  "services",
  "technology",
  "realEstate",
  "automotive",
  "food",
  "other",
] as const;

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function readableFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function isFileTooLarge(file: File): boolean {
  return file.size > MAX_FILE_SIZE_BYTES;
}

type DocumentUploadFieldProps = {
  id: string;
  label: string;
  hint: string;
  reason: string;
  value: string | null;
  previewUrl: string | null;
  onChange: (file: File | null) => void;
  error?: string;
  lang: string;
};

function DocumentUploadField({
  id,
  label,
  hint,
  reason,
  value,
  previewUrl,
  onChange,
  error,
  lang,
}: DocumentUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isRtl = lang === "ar";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file && isFileTooLarge(file)) {
      onChange(null);
      return;
    }
    onChange(file ?? null);
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">
        {label} <span className="text-red-500">*</span>
      </label>
      <p className="text-xs text-slate-500">{reason}</p>

      <div
        className={`relative flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 transition ${
          error ? "border-red-300 bg-red-50" : "border-slate-200 bg-slate-50 hover:border-brand hover:bg-brand/5"
        }`}
        onClick={() => inputRef.current?.click()}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={label}
            className="h-16 w-16 rounded-lg object-cover border border-slate-200"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700">
            {value ? (isRtl ? "تغيير الملف" : "Change file") : (isRtl ? "رفع صورة" : "Upload image")}
          </p>
          <p className="text-xs text-slate-400">{hint}</p>
        </div>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          onChange={handleChange}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

type AccountVerificationShellProps = {
  language: string;
};

export function AccountVerificationShell({ language }: AccountVerificationShellProps) {
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const isRtl = resolvedLanguage === "ar";

  return (
    <RequireAuth language={resolvedLanguage}>
      <div dir={isRtl ? "rtl" : "ltr"} className="mx-auto max-w-2xl space-y-6 overflow-x-hidden">
        <VerificationBody language={resolvedLanguage} />
      </div>
    </RequireAuth>
  );
}

function VerificationBody({ language }: { language: string }) {
  const { t } = useTranslation();
  const { snapshot } = useAuth();
  const user = snapshot.user;
  const router = useRouter();
  const isRtl = language === "ar";

  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<VerificationRequest | null>(null);
  const [selectedType, setSelectedType] = useState<VerificationType | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [saveDraftSuccess, setSaveDraftSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Individual form
  const [indForm, setIndForm] = useState<IndividualFormData>({
    legalFullName: "",
    nationalId: "",
    birthDate: "",
    city: "",
    email: "",
  });
  const [indDocFront, setIndDocFront] = useState<File | null>(null);
  const [indDocFrontPreview, setIndDocFrontPreview] = useState<string | null>(null);
  const [indDocBack, setIndDocBack] = useState<File | null>(null);
  const [indDocBackPreview, setIndDocBackPreview] = useState<string | null>(null);
  const [indSelfie, setIndSelfie] = useState<File | null>(null);
  const [indSelfiePreview, setIndSelfiePreview] = useState<string | null>(null);

  // Company form
  const [compForm, setCompForm] = useState<CompanyFormData>({
    representativeName: "",
    businessName: "",
    businessRegistration: "",
    businessType: "other",
    taxNumber: "",
    city: "",
    email: "",
    website: "",
    description: "",
  });
  const [compDoc, setCompDoc] = useState<File | null>(null);
  const [compDocPreview, setCompDocPreview] = useState<string | null>(null);

  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // Load existing request
  useEffect(() => {
    if (!user) return;
    const supabase = getWebSupabaseClient();
    supabase
      .from("account_verification_requests")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExisting(data as VerificationRequest);
          // Infer type from data
          if (data.business_name) {
            setSelectedType("company");
            setCompForm({
              representativeName: data.legal_full_name ?? "",
              businessName: data.business_name ?? "",
              businessRegistration: data.business_registration ?? "",
              businessType: "other",
              taxNumber: "",
              city: data.city ?? "",
              email: data.email ?? "",
              website: "",
              description: "",
            });
          } else {
            setSelectedType("individual");
            setIndForm({
              legalFullName: data.legal_full_name ?? "",
              nationalId: data.national_id ?? "",
              birthDate: data.birth_date ?? "",
              city: data.city ?? "",
              email: data.email ?? "",
            });
            if (data.document_front_url) setIndDocFrontPreview(data.document_front_url);
            if (data.document_back_url) setIndDocBackPreview(data.document_back_url);
            if (data.selfie_url) setIndSelfiePreview(data.selfie_url);
          }
        }
        setLoading(false);
      });
  }, [user]);

  // Handle file previews
  useEffect(() => {
    if (!indDocFront) return;
    const url = URL.createObjectURL(indDocFront);
    setIndDocFrontPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [indDocFront]);

  useEffect(() => {
    if (!indDocBack) return;
    const url = URL.createObjectURL(indDocBack);
    setIndDocBackPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [indDocBack]);

  useEffect(() => {
    if (!indSelfie) return;
    const url = URL.createObjectURL(indSelfie);
    setIndSelfiePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [indSelfie]);

  useEffect(() => {
    if (!compDoc) return;
    const url = URL.createObjectURL(compDoc);
    setCompDocPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [compDoc]);

  function validateIndividual(): FormErrors {
    const errors: FormErrors = {};
    if (!indForm.legalFullName.trim()) errors.legalFullName = t("profile.verificationFlow.errors.legalNameRequired");
    if (!indForm.nationalId.trim()) errors.nationalId = t("profile.verificationFlow.errors.nationalIdRequired");
    if (!indForm.birthDate) errors.birthDate = t("profile.verificationFlow.errors.birthDateRequired");
    if (!indDocFront && !indDocFrontPreview) errors.documentFront = t("profile.verificationFlow.errors.documentRequired");
    return errors;
  }

  function validateCompany(): FormErrors {
    const errors: FormErrors = {};
    if (!compForm.businessName.trim()) errors.businessName = t("profile.verificationFlow.errors.businessNameRequired");
    if (!compForm.businessRegistration.trim()) errors.businessRegistration = t("profile.verificationFlow.errors.businessRegistrationRequired");
    if (!compForm.representativeName.trim()) errors.representativeName = t("profile.verificationFlow.errors.representativeRequired");
    if (!compDoc && !compDocPreview) errors.companyDoc = t("profile.verificationFlow.errors.documentRequired");
    return errors;
  }

  async function uploadFile(file: File, bucket: string, path: string): Promise<string | null> {
    const supabase = getWebSupabaseClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true });
    if (error || !data) return null;
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return urlData.publicUrl;
  }

  async function handleSubmit(asDraft: boolean) {
    if (!user) return;
    setServerError(null);

    const errors = selectedType === "individual" ? validateIndividual() : validateCompany();
    if (!asDraft && Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setSaving(true);

    try {
      const supabase = getWebSupabaseClient();
      let payload: Record<string, unknown> = {
        user_id: user.id,
        status: asDraft ? "unverified" : "pending",
        submitted_at: asDraft ? null : new Date().toISOString(),
      };

      if (selectedType === "individual") {
        let docFrontUrl = indDocFrontPreview;
        let docBackUrl = indDocBackPreview;
        let selfieUrl = indSelfiePreview;

        if (indDocFront) {
          docFrontUrl = await uploadFile(indDocFront, "verification-documents", `${user.id}/id-front-${Date.now()}`);
        }
        if (indDocBack) {
          docBackUrl = await uploadFile(indDocBack, "verification-documents", `${user.id}/id-back-${Date.now()}`);
        }
        if (indSelfie) {
          selfieUrl = await uploadFile(indSelfie, "verification-documents", `${user.id}/selfie-${Date.now()}`);
        }

        payload = {
          ...payload,
          legal_full_name: indForm.legalFullName || null,
          national_id: indForm.nationalId || null,
          birth_date: indForm.birthDate || null,
          city: indForm.city || null,
          email: indForm.email || null,
          document_front_url: docFrontUrl ?? null,
          document_back_url: docBackUrl ?? null,
          selfie_url: selfieUrl ?? null,
          business_name: null,
          business_registration: null,
        };
      } else {
        let crDocUrl = compDocPreview;
        if (compDoc) {
          crDocUrl = await uploadFile(compDoc, "verification-documents", `${user.id}/cr-doc-${Date.now()}`);
        }

        payload = {
          ...payload,
          legal_full_name: compForm.representativeName || null,
          national_id: null,
          birth_date: null,
          city: compForm.city || null,
          email: compForm.email || null,
          document_front_url: crDocUrl ?? null,
          document_back_url: null,
          selfie_url: null,
          business_name: compForm.businessName || null,
          business_registration: compForm.businessRegistration || null,
        };
      }

      const { error } = await supabase
        .from("account_verification_requests")
        .upsert(payload, { onConflict: "user_id" });

      if (error) {
        setServerError(error.message);
      } else if (asDraft) {
        setSaveDraftSuccess(true);
        setTimeout(() => setSaveDraftSuccess(false), 4000);
      } else {
        setSubmitSuccess(true);
        // Refresh to show new status
        const { data: updated } = await supabase
          .from("account_verification_requests")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        if (updated) setExisting(updated as VerificationRequest);
      }
    } catch {
      setServerError(language === "ar" ? "حدث خطأ. يرجى المحاولة مرة أخرى." : "An error occurred. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const profileLink = `/${language}/profile`;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i} className="h-24 animate-pulse bg-slate-100" />
        ))}
      </div>
    );
  }

  // Already verified
  if (existing?.status === "verified") {
    return (
      <Card>
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold text-emerald-700">
              {t("profile.verificationFlow.statusBanner.verified")}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {t("profile.verificationFlow.status.verified")}
            </p>
          </div>
          <Link href={profileLink} className="text-sm text-brand hover:underline">
            {language === "ar" ? "العودة للملف الشخصي" : "Back to profile"}
          </Link>
        </div>
      </Card>
    );
  }

  // Pending or additional_info_required — show read-only status + allow update if additional_info
  const isPendingLocked = existing?.status === "pending";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href={profileLink} className="hover:text-brand">
            {t("profile.pageTitle")}
          </Link>
          <span>{isRtl ? "‹" : "›"}</span>
          <span className="text-slate-700 font-medium">{t("profile.verificationFlow.title")}</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{t("profile.verificationFlow.title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("profile.verificationFlow.subtitle")}</p>
      </div>

      {/* Status banners */}
      {existing?.status === "pending" && (
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 border border-amber-200">
          <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{t("profile.verificationFlow.statusBanner.pending")}</span>
        </div>
      )}

      {existing?.status === "additional_info_required" && (
        <div className="flex items-start gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800 border border-blue-200">
          <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{t("profile.verificationFlow.statusBanner.additional_info_required")}</span>
        </div>
      )}

      {existing?.status === "rejected" && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 border border-red-200 space-y-1">
          <p className="font-semibold">{t("profile.verificationFlow.statusBanner.rejected")}</p>
          {existing.rejection_reason && (
            <p>
              <span className="font-medium">{t("profile.verificationFlow.rejectionReason")}:</span>{" "}
              {existing.rejection_reason}
            </p>
          )}
        </div>
      )}

      {/* Success messages */}
      {submitSuccess && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 border border-emerald-200">
          {t("profile.verificationFlow.submitSuccess")}
        </div>
      )}
      {saveDraftSuccess && (
        <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800 border border-blue-200">
          {t("profile.verificationFlow.saveDraftSuccess")}
        </div>
      )}

      {/* Type selector */}
      {!selectedType ? (
        <Card>
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-base font-bold text-slate-800">
                {t("profile.verificationFlow.typeSelector.title")}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {t("profile.verificationFlow.typeSelector.subtitle")}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                onClick={() => setSelectedType("individual")}
                className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50 p-6 text-center transition hover:border-brand hover:bg-brand/5 focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand text-3xl">
                  🧑
                </div>
                <div>
                  <p className="font-bold text-slate-800 group-hover:text-brand">
                    {t("profile.verificationFlow.typeSelector.individualTitle")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t("profile.verificationFlow.typeSelector.individualDesc")}
                  </p>
                </div>
              </button>

              <button
                onClick={() => setSelectedType("company")}
                className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50 p-6 text-center transition hover:border-brand hover:bg-brand/5 focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand text-3xl">
                  🏢
                </div>
                <div>
                  <p className="font-bold text-slate-800 group-hover:text-brand">
                    {t("profile.verificationFlow.typeSelector.companyTitle")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t("profile.verificationFlow.typeSelector.companyDesc")}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Type badge + change */}
          <div className="flex items-center justify-between rounded-xl bg-brand/5 border border-brand/20 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-brand">
              <span>{selectedType === "individual" ? "🧑" : "🏢"}</span>
              <span>
                {selectedType === "individual"
                  ? t("profile.verificationFlow.typeSelector.individualTitle")
                  : t("profile.verificationFlow.typeSelector.companyTitle")}
              </span>
            </div>
            {!isPendingLocked && (
              <button
                onClick={() => setSelectedType(null)}
                className="text-xs text-slate-500 hover:text-brand hover:underline"
              >
                {t("profile.verificationFlow.typeSelector.changeType")}
              </button>
            )}
          </div>

          {/* Individual form */}
          {selectedType === "individual" && (
            <IndividualForm
              form={indForm}
              onChange={setIndForm}
              docFrontFile={indDocFront}
              docFrontPreview={indDocFrontPreview}
              onDocFrontChange={setIndDocFront}
              docBackFile={indDocBack}
              docBackPreview={indDocBackPreview}
              onDocBackChange={setIndDocBack}
              selfieFile={indSelfie}
              selfiePreview={indSelfiePreview}
              onSelfieChange={setIndSelfie}
              errors={formErrors}
              lang={language}
              locked={isPendingLocked}
            />
          )}

          {/* Company form */}
          {selectedType === "company" && (
            <CompanyForm
              form={compForm}
              onChange={setCompForm}
              crDocFile={compDoc}
              crDocPreview={compDocPreview}
              onCrDocChange={setCompDoc}
              errors={formErrors}
              lang={language}
              locked={isPendingLocked}
            />
          )}

          {serverError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{serverError}</p>
          )}

          {!isPendingLocked && (
            <div className={`flex gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <button
                onClick={() => handleSubmit(false)}
                disabled={saving}
                className="flex-1 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand/90 disabled:opacity-60"
              >
                {saving
                  ? (language === "ar" ? "جارٍ الإرسال..." : "Submitting...")
                  : t("profile.verificationFlow.submit")}
              </button>
              <button
                onClick={() => handleSubmit(true)}
                disabled={saving}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {t("profile.verificationFlow.saveDraft")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Individual Form ───────────────────────────────────────────────────────────

type IndividualFormProps = {
  form: IndividualFormData;
  onChange: (f: IndividualFormData) => void;
  docFrontFile: File | null;
  docFrontPreview: string | null;
  onDocFrontChange: (f: File | null) => void;
  docBackFile: File | null;
  docBackPreview: string | null;
  onDocBackChange: (f: File | null) => void;
  selfieFile: File | null;
  selfiePreview: string | null;
  onSelfieChange: (f: File | null) => void;
  errors: FormErrors;
  lang: string;
  locked: boolean;
};

function IndividualForm({
  form,
  onChange,
  docFrontFile,
  docFrontPreview,
  onDocFrontChange,
  docBackFile,
  docBackPreview,
  onDocBackChange,
  selfieFile,
  selfiePreview,
  onSelfieChange,
  errors,
  lang,
  locked,
}: IndividualFormProps) {
  const { t } = useTranslation();
  const v = t("profile.verificationFlow", { returnObjects: true }) as Record<string, unknown>;
  const fields = v.fields as Record<string, string>;
  const reasons = v.reasons as Record<string, string>;
  const sections = (v.sections as Record<string, string>) ?? {};
  const hint = t("profile.verificationFlow.documentUploadHint");

  function set(key: keyof IndividualFormData, value: string) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div className="space-y-5">
      {/* Personal info */}
      <Card>
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">
          {sections.personalInfo ?? (lang === "ar" ? "المعلومات الشخصية" : "Personal Information")}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={fields.legalName}
            id="legalFullName"
            value={form.legalFullName}
            onChange={(v) => set("legalFullName", v)}
            error={errors.legalFullName}
            required
            disabled={locked}
          />
          <FormField
            label={fields.nationalId}
            id="nationalId"
            value={form.nationalId}
            onChange={(v) => set("nationalId", v)}
            error={errors.nationalId}
            required
            disabled={locked}
          />
          <FormField
            label={fields.birthDate}
            id="birthDate"
            type="date"
            value={form.birthDate}
            onChange={(v) => set("birthDate", v)}
            error={errors.birthDate}
            required
            disabled={locked}
          />
          <FormField
            label={fields.city}
            id="city"
            value={form.city}
            onChange={(v) => set("city", v)}
            disabled={locked}
          />
          <FormField
            label={fields.email}
            id="email"
            type="email"
            value={form.email}
            onChange={(v) => set("email", v)}
            disabled={locked}
          />
        </div>
      </Card>

      {/* Documents */}
      <Card>
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">
          {sections.identityDocs ?? (lang === "ar" ? "وثائق الهوية" : "Identity Documents")}
        </h3>
        <div className="space-y-5">
          <DocumentUploadField
            id="docFront"
            label={fields.documentFront}
            hint={hint}
            reason={reasons.documentFront}
            value={docFrontFile?.name ?? null}
            previewUrl={docFrontPreview}
            onChange={locked ? () => {} : onDocFrontChange}
            error={errors.documentFront}
            lang={lang}
          />
          <DocumentUploadField
            id="docBack"
            label={fields.documentBack}
            hint={hint}
            reason={reasons.documentBack}
            value={docBackFile?.name ?? null}
            previewUrl={docBackPreview}
            onChange={locked ? () => {} : onDocBackChange}
            lang={lang}
          />
          <DocumentUploadField
            id="selfie"
            label={fields.selfie}
            hint={hint}
            reason={reasons.selfie}
            value={selfieFile?.name ?? null}
            previewUrl={selfiePreview}
            onChange={locked ? () => {} : onSelfieChange}
            lang={lang}
          />
        </div>
      </Card>
    </div>
  );
}

// ─── Company Form ──────────────────────────────────────────────────────────────

type CompanyFormProps = {
  form: CompanyFormData;
  onChange: (f: CompanyFormData) => void;
  crDocFile: File | null;
  crDocPreview: string | null;
  onCrDocChange: (f: File | null) => void;
  errors: FormErrors;
  lang: string;
  locked: boolean;
};

function CompanyForm({
  form,
  onChange,
  crDocFile,
  crDocPreview,
  onCrDocChange,
  errors,
  lang,
  locked,
}: CompanyFormProps) {
  const { t } = useTranslation();
  const v = t("profile.verificationFlow", { returnObjects: true }) as Record<string, unknown>;
  const fields = v.fields as Record<string, string>;
  const reasons = v.reasons as Record<string, string>;
  const sections = (v.sections as Record<string, string>) ?? {};
  const companyFields = (v.companyFields as Record<string, unknown>) ?? {};
  const businessTypeOptions = (companyFields.businessTypeOptions as Record<string, string>) ?? {};
  const hint = t("profile.verificationFlow.documentUploadHint");

  function set(key: keyof CompanyFormData, value: string) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div className="space-y-5">
      {/* Company info */}
      <Card>
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">
          {sections.companyInfo ?? (lang === "ar" ? "بيانات الشركة" : "Company Information")}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={String(companyFields.representativeName ?? (lang === "ar" ? "اسم المفوَّض" : "Representative"))}
            id="representativeName"
            value={form.representativeName}
            onChange={(v) => set("representativeName", v)}
            error={errors.representativeName}
            required
            disabled={locked}
          />
          <FormField
            label={fields.businessName}
            id="businessName"
            value={form.businessName}
            onChange={(v) => set("businessName", v)}
            error={errors.businessName}
            required
            disabled={locked}
          />
          <FormField
            label={fields.businessRegistration}
            id="businessRegistration"
            value={form.businessRegistration}
            onChange={(v) => set("businessRegistration", v)}
            error={errors.businessRegistration}
            required
            disabled={locked}
          />
          {/* Business type */}
          <div className="space-y-1.5">
            <label htmlFor="businessType" className="block text-sm font-medium text-slate-700">
              {String(companyFields.businessType ?? (lang === "ar" ? "نوع النشاط" : "Business Type"))}
            </label>
            <select
              id="businessType"
              value={form.businessType}
              onChange={(e) => set("businessType", e.target.value)}
              disabled={locked}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:bg-slate-50 disabled:text-slate-400"
            >
              {BUSINESS_TYPES.map((bt) => (
                <option key={bt} value={bt}>
                  {businessTypeOptions[bt] ?? bt}
                </option>
              ))}
            </select>
          </div>
          <FormField
            label={String(companyFields.taxNumber ?? (lang === "ar" ? "الرقم الضريبي (اختياري)" : "Tax Number (optional)"))}
            id="taxNumber"
            value={form.taxNumber}
            onChange={(v) => set("taxNumber", v)}
            disabled={locked}
          />
          <FormField
            label={fields.city}
            id="companyCity"
            value={form.city}
            onChange={(v) => set("city", v)}
            disabled={locked}
          />
          <FormField
            label={fields.email}
            id="companyEmail"
            type="email"
            value={form.email}
            onChange={(v) => set("email", v)}
            disabled={locked}
          />
          <FormField
            label={String(companyFields.website ?? (lang === "ar" ? "الموقع الإلكتروني (اختياري)" : "Website (optional)"))}
            id="website"
            type="url"
            value={form.website}
            onChange={(v) => set("website", v)}
            disabled={locked}
          />
        </div>
        {/* Description */}
        <div className="mt-4 space-y-1.5">
          <label htmlFor="description" className="block text-sm font-medium text-slate-700">
            {String(companyFields.description ?? (lang === "ar" ? "نبذة عن الشركة" : "Company description"))}
          </label>
          <textarea
            id="description"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            disabled={locked}
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:bg-slate-50 disabled:text-slate-400 resize-none"
          />
        </div>
      </Card>

      {/* CR document */}
      <Card>
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">
          {sections.companyDocs ?? (lang === "ar" ? "وثيقة السجل التجاري" : "Commercial Registration Document")}
        </h3>
        <DocumentUploadField
          id="crDoc"
          label={lang === "ar" ? "صورة السجل التجاري" : "Commercial Registration Document"}
          hint={hint}
          reason={reasons.businessRegistration}
          value={crDocFile?.name ?? null}
          previewUrl={crDocPreview}
          onChange={locked ? () => {} : onCrDocChange}
          error={errors.companyDoc}
          lang={lang}
        />
      </Card>
    </div>
  );
}

// ─── Shared input field ────────────────────────────────────────────────────────

type FormFieldProps = {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
};

function FormField({ label, id, type = "text", value, onChange, error, required, disabled }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full rounded-xl border px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 disabled:bg-slate-50 disabled:text-slate-400 ${
          error
            ? "border-red-300 bg-red-50 text-red-800 focus:border-red-400 focus:ring-red-300"
            : "border-slate-200 bg-white text-slate-700 focus:border-brand focus:ring-brand"
        }`}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
