"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { createAccountRepository } from "@sanany/api";
import type { AccountVerificationRequest, MarketplaceListing, PaginatedResult, SellerProfile } from "@sanany/types";
import {
  FAVORITES_STORAGE_KEY,
  getProfileCompletionPercentage,
  parseStoredIdList,
  parseNotificationPreferences,
  PROFILE_LISTING_VIEWS,
  serializeNotificationPreferences,
  toListingStatusFilterForProfileView,
  type NotificationPreferences,
  type ProfileListingView
} from "@sanany/shared";
import { Card } from "@sanany/ui";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { RequireAuth } from "../auth/guards";
import { getWebListingsRepository } from "../lib/listings-repository";
import { getWebSellersRepository } from "../lib/sellers-repository";
import { getWebSupabaseClient } from "../lib/supabase-client";
import { ListingCard } from "./listing-card";

type ProfileShellProps = {
  language: string;
};

type ProfileSectionId =
  | "overview"
  | ProfileListingView
  | "settings-account"
  | "settings-company"
  | "settings-privacy"
  | "settings-notifications"
  | "settings-language"
  | "settings-password"
  | "settings-blocked"
  | "settings-verification"
  | "settings-delete";

type ProfileFormState = {
  displayName: string;
  bio: string;
  city: string;
  phone: string;
  birthDate: string;
  gender: string;
  preferredContactMethod: string;
};

type ProfileStatsState = {
  active: number;
  drafts: number;
  sold: number;
  expired: number;
  favorites: number;
};

const LISTING_PAGE_SIZE = 12;
const NOTIFICATION_SETTINGS_KEY = "sanany.notification.preferences";

function getInitialForm(profile: SellerProfile | null): ProfileFormState {
  return {
    displayName: profile?.displayName ?? "",
    bio: profile?.bio ?? "",
    city: profile?.city ?? "",
    phone: profile?.phone ?? "",
    birthDate: "",
    gender: "",
    preferredContactMethod: ""
  };
}

function updateLanguagePath(pathname: string, nextLanguage: string): string {
  const segments = pathname.split("/");
  if (segments.length > 1) {
    segments[1] = nextLanguage;
  }
  return segments.join("/") || `/${nextLanguage}`;
}

