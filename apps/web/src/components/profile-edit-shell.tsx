"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { OTP_LENGTH, createUsernameSuggestions, isValidPhoneNumber, LISTING_IMAGES_BUCKET, normalizePhoneNumber, validateUsername } from "@sanany/shared";
import { Card } from "@sanany/ui";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { RequireAuth } from "../auth/guards";
import { getWebSupabaseClient } from "../lib/supabase-client";

type ProfileEditShellProps = {
  language: string;
};

type UsernameState = {
  checking: boolean;
  isAvailable: boolean;
  errorKey: string | null;
  suggestions: string[];
};

type AvatarEditorState = {
  source: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
};

function getFileExtension(file: File): string {
  const fromName = file.name.split(".").pop()?.trim().toLowerCase();
  if (fromName) return fromName;
  if (file.type.includes("png")) return "png";
  if (file.type.includes("webp")) return "webp";
  return "jpg";
}

function normalizeWebsite(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(normalized);
    if (!parsed.hostname) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function mapUsernameReasonToErrorKey(reason: "empty" | "invalid" | "taken" | "available"): string | null {
  if (reason === "taken") return "profile.edit.errors.usernameTaken";
  if (reason === "invalid") return "profile.edit.errors.usernameInvalid";
  return null;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read-failed"));
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("invalid-image"));
    };
    reader.readAsDataURL(file);
  });
}

async function buildAvatarBlob(editor: AvatarEditorState): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new window.Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("image-load-failed"));
    nextImage.src = editor.source;
  });

  const canvasSize = 768;
  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("canvas-context-missing");
  }

  const minSide = Math.min(image.width, image.height);
  const cropSize = minSide / editor.zoom;
  const maxOffset = (minSide - cropSize) / 2;
  const clampedX = Math.max(-1, Math.min(1, editor.offsetX));
  const clampedY = Math.max(-1, Math.min(1, editor.offsetY));
  const centerX = image.width / 2 + clampedX * maxOffset;
  const centerY = image.height / 2 + clampedY * maxOffset;
  const sx = Math.max(0, Math.min(image.width - cropSize, centerX - cropSize / 2));
  const sy = Math.max(0, Math.min(image.height - cropSize, centerY - cropSize / 2));

  context.drawImage(image, sx, sy, cropSize, cropSize, 0, 0, canvasSize, canvasSize);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("avatar-render-failed"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.9
    );
  });
}

