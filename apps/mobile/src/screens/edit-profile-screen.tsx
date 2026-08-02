import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  OTP_LENGTH,
  createUsernameSuggestions,
  isValidPhoneNumber,
  LISTING_IMAGES_BUCKET,
  normalizePhoneNumber,
  validateUsername
} from "@sanany/shared";
import { type Direction } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { MobileIcon } from "../components/mobile-icons";
import { getMobileSupabaseClient } from "../lib/supabase-client";

type EditProfileScreenProps = {
  direction: Direction;
  onBack(): void;
};

type UsernameState = {
  checking: boolean;
  isAvailable: boolean;
  errorKey: string | null;
  suggestions: string[];
};

function getFileExtension(fileName: string | null | undefined, mimeType: string | null | undefined): string {
  const fromName = fileName?.split(".").pop()?.trim().toLowerCase();
  if (fromName) return fromName;
  if (mimeType?.includes("png")) return "png";
  if (mimeType?.includes("webp")) return "webp";
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

export function EditProfileScreen({ direction, onBack }: EditProfileScreenProps) {
  const { t } = useTranslation();
  const {
    accountProfile,
    snapshot,
    checkUsernameAvailability,
    refreshAccountProfile,
    updateOptionalProfile,
    requestPhoneOtp,
    verifyPhoneOtp
  } = useAuth();
  const isRtl = direction === "rtl";
  const textAlign = isRtl ? "right" : "left";
  const successScale = useRef(new Animated.Value(0.7)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const [displayName, setDisplayName] = useState(accountProfile?.displayName ?? "");
  const [username, setUsername] = useState(accountProfile?.username ?? "");
  const [bio, setBio] = useState(accountProfile?.bio ?? "");
  const [website, setWebsite] = useState(accountProfile?.website ?? "");
  const [phone, setPhone] = useState(accountProfile?.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(accountProfile?.avatarUrl ?? null);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [isOtpSending, setIsOtpSending] = useState(false);
  const [isOtpVerifying, setIsOtpVerifying] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [usernameState, setUsernameState] = useState<UsernameState>({
    checking: false,
    isAvailable: false,
    errorKey: null,
    suggestions: []
  });

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

  const pickAvatar = useCallback(async (mode: "gallery" | "camera") => {
    if (!snapshot.user?.id) {
      setErrorKey("profile.edit.errors.saveFailed");
      return;
    }

    const permission =
      mode === "gallery"
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setErrorKey("profile.edit.errors.imagePermissionDenied");
      return;
    }

    const pickerResult =
      mode === "gallery"
        ? await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85
        })
        : await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85
        });

    if (pickerResult.canceled || pickerResult.assets.length === 0) {
      return;
    }

    const [asset] = pickerResult.assets;
    if (!asset.uri) {
      setErrorKey("profile.edit.errors.imagePickFailed");
      return;
    }

    setIsAvatarUploading(true);
    setErrorKey(null);
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const extension = getFileExtension(asset.fileName, asset.mimeType ?? blob.type);
      const storagePath = `${snapshot.user.id}/profile/avatar-${Date.now()}.${extension}`;
      const uploadResult = await getMobileSupabaseClient().storage.from(LISTING_IMAGES_BUCKET).upload(storagePath, blob, {
        upsert: true,
        contentType: asset.mimeType ?? blob.type ?? "image/jpeg",
        cacheControl: "3600"
      });

      if (uploadResult.error) {
        throw uploadResult.error;
      }

      const { data } = getMobileSupabaseClient().storage.from(LISTING_IMAGES_BUCKET).getPublicUrl(storagePath);
      setAvatarUrl(data.publicUrl);
    } catch {
      setErrorKey("profile.edit.errors.imageUploadFailed");
    } finally {
      setIsAvatarUploading(false);
    }
  }, [snapshot.user?.id]);

  const removeAvatar = useCallback(() => {
    Alert.alert(
      t("profile.edit.photoActions.remove"),
      t("profile.edit.removePhotoConfirm"),
      [
        { text: t("profile.edit.cancelAction"), style: "cancel" },
        { text: t("profile.edit.removeAction"), style: "destructive", onPress: () => setAvatarUrl(null) }
      ]
    );
  }, [t]);

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

  const playSuccess = useCallback(() => {
    setShowSuccess(true);
    successOpacity.setValue(0);
    successScale.setValue(0.7);
    Animated.parallel([
      Animated.timing(successOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(successScale, { toValue: 1, friction: 6, tension: 130, useNativeDriver: true })
    ]).start(() => {
      setTimeout(() => {
        Animated.timing(successOpacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
          setShowSuccess(false);
        });
      }, 700);
    });
  }, [successOpacity, successScale]);

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
      playSuccess();
      setTimeout(() => onBack(), 500);
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
    onBack,
    phoneVerified,
    playSuccess,
    refreshAccountProfile,
    updateOptionalProfile,
    username,
    usernameState.errorKey,
    website
  ]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, isRtl ? styles.rowRtl : undefined]}>
        <Pressable style={[styles.backButton, isRtl ? styles.backButtonRtl : undefined]} onPress={onBack} disabled={isSaving || isAvatarUploading}>
          <MobileIcon name="chevron" size={18} color="#334155" />
          <Text style={styles.backButtonLabel}>{t("profile.edit.cancelAction")}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { textAlign }]}>{t("profile.edit.title")}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <MobileIcon name="profile" size={46} color="#0f766e" focused />
              </View>
            )}
          </View>
          <View style={[styles.photoActionsRow, isRtl ? styles.rowRtl : undefined]}>
            <Pressable style={styles.photoActionButton} onPress={() => void pickAvatar("gallery")} disabled={isAvatarUploading}>
              <Text style={styles.photoActionLabel}>{t("profile.edit.photoActions.gallery")}</Text>
            </Pressable>
            <Pressable style={styles.photoActionButton} onPress={() => void pickAvatar("camera")} disabled={isAvatarUploading}>
              <Text style={styles.photoActionLabel}>{t("profile.edit.photoActions.camera")}</Text>
            </Pressable>
            <Pressable style={styles.photoActionButton} onPress={removeAvatar} disabled={isAvatarUploading}>
              <Text style={styles.photoActionLabel}>{t("profile.edit.photoActions.remove")}</Text>
            </Pressable>
          </View>
          <Text style={[styles.helperText, { textAlign }]}>{t("profile.edit.photoCropHint")}</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={[styles.inputLabel, { textAlign }]}>{t("profile.edit.fields.displayName")}</Text>
          <TextInput
            style={[styles.input, { textAlign }]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={t("profile.edit.placeholders.displayName")}
            maxLength={50}
          />
          <Text style={[styles.counterText, { textAlign }]}>{t("profile.edit.displayNameLimit", { value: 50 - displayName.length })}</Text>

          <Text style={[styles.inputLabel, { textAlign }]}>{t("profile.edit.fields.username")}</Text>
          <TextInput
            style={[styles.input, { textAlign }]}
            value={username}
            onChangeText={(value) => setUsername(value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            placeholder={t("profile.edit.placeholders.username")}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
          />
          {usernameState.checking ? <Text style={[styles.helperText, { textAlign }]}>{t("profile.edit.usernameChecking")}</Text> : null}
          {!usernameState.checking && usernameState.isAvailable ? <Text style={[styles.successText, { textAlign }]}>✓ {t("profile.edit.usernameAvailable")}</Text> : null}
          {!usernameState.checking && usernameState.errorKey ? <Text style={[styles.errorText, { textAlign }]}>{t(usernameState.errorKey)}</Text> : null}
          {usernameState.suggestions.length > 0 ? (
            <View style={styles.suggestionsWrap}>
              <Text style={[styles.helperText, { textAlign }]}>{t("profile.edit.usernameSuggestions")}</Text>
              <View style={[styles.suggestionsRow, isRtl ? styles.rowRtl : undefined]}>
                {usernameState.suggestions.map((item) => (
                  <Pressable key={item} style={styles.suggestionChip} onPress={() => setUsername(item)}>
                    <Text style={styles.suggestionChipLabel}>@{item}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <Text style={[styles.inputLabel, { textAlign }]}>{t("profile.edit.fields.bio")}</Text>
          <TextInput
            style={[styles.input, styles.multilineInput, { textAlign }]}
            multiline
            value={bio}
            onChangeText={setBio}
            placeholder={t("profile.edit.placeholders.bio")}
            maxLength={160}
          />
          <Text style={[styles.counterText, { textAlign }]}>{t("profile.edit.bioRemaining", { value: Math.max(0, bioRemaining) })}</Text>

          <Text style={[styles.inputLabel, { textAlign }]}>{t("profile.edit.fields.website")}</Text>
          <TextInput
            style={[styles.input, { textAlign }]}
            value={website}
            onChangeText={setWebsite}
            placeholder={t("profile.edit.placeholders.website")}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Text style={[styles.helperText, { textAlign }]}>{t("profile.edit.websiteHint")}</Text>

          <Text style={[styles.inputLabel, { textAlign }]}>{t("profile.edit.fields.phone")}</Text>
          <TextInput
            style={[styles.input, { textAlign }]}
            value={phone}
            onChangeText={setPhone}
            placeholder={t("profile.edit.placeholders.phone")}
            keyboardType="phone-pad"
          />

          {isPhoneChanged ? (
            <View style={styles.otpCard}>
              <Text style={[styles.helperText, { textAlign }]}>{t("profile.edit.phoneOtpHint")}</Text>
              {!otpSent ? (
                <Pressable style={[styles.otpButton, isOtpSending ? styles.disabledButton : undefined]} onPress={() => void sendPhoneOtp()} disabled={isOtpSending}>
                  {isOtpSending ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.otpButtonLabel}>{t("profile.edit.phoneActions.sendOtp")}</Text>}
                </Pressable>
              ) : (
                <>
                  <TextInput
                    style={[styles.input, { textAlign }]}
                    value={otpCode}
                    onChangeText={(value) => setOtpCode(value.replace(/\D/g, "").slice(0, OTP_LENGTH))}
                    placeholder={t("profile.edit.placeholders.otp")}
                    keyboardType="number-pad"
                    maxLength={OTP_LENGTH}
                  />
                  <Pressable style={[styles.otpButton, isOtpVerifying ? styles.disabledButton : undefined]} onPress={() => void verifyPhoneChangeOtp()} disabled={isOtpVerifying || phoneVerified}>
                    {isOtpVerifying ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.otpButtonLabel}>{t("profile.edit.phoneActions.verifyOtp")}</Text>}
                  </Pressable>
                </>
              )}
              {phoneVerified ? <Text style={[styles.successText, { textAlign }]}>✓ {t("profile.edit.phoneVerified")}</Text> : null}
            </View>
          ) : null}

          {errorKey ? <Text style={[styles.errorText, { textAlign }]}>{t(errorKey)}</Text> : null}
        </View>
      </ScrollView>

      <Pressable
        style={[styles.saveButton, (isSaving || isAvatarUploading || usernameState.checking) ? styles.disabledButton : undefined]}
        onPress={() => void onSave()}
        disabled={isSaving || isAvatarUploading || usernameState.checking}
      >
        {isSaving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveButtonLabel}>{t("profile.edit.saveAction")}</Text>}
      </Pressable>

      {showSuccess ? (
        <Animated.View style={[styles.successOverlay, { opacity: successOpacity, transform: [{ scale: successScale }] }]}>
          <MobileIcon name="verified" size={28} color="#0f766e" focused />
          <Text style={styles.successOverlayText}>{t("profile.edit.success")}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  rowRtl: {
    flexDirection: "row-reverse"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a"
  },
  backButton: {
    minHeight: 36,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe4ee",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  backButtonRtl: {
    flexDirection: "row-reverse"
  },
  backButtonLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155"
  },
  content: {
    gap: 10,
    paddingBottom: 12
  },
  heroCard: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 10
  },
  avatarWrap: {
    alignItems: "center",
    justifyContent: "center"
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#ecfdfa",
    alignItems: "center",
    justifyContent: "center"
  },
  photoActionsRow: {
    flexDirection: "row",
    gap: 8
  },
  photoActionButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc"
  },
  photoActionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155"
  },
  formCard: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 8
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155"
  },
  input: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    color: "#0f172a"
  },
  multilineInput: {
    minHeight: 90,
    textAlignVertical: "top",
    paddingTop: 10
  },
  helperText: {
    fontSize: 11,
    color: "#64748b"
  },
  counterText: {
    fontSize: 11,
    color: "#64748b",
    marginBottom: 6
  },
  suggestionsWrap: {
    gap: 6
  },
  suggestionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  suggestionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#bae6fd",
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  suggestionChipLabel: {
    fontSize: 11,
    color: "#0369a1",
    fontWeight: "600"
  },
  otpCard: {
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#dbe4ee",
    padding: 10,
    gap: 8
  },
  otpButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center"
  },
  otpButtonLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff"
  },
  saveButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8
  },
  saveButtonLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff"
  },
  disabledButton: {
    opacity: 0.6
  },
  errorText: {
    fontSize: 12,
    color: "#b91c1c"
  },
  successText: {
    fontSize: 12,
    color: "#0f766e"
  },
  successOverlay: {
    position: "absolute",
    top: "42%",
    left: "16%",
    right: "16%",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ccfbf1",
    padding: 16,
    alignItems: "center",
    gap: 8
  },
  successOverlayText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f766e"
  }
});