export function ProfileShell({ language }: ProfileShellProps) {
  const { t, i18n } = useTranslation();
  const { accountProfile, refreshAccountProfile, requestPasswordReset, signOut, snapshot, updateOptionalProfile } = useAuth();
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const listingsRepository = useMemo(() => getWebListingsRepository(), []);
  const sellersRepository = useMemo(() => getWebSellersRepository(), []);
  const accountRepository = useMemo(() => createAccountRepository(getWebSupabaseClient()), []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [section, setSection] = useState<ProfileSectionId>("overview");
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(getInitialForm(null));
  const [showPhone, setShowPhone] = useState(true);
  const [showLastSeen, setShowLastSeen] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(() =>
    parseNotificationPreferences(null)
  );
  const [stats, setStats] = useState<ProfileStatsState>({
    active: 0,
    drafts: 0,
    sold: 0,
    expired: 0,
    favorites: 0
  });
  const [listingsPage, setListingsPage] = useState(1);
  const [listingsData, setListingsData] = useState<PaginatedResult<MarketplaceListing>>({
    items: [],
    totalItems: 0,
    page: 1,
    pageSize: LISTING_PAGE_SIZE,
    totalPages: 1
  });
  const [favoritesData, setFavoritesData] = useState<MarketplaceListing[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingSection, setIsLoadingSection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [verificationRequest, setVerificationRequest] = useState<AccountVerificationRequest | null>(null);
  const [verificationForm, setVerificationForm] = useState({
    legalFullName: "",
    nationalId: "",
    birthDate: "",
    city: "",
    email: "",
    documentFrontUrl: "",
    documentBackUrl: "",
    selfieUrl: "",
    businessName: "",
    businessRegistration: ""
  });

  useEffect(() => {
    const sectionParam = searchParams.get("section");
    const validSections: ProfileSectionId[] = [
      "overview",
      ...PROFILE_LISTING_VIEWS,
      "settings-account",
      "settings-company",
      "settings-privacy",
      "settings-notifications",
      "settings-language",
      "settings-password",
      "settings-blocked",
      "settings-verification",
      "settings-delete"
    ];
    if (sectionParam && validSections.includes(sectionParam as ProfileSectionId)) {
      setSection(sectionParam as ProfileSectionId);
      return;
    }
    setSection("overview");
  }, [searchParams]);

  useEffect(() => {
    setListingsPage(1);
  }, [section]);

  useEffect(() => {
    const raw = window.localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    setNotificationPreferences(parseNotificationPreferences(raw));
  }, []);

  useEffect(() => {
    if (!accountProfile) {
      return;
    }

    setProfileForm({
      displayName: accountProfile.displayName ?? "",
      bio: accountProfile.bio ?? "",
      city: accountProfile.city ?? "",
      phone: accountProfile.phone ?? "",
      birthDate: accountProfile.birthDate ?? "",
      gender: accountProfile.gender ?? "",
      preferredContactMethod: accountProfile.preferredContactMethod ?? ""
    });
  }, [accountProfile]);

  useEffect(() => {
    const userId = snapshot.user?.id;
    if (!userId) {
      return;
    }

    let active = true;
    setIsLoadingProfile(true);
    setErrorMessage(null);

    const load = async () => {
      const favoriteIds = parseStoredIdList(window.localStorage.getItem(FAVORITES_STORAGE_KEY));
      const [profileResult, activeResult, draftsResult, soldResult, expiredResult] = await Promise.all([
        sellersRepository.getProfile(userId, userId),
        listingsRepository.listByOwner(userId, { search: "", status: "available", sort: "newest", page: 1, pageSize: 1 }),
        listingsRepository.listByOwner(userId, { search: "", status: "draft", sort: "newest", page: 1, pageSize: 1 }),
        listingsRepository.listByOwner(userId, { search: "", status: "reserved", sort: "newest", page: 1, pageSize: 1 }),
        listingsRepository.listByOwner(userId, { search: "", status: "inactive", sort: "newest", page: 1, pageSize: 1 })
      ]);

      if (!active) {
        return;
      }

      setProfile(profileResult);
      setProfileForm(getInitialForm(profileResult));
      setShowPhone(profileResult?.canShowPhone ?? true);
      setShowLastSeen(profileResult?.canShowLastSeen ?? false);
      setStats({
        active: activeResult.totalItems,
        drafts: draftsResult.totalItems,
        sold: soldResult.totalItems,
        expired: expiredResult.totalItems,
        favorites: favoriteIds.length
      });
    };

    void load()
      .catch((requestError) => {
        if (active) {
          setErrorMessage(requestError instanceof Error ? requestError.message : t("profile.errorLoad"));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingProfile(false);
        }
      });

    return () => {
      active = false;
    };
  }, [listingsRepository, sellersRepository, snapshot.user?.id, t]);

  useEffect(() => {
    const userId = snapshot.user?.id;
    if (!userId) {
      setVerificationRequest(null);
      return;
    }

    let active = true;
    void accountRepository
      .getVerificationRequest(userId)
      .then((request) => {
        if (!active) {
          return;
        }
        setVerificationRequest(request);
        setVerificationForm({
          legalFullName: request?.legalFullName ?? accountProfile?.displayName ?? "",
          nationalId: request?.nationalId ?? "",
          birthDate: request?.birthDate ?? accountProfile?.birthDate ?? "",
          city: request?.city ?? accountProfile?.city ?? "",
          email: request?.email ?? snapshot.user?.email ?? "",
          documentFrontUrl: request?.documentFrontUrl ?? "",
          documentBackUrl: request?.documentBackUrl ?? "",
          selfieUrl: request?.selfieUrl ?? "",
          businessName: request?.businessName ?? "",
          businessRegistration: request?.businessRegistration ?? ""
        });
      })
      .catch((requestError) => {
        if (active) {
          setErrorMessage(requestError instanceof Error ? requestError.message : t("profile.errorLoad"));
        }
      });

    return () => {
      active = false;
    };
  }, [accountProfile?.birthDate, accountProfile?.city, accountProfile?.displayName, accountRepository, snapshot.user?.email, snapshot.user?.id, t]);

  useEffect(() => {
    const userId = snapshot.user?.id;
    if (!userId) {
      return;
    }

    const sectionIsListing = PROFILE_LISTING_VIEWS.includes(section as ProfileListingView);
    if (!sectionIsListing) {
      return;
    }

    let active = true;
    setIsLoadingSection(true);
    setErrorMessage(null);

    const loadSection = async () => {
      if (section === "favorites") {
        const favoriteIds = parseStoredIdList(window.localStorage.getItem(FAVORITES_STORAGE_KEY));
        if (!favoriteIds.length) {
          if (active) {
            setFavoritesData([]);
          }
          return;
        }

        const listings = await Promise.all(favoriteIds.map((id) => listingsRepository.getById(id)));
        if (active) {
          setFavoritesData(listings.filter((item): item is MarketplaceListing => item !== null));
        }
        return;
      }

      const status = toListingStatusFilterForProfileView(section as ProfileListingView);
      if (!status) {
        return;
      }

      const result = await listingsRepository.listByOwner(userId, {
        search: "",
        status,
        sort: "newest",
        page: listingsPage,
        pageSize: LISTING_PAGE_SIZE
      });
      if (active) {
        setListingsData(result);
      }
    };

    void loadSection()
      .catch((requestError) => {
        if (active) {
          setErrorMessage(requestError instanceof Error ? requestError.message : t("profile.errorLoad"));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingSection(false);
        }
      });

    return () => {
      active = false;
    };
  }, [listingsPage, listingsRepository, section, snapshot.user?.id, t]);

  const setSectionWithUrl = (nextSection: ProfileSectionId) => {
    const next = new URLSearchParams(searchParams.toString());
    if (nextSection === "overview") {
      next.delete("section");
    } else {
      next.set("section", nextSection);
    }
    router.replace(next.toString().length > 0 ? `${pathname}?${next.toString()}` : pathname);
  };

  const saveProfile = async () => {
    if (!snapshot.user?.id) {
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateOptionalProfile({
        displayName: profileForm.displayName,
        bio: profileForm.bio,
        city: profileForm.city,
        phone: profileForm.phone,
        birthDate: profileForm.birthDate || null,
        gender: profileForm.gender ? (profileForm.gender as "male" | "female" | "prefer_not_to_say") : null,
        preferredContactMethod: profileForm.preferredContactMethod
          ? (profileForm.preferredContactMethod as "phone" | "chat" | "whatsapp" | "email")
          : null
      });
      await refreshAccountProfile();
      setProfile((current) =>
        current
          ? {
              ...current,
              displayName: profileForm.displayName.trim() || current.displayName,
              bio: profileForm.bio.trim() || null,
              city: profileForm.city.trim() || null,
              phone: profileForm.phone.trim() || null
            }
          : current
      );
      setSuccessMessage(t("profile.messages.profileSaved"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("auth.errors.unknown"));
      setIsSaving(false);
      return;
    }
    setIsSaving(false);
  };

  const savePrivacy = async () => {
    if (!snapshot.user?.id) {
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    const { error } = await getWebSupabaseClient()
      .from("profiles")
      .update({
        show_phone: showPhone,
        show_last_seen: showLastSeen
      })
      .eq("id", snapshot.user.id);
    if (error) {
      setErrorMessage(error.message);
      setIsSaving(false);
      return;
    }
    setProfile((current) =>
      current
        ? {
            ...current,
            canShowPhone: showPhone,
            canShowLastSeen: showLastSeen
          }
        : current
    );
    setSuccessMessage(t("profile.messages.privacySaved"));
    setIsSaving(false);
  };

  const saveNotifications = () => {
    window.localStorage.setItem(NOTIFICATION_SETTINGS_KEY, serializeNotificationPreferences(notificationPreferences));
    setSuccessMessage(t("profile.messages.notificationsSaved"));
  };

  const changeLanguage = (nextLanguage: "ar" | "en") => {
    if (nextLanguage === resolvedLanguage) {
      return;
    }
    void i18n.changeLanguage(nextLanguage);
    const targetPath = updateLanguagePath(pathname, nextLanguage);
    const query = searchParams.toString();
    router.push(query ? `${targetPath}?${query}` : targetPath);
  };

  const resetPassword = async () => {
    const email = snapshot.user?.email;
    if (!email) {
      setErrorMessage(t("profile.settings.password.missingEmail"));
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    await requestPasswordReset(email, `${window.location.origin}/${resolvedLanguage}/auth`);
    setSuccessMessage(t("profile.settings.password.sent"));
  };

  const saveVerification = async (submit: boolean) => {
    if (!snapshot.user?.id) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const nextRequest = await accountRepository.upsertVerificationRequest(snapshot.user.id, {
        legalFullName: verificationForm.legalFullName,
        nationalId: verificationForm.nationalId,
        birthDate: verificationForm.birthDate,
        city: verificationForm.city,
        email: verificationForm.email,
        documentFrontUrl: verificationForm.documentFrontUrl || null,
        documentBackUrl: verificationForm.documentBackUrl || null,
        selfieUrl: verificationForm.selfieUrl || null,
        businessName: verificationForm.businessName || null,
        businessRegistration: verificationForm.businessRegistration || null,
        submit
      });
      setVerificationRequest(nextRequest);
      setSuccessMessage(submit ? t("profile.verificationFlow.submit") : t("profile.verificationFlow.saveDraft"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("auth.errors.unknown"));
    } finally {
      setIsSaving(false);
    }
  };

  const signOutNow = async () => {
    await signOut();
    router.push(`/${resolvedLanguage}/auth`);
  };

  const openDeleteRequest = () => {
    const userId = snapshot.user?.id ?? "";
    const subject = encodeURIComponent(`SANANY account deletion request (${userId})`);
    const body = encodeURIComponent(`Account ID: ${userId}\nEmail: ${snapshot.user?.email ?? "-"}\n\nPlease delete my SANANY account.`);
    window.location.href = `mailto:support@sanany.app?subject=${subject}&body=${body}`;
  };

  const listingSectionTitle =
    section === "active"
      ? t("profile.listingSections.active")
      : section === "drafts"
      ? t("profile.listingSections.drafts")
      : section === "sold"
      ? t("profile.listingSections.sold")
      : section === "expired"
      ? t("profile.listingSections.expired")
      : t("profile.listingSections.favorites");

  const completionPercentage = getProfileCompletionPercentage(accountProfile, snapshot.user?.email);

  const sidebarItems: Array<{ id: ProfileSectionId; label: string; count?: number }> = [
    { id: "overview", label: t("profile.sidebar.overview") },
    { id: "active", label: t("profile.listingSections.active"), count: stats.active },
    { id: "drafts", label: t("profile.listingSections.drafts"), count: stats.drafts },
    { id: "sold", label: t("profile.listingSections.sold"), count: stats.sold },
    { id: "expired", label: t("profile.listingSections.expired"), count: stats.expired },
    { id: "favorites", label: t("profile.listingSections.favorites"), count: stats.favorites },
    { id: "settings-account", label: t("profile.settings.sidebar.account") },
    { id: "settings-company", label: t("profile.settings.sidebar.company") },
    { id: "settings-privacy", label: t("profile.settings.sidebar.privacy") },
    { id: "settings-notifications", label: t("profile.settings.sidebar.notifications") },
    { id: "settings-language", label: t("profile.settings.sidebar.language") },
    { id: "settings-password", label: t("profile.settings.sidebar.password") },
    { id: "settings-blocked", label: t("profile.settings.sidebar.blocked") },
    { id: "settings-verification", label: t("profile.settings.sidebar.verification") },
    { id: "settings-delete", label: t("profile.settings.sidebar.delete") }
  ];

  return (
    <RequireAuth language={resolvedLanguage}>
      <div dir={resolvedLanguage === "ar" ? "rtl" : "ltr"} className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-2 lg:sticky lg:top-24 lg:h-fit">
          <Card className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">{t("profile.sidebar.title")}</h2>
            <nav className="hidden space-y-1 lg:block">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSectionWithUrl(item.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                    section === item.id ? "bg-brand/10 text-brand" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span>{item.label}</span>
                  {typeof item.count === "number" ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{item.count}</span>
                  ) : null}
                </button>
              ))}
            </nav>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSectionWithUrl(item.id)}
                  className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs ${
                    section === item.id ? "border-brand bg-brand/10 text-brand" : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </Card>
        </aside>

        <div className="space-y-4">
          <Card className="space-y-1">
            <h1 className="text-2xl font-bold text-slate-900">{t("profile.pageTitle")}</h1>
            <p className="text-sm text-slate-600">{t("profile.pageSubtitle")}</p>
          </Card>

          {isLoadingProfile ? <Card><p className="text-sm text-slate-600">{t("common.loading")}</p></Card> : null}
          {errorMessage ? <Card><p className="text-sm text-red-600">{errorMessage}</p></Card> : null}
          {successMessage ? <Card><p className="text-sm text-emerald-700">{successMessage}</p></Card> : null}

          {!isLoadingProfile && profile ? (
            <>
              {section === "overview" ? (
                <div className="space-y-4">
                  <Card className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">{profile.displayName}</h2>
                        <p className="text-sm text-slate-600">
                          {t(`sellerProfile.accountType.${profile.accountType}`)} • {profile.city ?? t("profile.notProvided")}
                        </p>
                      </div>
                      <Link
                        href={`/${resolvedLanguage}/seller/${profile.id}`}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand/40 hover:text-brand"
                      >
                        {t("profile.publicProfile.title")}
                      </Link>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">{t("profile.listingSections.active")}</p>
                        <p className="text-lg font-semibold text-slate-900">{stats.active}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">{t("profile.listingSections.drafts")}</p>
                        <p className="text-lg font-semibold text-slate-900">{stats.drafts}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">{t("profile.listingSections.sold")}</p>
                        <p className="text-lg font-semibold text-slate-900">{stats.sold}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">{t("profile.listingSections.expired")}</p>
                        <p className="text-lg font-semibold text-slate-900">{stats.expired}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">{t("profile.listingSections.favorites")}</p>
                        <p className="text-lg font-semibold text-slate-900">{stats.favorites}</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{t("profile.completion.title")}</h3>
                        <p className="text-sm text-slate-600">{t("profile.completion.subtitle")}</p>
                      </div>
                      <div className="rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold text-brand">
                        {t("profile.completion.progress", { value: completionPercentage })}
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${completionPercentage}%` }} />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {(["avatar", "email", "city", "birthDate", "gender", "bio", "preferredContactMethod"] as const).map((item) => (
                        <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          {t(`profile.completion.items.${item}`)}
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="space-y-3">
                    <h3 className="text-base font-semibold text-slate-900">{t("profile.edit.title")}</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1 text-sm">
                        <span className="text-slate-600">{t("profile.edit.displayName")}</span>
                        <input
                          value={profileForm.displayName}
                          onChange={(event) => setProfileForm((current) => ({ ...current, displayName: event.target.value }))}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="text-slate-600">{t("profile.edit.city")}</span>
                        <input
                          value={profileForm.city}
                          onChange={(event) => setProfileForm((current) => ({ ...current, city: event.target.value }))}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="text-slate-600">{t("profile.edit.phone")}</span>
                        <input
                          value={profileForm.phone}
                          onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="text-slate-600">{t("profile.completion.items.birthDate")}</span>
                        <input
                          type="date"
                          value={profileForm.birthDate}
                          onChange={(event) => setProfileForm((current) => ({ ...current, birthDate: event.target.value }))}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="text-slate-600">{t("profile.completion.items.gender")}</span>
                        <select
                          value={profileForm.gender}
                          onChange={(event) => setProfileForm((current) => ({ ...current, gender: event.target.value }))}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
                        >
                          <option value="">{t("profile.notProvided")}</option>
                          <option value="male">{t("profile.genderOptions.male")}</option>
                          <option value="female">{t("profile.genderOptions.female")}</option>
                          <option value="prefer_not_to_say">{t("profile.genderOptions.prefer_not_to_say")}</option>
                        </select>
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="text-slate-600">{t("profile.completion.items.preferredContactMethod")}</span>
                        <select
                          value={profileForm.preferredContactMethod}
                          onChange={(event) => setProfileForm((current) => ({ ...current, preferredContactMethod: event.target.value }))}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
                        >
                          <option value="">{t("profile.notProvided")}</option>
                          <option value="phone">{t("profile.contactMethodOptions.phone")}</option>
                          <option value="chat">{t("profile.contactMethodOptions.chat")}</option>
                          <option value="whatsapp">{t("profile.contactMethodOptions.whatsapp")}</option>
                          <option value="email">{t("profile.contactMethodOptions.email")}</option>
                        </select>
                      </label>
                      <label className="space-y-1 text-sm md:col-span-2">
                        <span className="text-slate-600">{t("profile.edit.bio")}</span>
                        <textarea
                          value={profileForm.bio}
                          onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))}
                          rows={3}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => void saveProfile()}
                      disabled={isSaving}
                      className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {t("profile.edit.save")}
                    </button>
                  </Card>
                </div>
              ) : null}

              {PROFILE_LISTING_VIEWS.includes(section as ProfileListingView) ? (
                <Card className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900">{listingSectionTitle}</h3>
                  {isLoadingSection ? <p className="text-sm text-slate-600">{t("common.loading")}</p> : null}
                  {section === "favorites" ? (
                    favoritesData.length === 0 ? (
                      <p className="text-sm text-slate-600">{t("favorites.emptyHint")}</p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {favoritesData.map((item) => (
                          <ListingCard key={item.id} listing={item} language={resolvedLanguage} />
                        ))}
                      </div>
                    )
                  ) : listingsData.items.length === 0 ? (
                    <p className="text-sm text-slate-600">{t("myAds.emptyState")}</p>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {listingsData.items.map((item) => (
                          <ListingCard key={item.id} listing={item} language={resolvedLanguage} />
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          disabled={listingsPage <= 1}
                          onClick={() => setListingsPage((current) => Math.max(1, current - 1))}
                          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-40"
                        >
                          {t("common.previous")}
                        </button>
                        <p className="text-xs text-slate-500">
                          {t("common.page", { current: listingsData.page, total: listingsData.totalPages })}
                        </p>
                        <button
                          type="button"
                          disabled={listingsPage >= listingsData.totalPages}
                          onClick={() => setListingsPage((current) => current + 1)}
                          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-40"
                        >
                          {t("common.next")}
                        </button>
                      </div>
                    </>
                  )}
                </Card>
              ) : null}

              {section === "settings-account" ? (
                <Card className="space-y-3">
                  <h3 className="text-lg font-semibold text-slate-900">{t("profile.settings.sidebar.account")}</h3>
                  <p className="text-sm text-slate-600">{t("profile.settings.account.hint")}</p>
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">{t("profile.accountDetails.emailLabel")}:</span> {snapshot.user?.email ?? t("profile.notProvided")}
                  </p>
                  <button
                    type="button"
                    onClick={() => void saveProfile()}
                    disabled={isSaving}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {t("profile.edit.save")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void signOutNow()}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    {t("profile.settings.account.signOut")}
                  </button>
                </Card>
              ) : null}

              {section === "settings-company" ? (
                <Card className="space-y-3">
                  <h3 className="text-lg font-semibold text-slate-900">{t("profile.settings.sidebar.company")}</h3>
                  <p className="text-sm text-slate-600">{t("profile.settings.company.hint")}</p>
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">{t("profile.settings.company.accountType")}:</span>{" "}
                    {t(`sellerProfile.accountType.${profile.accountType}`)}
                  </p>
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">{t("profile.settings.company.businessType")}:</span>{" "}
                    {profile.companyBusinessType ?? t("profile.notProvided")}
                  </p>
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">{t("profile.settings.company.verification")}:</span>{" "}
                    {profile.companyVerificationStatus
                      ? t(`profile.settings.verification.status.${profile.companyVerificationStatus}`)
                      : t("profile.settings.verification.status.unverified")}
                  </p>
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{t("profile.settings.company.sensitiveHint")}</p>
                </Card>
              ) : null}

              {section === "settings-privacy" ? (
                <Card className="space-y-3">
                  <h3 className="text-lg font-semibold text-slate-900">{t("profile.settings.sidebar.privacy")}</h3>
                  <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                    <span className="text-sm text-slate-700">{t("profile.settings.privacy.showPhone")}</span>
                    <input type="checkbox" checked={showPhone} onChange={(event) => setShowPhone(event.target.checked)} />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                    <span className="text-sm text-slate-700">{t("profile.settings.privacy.showLastSeen")}</span>
                    <input type="checkbox" checked={showLastSeen} onChange={(event) => setShowLastSeen(event.target.checked)} />
                  </label>
                  <button
                    type="button"
                    onClick={() => void savePrivacy()}
                    disabled={isSaving}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {t("profile.edit.save")}
                  </button>
                </Card>
              ) : null}

              {section === "settings-notifications" ? (
                <Card className="space-y-3">
                  <h3 className="text-lg font-semibold text-slate-900">{t("profile.settings.sidebar.notifications")}</h3>
                  <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                    <span className="text-sm text-slate-700">{t("profile.settings.notifications.marketing")}</span>
                    <input
                      type="checkbox"
                      checked={notificationPreferences.marketing}
                      onChange={(event) =>
                        setNotificationPreferences((current) => ({ ...current, marketing: event.target.checked }))
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                    <span className="text-sm text-slate-700">{t("profile.settings.notifications.messages")}</span>
                    <input
                      type="checkbox"
                      checked={notificationPreferences.messages}
                      onChange={(event) =>
                        setNotificationPreferences((current) => ({ ...current, messages: event.target.checked }))
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                    <span className="text-sm text-slate-700">{t("profile.settings.notifications.listingUpdates")}</span>
                    <input
                      type="checkbox"
                      checked={notificationPreferences.listingUpdates}
                      onChange={(event) =>
                        setNotificationPreferences((current) => ({ ...current, listingUpdates: event.target.checked }))
                      }
                    />
                  </label>
                  <button type="button" onClick={saveNotifications} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
                    {t("profile.edit.save")}
                  </button>
                </Card>
              ) : null}

              {section === "settings-language" ? (
                <Card className="space-y-3">
                  <h3 className="text-lg font-semibold text-slate-900">{t("profile.settings.sidebar.language")}</h3>
                  <p className="text-sm text-slate-600">{t("profile.settings.language.hint")}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => changeLanguage("ar")}
                      className={`rounded-lg border px-4 py-2 text-sm ${resolvedLanguage === "ar" ? "border-brand bg-brand/10 text-brand" : "border-slate-300 bg-white text-slate-700"}`}
                    >
                      {t("languages.ar")}
                    </button>
                    <button
                      type="button"
                      onClick={() => changeLanguage("en")}
                      className={`rounded-lg border px-4 py-2 text-sm ${resolvedLanguage === "en" ? "border-brand bg-brand/10 text-brand" : "border-slate-300 bg-white text-slate-700"}`}
                    >
                      {t("languages.en")}
                    </button>
                  </div>
                </Card>
              ) : null}

              {section === "settings-password" ? (
                <Card className="space-y-3">
                  <h3 className="text-lg font-semibold text-slate-900">{t("profile.settings.sidebar.password")}</h3>
                  <p className="text-sm text-slate-600">{t("profile.settings.password.hint")}</p>
                  <button type="button" onClick={() => void resetPassword()} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
                    {t("profile.settings.password.action")}
                  </button>
                </Card>
              ) : null}

              {section === "settings-blocked" ? (
                <Card className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900">{t("profile.settings.sidebar.blocked")}</h3>
                  <p className="text-sm text-slate-600">{t("profile.settings.blocked.empty")}</p>
                </Card>
              ) : null}

              {section === "settings-verification" ? (
                <Card className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900">{t("profile.settings.sidebar.verification")}</h3>
                  <p className="text-sm text-slate-700">
                    {t("profile.settings.verification.current", {
                      value: verificationRequest
                        ? t(`profile.verificationFlow.status.${verificationRequest.status}`)
                        : profile.companyVerificationStatus
                        ? t(`profile.settings.verification.status.${profile.companyVerificationStatus}`)
                        : profile.isVerified
                        ? t("profile.settings.verification.status.verified")
                        : t("profile.settings.verification.status.unverified")
                    })}
                  </p>
                  <p className="text-sm text-slate-600">{t("profile.verificationFlow.subtitle")}</p>
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{t("profile.verificationFlow.trustHint")}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">{t("profile.verificationFlow.fields.legalName")}</span>
                      <input
                        value={verificationForm.legalFullName}
                        onChange={(event) => setVerificationForm((current) => ({ ...current, legalFullName: event.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
                      />
                      <span className="text-xs text-slate-500">{t("profile.verificationFlow.reasons.legalName")}</span>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">{t("profile.verificationFlow.fields.nationalId")}</span>
                      <input
                        value={verificationForm.nationalId}
                        onChange={(event) => setVerificationForm((current) => ({ ...current, nationalId: event.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
                      />
                      <span className="text-xs text-slate-500">{t("profile.verificationFlow.reasons.nationalId")}</span>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">{t("profile.verificationFlow.fields.birthDate")}</span>
                      <input
                        type="date"
                        value={verificationForm.birthDate}
                        onChange={(event) => setVerificationForm((current) => ({ ...current, birthDate: event.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
                      />
                      <span className="text-xs text-slate-500">{t("profile.verificationFlow.reasons.birthDate")}</span>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">{t("profile.verificationFlow.fields.city")}</span>
                      <input
                        value={verificationForm.city}
                        onChange={(event) => setVerificationForm((current) => ({ ...current, city: event.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
                      />
                      <span className="text-xs text-slate-500">{t("profile.verificationFlow.reasons.city")}</span>
                    </label>
                    <label className="space-y-1 text-sm md:col-span-2">
                      <span className="font-medium text-slate-700">{t("profile.verificationFlow.fields.email")}</span>
                      <input
                        value={verificationForm.email}
                        onChange={(event) => setVerificationForm((current) => ({ ...current, email: event.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
                      />
                      <span className="text-xs text-slate-500">{t("profile.verificationFlow.reasons.email")}</span>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">{t("profile.verificationFlow.fields.documentFront")}</span>
                      <input
                        value={verificationForm.documentFrontUrl}
                        onChange={(event) => setVerificationForm((current) => ({ ...current, documentFrontUrl: event.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
                      />
                      <span className="text-xs text-slate-500">{t("profile.verificationFlow.reasons.documentFront")}</span>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">{t("profile.verificationFlow.fields.documentBack")}</span>
                      <input
                        value={verificationForm.documentBackUrl}
                        onChange={(event) => setVerificationForm((current) => ({ ...current, documentBackUrl: event.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
                      />
                      <span className="text-xs text-slate-500">{t("profile.verificationFlow.reasons.documentBack")}</span>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">{t("profile.verificationFlow.fields.selfie")}</span>
                      <input
                        value={verificationForm.selfieUrl}
                        onChange={(event) => setVerificationForm((current) => ({ ...current, selfieUrl: event.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
                      />
                      <span className="text-xs text-slate-500">{t("profile.verificationFlow.reasons.selfie")}</span>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">{t("profile.verificationFlow.fields.businessName")}</span>
                      <input
                        value={verificationForm.businessName}
                        onChange={(event) => setVerificationForm((current) => ({ ...current, businessName: event.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
                      />
                      <span className="text-xs text-slate-500">{t("profile.verificationFlow.reasons.businessName")}</span>
                    </label>
                    <label className="space-y-1 text-sm md:col-span-2">
                      <span className="font-medium text-slate-700">{t("profile.verificationFlow.fields.businessRegistration")}</span>
                      <input
                        value={verificationForm.businessRegistration}
                        onChange={(event) => setVerificationForm((current) => ({ ...current, businessRegistration: event.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
                      />
                      <span className="text-xs text-slate-500">{t("profile.verificationFlow.reasons.businessRegistration")}</span>
                    </label>
                  </div>
                  <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <p>{t("profile.verificationFlow.steps.personal")}</p>
                    <p>{t("profile.verificationFlow.steps.document")}</p>
                    <p>{t("profile.verificationFlow.steps.face")}</p>
                    <p>{t("profile.verificationFlow.steps.review")}</p>
                    <p>{t("profile.verificationFlow.steps.result")}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void saveVerification(false)}
                      disabled={isSaving}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                    >
                      {t("profile.verificationFlow.saveDraft")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveVerification(true)}
                      disabled={isSaving}
                      className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {t("profile.verificationFlow.submit")}
                    </button>
                  </div>
                </Card>
              ) : null}

              {section === "settings-delete" ? (
                <Card className="space-y-3 border-rose-200">
                  <h3 className="text-lg font-semibold text-rose-700">{t("profile.settings.sidebar.delete")}</h3>
                  <p className="text-sm text-slate-600">{t("profile.settings.delete.hint")}</p>
                  <button
                    type="button"
                    onClick={openDeleteRequest}
                    className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
                  >
                    {t("profile.settings.delete.action")}
                  </button>
                </Card>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </RequireAuth>
  );
}