export function ProfileEditShell({ language }: ProfileEditShellProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const {
    accountProfile,
    checkUsernameAvailability,
    refreshAccountProfile,
    requestPhoneOtp,
    snapshot,
    updateOptionalProfile,
    verifyPhoneOtp
  } = useAuth();

  const [displayName, setDisplayName] = useState(accountProfile?.displayName ?? "");
  const [username, setUsername] = useState(accountProfile?.username ?? "");
  const [bio, setBio] = useState(accountProfile?.bio ?? "");
  const [website, setWebsite] = useState(accountProfile?.website ?? "");
  const [phone, setPhone] = useState(accountProfile?.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(accountProfile?.avatarUrl ?? null);
  const [avatarEditor, setAvatarEditor] = useState<AvatarEditorState | null>(null);
  const [avatarFileName, setAvatarFileName] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [isOtpSending, setIsOtpSending] = useState(false);
  const [isOtpVerifying, setIsOtpVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [usernameState, setUsernameState] = useState<UsernameState>({
    checking: false,
    isAvailable: false,
    errorKey: null,
    suggestions: []
  });

  useEffect(() => {
    if (!accountProfile) {
      return;
    }
    setDisplayName(accountProfile.displayName ?? "");
    setUsername(accountProfile.username ?? "");
    setBio(accountProfile.bio ?? "");
    setWebsite(accountProfile.website ?? "");
    setPhone(accountProfile.phone ?? "");
    setAvatarUrl(accountProfile.avatarUrl ?? null);
  }, [accountProfile]);

  const initialPhone = useMemo(() => normalizePhoneNumber(accountProfile?.phone ?? ""), [accountProfile?.phone]);
  const normalizedCurrentPhone = useMemo(() => normalizePhoneNumber(phone), [phone]);
  const isPhoneChanged = normalizedCurrentPhone !== initialPhone;
  const bioRemaining = 160 - bio.length;

  useEffect(() => {
    const nextUsername = username.trim().toLowerCase();
    if (!nextUsername) {
      setUsernameState({ checking: false, isAvailable: false, errorKey: null, suggestions: [] });
      return;
    }

    const localValidation = validateUsername(nextUsername);
    if (!localValidation.isValid) {
      setUsernameState({
        checking: false,
        isAvailable: false,
        errorKey: localValidation.errorKey,
        suggestions: createUsernameSuggestions(displayName, nextUsername)
      });
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      setUsernameState((current) => ({ ...current, checking: true }));
      void checkUsernameAvailability(nextUsername, displayName)
        .then((availability) => {
          if (!active) return;
          setUsernameState({
            checking: false,
            isAvailable: availability.isAvailable,
            errorKey: mapUsernameReasonToErrorKey(availability.reason),
            suggestions: availability.suggestions
          });
        })
        .catch(() => {
          if (!active) return;
          setUsernameState({
            checking: false,
            isAvailable: false,
            errorKey: "profile.edit.errors.usernameCheckFailed",
            suggestions: []
          });
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [checkUsernameAvailability, displayName, username]);

  useEffect(() => {
    if (!isPhoneChanged) {
      setOtpSent(false);
      setOtpCode("");
      setPhoneVerified(false);
    }
  }, [isPhoneChanged]);

  const onAvatarInput = useCallback(async (file: File | null) => {
    if (!file) {
      return;
    }
    try {
      const source = await fileToDataUrl(file);
      setAvatarFileName(file.name || null);
      setAvatarEditor({ source, zoom: 1, offsetX: 0, offsetY: 0 });
      setErrorKey(null);
    } catch {
      setErrorKey("profile.edit.errors.imagePickFailed");
    }
  }, []);

  const applyAvatarEditor = useCallback(async () => {
    if (!snapshot.user?.id || !avatarEditor) {
      setErrorKey("profile.edit.errors.saveFailed");
      return;
    }
    setIsAvatarUploading(true);
    setErrorKey(null);
    try {
      const blob = await buildAvatarBlob(avatarEditor);
      const extension = avatarFileName ? getFileExtension(new File([blob], avatarFileName, { type: blob.type })) : "jpg";
      const storagePath = `${snapshot.user.id}/profile/avatar-${Date.now()}.${extension}`;
      const uploadResult = await getWebSupabaseClient().storage.from(LISTING_IMAGES_BUCKET).upload(storagePath, blob, {
        upsert: true,
        contentType: blob.type || "image/jpeg",
        cacheControl: "3600"
      });
      if (uploadResult.error) {
        throw uploadResult.error;
      }
      const { data } = getWebSupabaseClient().storage.from(LISTING_IMAGES_BUCKET).getPublicUrl(storagePath);
      setAvatarUrl(data.publicUrl);
      setAvatarEditor(null);
    } catch {
      setErrorKey("profile.edit.errors.imageUploadFailed");
    } finally {
      setIsAvatarUploading(false);
    }
  }, [avatarEditor, avatarFileName, snapshot.user?.id]);

  const sendPhoneOtp = useCallback(async () => {
    if (!isValidPhoneNumber(normalizedCurrentPhone)) {
      setErrorKey("profile.edit.errors.phoneInvalid");
      return;
    }
    setIsOtpSending(true);
    setErrorKey(null);
    try {
      await requestPhoneOtp({ phone: normalizedCurrentPhone });
      setOtpSent(true);
    } catch {
      setErrorKey("profile.edit.errors.phoneOtpSendFailed");
    } finally {
      setIsOtpSending(false);
    }
  }, [normalizedCurrentPhone, requestPhoneOtp]);

  const verifyPhoneChangeOtp = useCallback(async () => {
    if (otpCode.length !== OTP_LENGTH) {
      setErrorKey("profile.edit.errors.phoneOtpRequired");
      return;
    }
    setIsOtpVerifying(true);
    setErrorKey(null);
    try {
      await verifyPhoneOtp({ phone: normalizedCurrentPhone, token: otpCode });
      setPhoneVerified(true);
    } catch {
      setErrorKey("profile.edit.errors.phoneOtpVerifyFailed");
    } finally {
      setIsOtpVerifying(false);
    }
  }, [normalizedCurrentPhone, otpCode, verifyPhoneOtp]);

  const onSave = useCallback(async () => {
    setErrorKey(null);

    if (!displayName.trim()) {
      setErrorKey("profile.edit.errors.displayNameRequired");
      return;
    }
    if (displayName.trim().length > 50) {
      setErrorKey("profile.edit.errors.displayNameTooLong");
      return;
    }
    if (!username.trim()) {
      setErrorKey("profile.edit.errors.usernameRequired");
      return;
    }
    if (bio.length > 160) {
      setErrorKey("profile.edit.errors.bioTooLong");
      return;
    }

    const websiteNormalized = normalizeWebsite(website);
    if (website.trim() && !websiteNormalized) {
      setErrorKey("profile.edit.errors.websiteInvalid");
      return;
    }

    if (isPhoneChanged) {
      if (!isValidPhoneNumber(normalizedCurrentPhone)) {
        setErrorKey("profile.edit.errors.phoneInvalid");
        return;
      }
      if (!phoneVerified) {
        setErrorKey("profile.edit.errors.phoneVerificationRequired");
        return;
      }
    }

    if (usernameState.errorKey) {
      setErrorKey(usernameState.errorKey);
      return;
    }

    setIsSaving(true);
    try {
      const availability = await checkUsernameAvailability(username, displayName);
      if (!availability.isAvailable) {
        setErrorKey(mapUsernameReasonToErrorKey(availability.reason) ?? "profile.edit.errors.usernameInvalid");
        return;
      }

      await updateOptionalProfile({
        displayName: displayName.trim(),
        username: username.trim().toLowerCase(),
        avatarUrl,
        bio: bio.trim() ? bio.trim() : null,
        website: websiteNormalized ?? null,
        phone: normalizedCurrentPhone
      });
      await refreshAccountProfile();
      setShowSuccess(true);
      setTimeout(() => {
        router.push(`/${resolvedLanguage}/profile?saved=1`);
      }, 550);
    } catch {
      setErrorKey("profile.edit.errors.saveFailed");
    } finally {
      setIsSaving(false);
    }
  }, [
    avatarUrl,
    bio,
    checkUsernameAvailability,
    displayName,
    isPhoneChanged,
    normalizedCurrentPhone,
    phoneVerified,
    refreshAccountProfile,
    resolvedLanguage,
    router,
    updateOptionalProfile,
    username,
    usernameState.errorKey,
    website
  ]);

  const isBusy = isSaving || isAvatarUploading || usernameState.checking;

  return (
    <RequireAuth language={resolvedLanguage}>
      <div dir={resolvedLanguage === "ar" ? "rtl" : "ltr"} className="mx-auto w-full max-w-4xl space-y-5">
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-slate-900">{t("profile.edit.title")}</h1>
              <p className="text-sm text-slate-600">{t("profile.dashboard.editPageSubtitle")}</p>
            </div>
            <Link href={`/${resolvedLanguage}/profile`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              {t("profile.edit.cancelAction")}
            </Link>
          </div>
        </Card>

        <Card className="space-y-5">
          <div className="space-y-3">
            <div className="relative h-28 w-28 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
              {avatarUrl ? (
                <Image src={avatarUrl} alt={t("profile.edit.title")} fill className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-100 via-cyan-50 to-slate-100 text-3xl font-bold text-slate-500">
                  {(displayName || t("profile.accountNameFallback")).slice(0, 1)}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                {t("profile.edit.photoActions.gallery")}
                <input type="file" accept="image/*" className="hidden" onChange={(event) => void onAvatarInput(event.target.files?.[0] ?? null)} />
              </label>
              <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                {t("profile.edit.photoActions.camera")}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => void onAvatarInput(event.target.files?.[0] ?? null)} />
              </label>
              <button type="button" onClick={() => setAvatarUrl(null)} className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {t("profile.edit.photoActions.remove")}
              </button>
            </div>
            <p className="text-xs text-slate-500">{t("profile.edit.photoCropHint")}</p>
          </div>

          {avatarEditor ? (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">{t("profile.dashboard.avatarEditor.title")}</p>
              <div className="relative h-64 w-64 overflow-hidden rounded-full border border-slate-300 bg-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarEditor.source}
                  alt={t("profile.edit.title")}
                  className="h-full w-full select-none object-cover"
                  style={{
                    transform: `scale(${avatarEditor.zoom}) translate(${avatarEditor.offsetX * 38}px, ${avatarEditor.offsetY * 38}px)`
                  }}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1 text-xs text-slate-600">
                  <span>{t("profile.dashboard.avatarEditor.zoom")}</span>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.05}
                    value={avatarEditor.zoom}
                    onChange={(event) => setAvatarEditor((current) => (current ? { ...current, zoom: Number(event.target.value) } : current))}
                    className="w-full"
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-600">
                  <span>{t("profile.dashboard.avatarEditor.positionX")}</span>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={avatarEditor.offsetX}
                    onChange={(event) => setAvatarEditor((current) => (current ? { ...current, offsetX: Number(event.target.value) } : current))}
                    className="w-full"
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-600">
                  <span>{t("profile.dashboard.avatarEditor.positionY")}</span>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={avatarEditor.offsetY}
                    onChange={(event) => setAvatarEditor((current) => (current ? { ...current, offsetY: Number(event.target.value) } : current))}
                    className="w-full"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void applyAvatarEditor()}
                  disabled={isAvatarUploading}
                  className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {t("profile.dashboard.avatarEditor.apply")}
                </button>
                <button
                  type="button"
                  onClick={() => setAvatarEditor((current) => (current ? { ...current, zoom: 1, offsetX: 0, offsetY: 0 } : current))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  {t("profile.dashboard.avatarEditor.reset")}
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">{t("profile.edit.fields.displayName")}</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={50}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
              />
              <span className="text-xs text-slate-500">{t("profile.edit.displayNameLimit", { value: Math.max(0, 50 - displayName.length) })}</span>
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-slate-600">{t("profile.edit.fields.username")}</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                maxLength={30}
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
              />
              {usernameState.checking ? <span className="text-xs text-slate-500">{t("profile.edit.usernameChecking")}</span> : null}
              {!usernameState.checking && usernameState.isAvailable ? <span className="text-xs font-semibold text-emerald-700">✓ {t("profile.edit.usernameAvailable")}</span> : null}
              {!usernameState.checking && usernameState.errorKey ? <span className="text-xs text-rose-600">{t(usernameState.errorKey)}</span> : null}
              {usernameState.suggestions.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">{t("profile.edit.usernameSuggestions")}</span>
                  {usernameState.suggestions.map((item) => (
                    <button key={item} type="button" onClick={() => setUsername(item)} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-700">
                      @{item}
                    </button>
                  ))}
                </div>
              ) : null}
            </label>

            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-slate-600">{t("profile.edit.fields.bio")}</span>
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                maxLength={160}
                rows={4}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
              />
              <span className="text-xs text-slate-500">{t("profile.edit.bioRemaining", { value: Math.max(0, bioRemaining) })}</span>
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-slate-600">{t("profile.edit.fields.website")}</span>
              <input
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                autoCapitalize="none"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
              />
              <span className="text-xs text-slate-500">{t("profile.edit.websiteHint")}</span>
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-slate-600">{t("profile.edit.fields.phone")}</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
              />
            </label>
          </div>

          {isPhoneChanged ? (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-600">{t("profile.edit.phoneOtpHint")}</p>
              {!otpSent ? (
                <button
                  type="button"
                  onClick={() => void sendPhoneOtp()}
                  disabled={isOtpSending}
                  className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {t("profile.edit.phoneActions.sendOtp")}
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))}
                    maxLength={OTP_LENGTH}
                    inputMode="numeric"
                    className="w-44 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
                  />
                  <button
                    type="button"
                    onClick={() => void verifyPhoneChangeOtp()}
                    disabled={isOtpVerifying || phoneVerified}
                    className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {t("profile.edit.phoneActions.verifyOtp")}
                  </button>
                </div>
              )}
              {phoneVerified ? <p className="text-xs font-semibold text-emerald-700">✓ {t("profile.edit.phoneVerified")}</p> : null}
            </div>
          ) : null}

          {errorKey ? <p className="text-sm font-medium text-rose-600">{t(errorKey)}</p> : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={isBusy}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isSaving ? t("common.loading") : t("profile.edit.saveAction")}
            </button>
            <Link href={`/${resolvedLanguage}/profile`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              {t("profile.edit.cancelAction")}
            </Link>
          </div>
        </Card>

        {showSuccess ? (
          <Card>
            <p className="text-sm font-semibold text-emerald-700">{t("profile.edit.success")}</p>
          </Card>
        ) : null}
      </div>
    </RequireAuth>
  );
}

