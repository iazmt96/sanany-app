import { useCallback, useMemo, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { MarketplaceListing } from "@sanany/types";
import {
  buildListingImageStoragePath,
  createListingImageUploadItem,
  extractListingImageStoragePath,
  getRenderableListingImageUrls,
  LISTING_IMAGES_BUCKET,
  normalizeListingImageOrder,
  serializeListingImageUrls,
  toCreateListingImageInputs,
  type ListingImageUploadItem
} from "@sanany/shared";
import { type Direction } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { getMobileListingsRepository } from "../lib/listings-repository";
import { getMobileSupabaseClient } from "../lib/supabase-client";
import { MobileIcon } from "../components/mobile-icons";

type EditListingScreenProps = {
  direction: Direction;
  listing: MarketplaceListing;
  onBack(): void;
  onSaved(updated: MarketplaceListing): void;
};

type SelectedImage = ListingImageUploadItem;

const MAX_IMAGE_COUNT = 10;

function normalizeSelectedImages(items: SelectedImage[]): SelectedImage[] {
  return normalizeListingImageOrder(items.map((item, index) => ({ ...item, isPrimary: index === 0, sortOrder: index })));
}

async function uploadMobileListingImage(input: { ownerId: string; image: SelectedImage }) {
  const response = await fetch(input.image.localUri ?? input.image.previewUri);
  const blob = await response.blob();
  const storagePath =
    input.image.storagePath ??
    buildListingImageStoragePath({
      ownerId: input.ownerId,
      localId: input.image.localId,
      mimeType: blob.type || input.image.mimeType,
      uri: input.image.previewUri
    });
  const uploadResult = await getMobileSupabaseClient().storage.from(LISTING_IMAGES_BUCKET).upload(storagePath, blob, {
    upsert: true,
    contentType: blob.type || input.image.mimeType || "image/jpeg",
    cacheControl: "3600"
  });
  if (uploadResult.error) {
    throw uploadResult.error;
  }
  const { data } = getMobileSupabaseClient().storage.from(LISTING_IMAGES_BUCKET).getPublicUrl(storagePath);
  return {
    storagePath,
    publicUrl: data.publicUrl,
    fileSize: blob.size,
    mimeType: blob.type || input.image.mimeType || "image/jpeg"
  };
}

function buildInitialImages(listing: MarketplaceListing): SelectedImage[] {
  const urls = getRenderableListingImageUrls(listing.imageUrl);
  if (!urls.length) {
    return [];
  }
  return urls.map((url, index) =>
    createListingImageUploadItem({
      localId: `existing-${index}`,
      previewUri: url,
      localUri: undefined,
      storagePath: extractListingImageStoragePath(url) ?? undefined,
      publicUrl: url,
      status: "uploaded",
      sortOrder: index,
      isPrimary: index === 0
    })
  );
}

export function EditListingScreen({ direction, listing, onBack, onSaved }: EditListingScreenProps) {
  const { t } = useTranslation();
  const { snapshot } = useAuth();
  const listingsRepository = useMemo(() => getMobileListingsRepository(), []);
  const isRtl = direction === "rtl";
  const textAlign = isRtl ? "right" : "left";

  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description ?? "");
  const [price, setPrice] = useState(listing.price > 0 ? String(listing.price) : "");
  const [locationName, setLocationName] = useState(listing.locationName ?? "");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>(() => buildInitialImages(listing));
  const [isImagePicking, setIsImagePicking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasUnsavedChangesRef = useRef(false);

  const markChanged = useCallback(() => {
    hasUnsavedChangesRef.current = true;
  }, []);

  const canAddMoreImages = selectedImages.length < MAX_IMAGE_COUNT;
  const parsedPrice = Number(price);
  const validPrice = Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : 0;

  const pickImages = async () => {
    if (isImagePicking) {
      return;
    }
    setIsImagePicking(true);
    try {
      if (Platform.OS !== "web") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(t("marketplace.create.images.permissionDenied"));
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsMultipleSelection: true,
        quality: 0.85,
        selectionLimit: MAX_IMAGE_COUNT - selectedImages.length
      });
      if (!result.canceled && result.assets.length > 0) {
        const newItems: SelectedImage[] = result.assets.map((asset, assetIndex) =>
          createListingImageUploadItem({
            localId: `new-${Date.now()}-${assetIndex}`,
            previewUri: asset.uri,
            localUri: asset.uri,
            storagePath: undefined,
            publicUrl: undefined,
            status: "pending",
            sortOrder: selectedImages.length + assetIndex,
            isPrimary: selectedImages.length === 0 && assetIndex === 0,
            mimeType: asset.mimeType ?? "image/jpeg"
          })
        );
        setSelectedImages((prev) => normalizeSelectedImages([...prev, ...newItems]));
        markChanged();
      }
    } finally {
      setIsImagePicking(false);
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => normalizeSelectedImages(prev.filter((_, i) => i !== index)));
    markChanged();
  };

  const moveImageUp = (index: number) => {
    if (index <= 0) {
      return;
    }
    setSelectedImages((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return normalizeSelectedImages(next);
    });
    markChanged();
  };

  const moveImageDown = (index: number) => {
    setSelectedImages((prev) => {
      if (index >= prev.length - 1) {
        return prev;
      }
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return normalizeSelectedImages(next);
    });
    markChanged();
  };

  const setPrimaryImage = (index: number) => {
    setSelectedImages((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      return normalizeSelectedImages([item, ...next]);
    });
    markChanged();
  };

  const handleBack = () => {
    if (hasUnsavedChangesRef.current) {
      Alert.alert(t("marketplace.detail.unsavedChangesTitle"), t("marketplace.detail.unsavedChangesMessage"), [
        { text: t("marketplace.detail.continueEditing"), style: "cancel" },
        { text: t("marketplace.detail.leaveWithoutSaving"), style: "destructive", onPress: onBack }
      ]);
    } else {
      onBack();
    }
  };

  const handleSave = async () => {
    const ownerId = snapshot.user?.id;
    if (!ownerId) {
      setErrorMessage(t("marketplace.create.edit.errors.authRequired"));
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage(t("marketplace.create.edit.errors.titleRequired"));
      return;
    }
    if (validPrice <= 0) {
      setErrorMessage(t("marketplace.create.edit.errors.priceInvalid"));
      return;
    }
    if (selectedImages.length === 0) {
      setErrorMessage(t("marketplace.create.edit.errors.imageRequired"));
      return;
    }
    if (isImagePicking) {
      setErrorMessage(t("marketplace.create.edit.errors.imagesProcessing"));
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const uploadedImages: SelectedImage[] = [];
      for (const image of selectedImages) {
        if (image.status === "uploaded" && image.publicUrl) {
          uploadedImages.push(image);
        } else {
          try {
            const result = await uploadMobileListingImage({ ownerId, image });
            uploadedImages.push({
              ...image,
              storagePath: result.storagePath,
              publicUrl: result.publicUrl,
              status: "uploaded"
            });
          } catch {
            throw new Error(t("marketplace.create.edit.errors.saveFailed"));
          }
        }
      }

      const serializedImageUrl = serializeListingImageUrls(
        uploadedImages.map((img) => img.publicUrl ?? img.previewUri)
      );

      const updated = await listingsRepository.publishDraft({
        id: listing.id,
        ownerId,
        title: trimmedTitle,
        description: description.trim(),
        price: validPrice,
        status: "available",
        imageUrl: serializedImageUrl ?? undefined,
        locationName: locationName.trim() || undefined,
        latitude: listing.latitude ?? undefined,
        longitude: listing.longitude ?? undefined,
        ownerPhone: listing.ownerPhone ?? undefined,
        offerType: listing.offerType ?? undefined,
        categorySlug: listing.categorySlug ?? undefined,
        images: toCreateListingImageInputs(uploadedImages)
      });

      hasUnsavedChangesRef.current = false;
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onSaved(updated);
      }, 1500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t("marketplace.create.edit.errors.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, isRtl ? styles.headerRtl : undefined]}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <MobileIcon name="chevron" size={18} color="#334155" />
        </Pressable>
        <Text style={styles.headerTitle}>{t("marketplace.create.edit.title")}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Title */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { textAlign }]}>{t("marketplace.create.edit.titleLabel")}</Text>
          <TextInput
            style={[styles.input, { textAlign }]}
            value={title}
            onChangeText={(v) => { setTitle(v); markChanged(); }}
            maxLength={120}
            placeholder={t("marketplace.create.titlePlaceholder")}
            placeholderTextColor="#94a3b8"
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { textAlign }]}>{t("marketplace.create.edit.descriptionLabel")}</Text>
          <TextInput
            style={[styles.input, styles.textArea, { textAlign }]}
            value={description}
            onChangeText={(v) => { setDescription(v); markChanged(); }}
            multiline
            numberOfLines={5}
            maxLength={2000}
            placeholder={t("marketplace.create.descriptionPlaceholder")}
            placeholderTextColor="#94a3b8"
          />
        </View>

        {/* Price */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { textAlign }]}>{t("marketplace.create.edit.priceLabel")}</Text>
          <TextInput
            style={[styles.input, { textAlign }]}
            value={price}
            onChangeText={(v) => { setPrice(v.replace(/[^0-9.]/g, "")); markChanged(); }}
            keyboardType="decimal-pad"
            maxLength={12}
            placeholder="0"
            placeholderTextColor="#94a3b8"
          />
        </View>

        {/* Location */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { textAlign }]}>{t("marketplace.create.edit.locationLabel")}</Text>
          <TextInput
            style={[styles.input, { textAlign }]}
            value={locationName}
            onChangeText={(v) => { setLocationName(v); markChanged(); }}
            maxLength={120}
            placeholder={t("marketplace.create.locationPlaceholder")}
            placeholderTextColor="#94a3b8"
          />
        </View>

        {/* Images */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { textAlign }]}>{t("marketplace.create.edit.imagesTitle")}</Text>
          <Text style={[styles.fieldHint, { textAlign }]}>{t("marketplace.create.edit.imagesHint")}</Text>

          <View style={styles.imageGrid}>
            {selectedImages.map((img, index) => (
              <View key={img.localId} style={[styles.imageSlot, img.isPrimary ? styles.imageSlotPrimary : undefined]}>
                <Image source={{ uri: img.publicUrl ?? img.previewUri }} style={styles.imageThumbnail} resizeMode="cover" />
                {img.isPrimary ? (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryBadgeLabel}>{t("marketplace.create.images.primary")}</Text>
                  </View>
                ) : null}
                <View style={[styles.imageActions, isRtl ? styles.imageActionsRtl : undefined]}>
                  {!img.isPrimary ? (
                    <Pressable style={styles.imageActionBtn} onPress={() => setPrimaryImage(index)}>
                      <MobileIcon name="verified" size={12} color="#0f766e" />
                    </Pressable>
                  ) : null}
                  {index > 0 ? (
                    <Pressable style={styles.imageActionBtn} onPress={() => moveImageUp(index)}>
                      <MobileIcon name="chevron" size={12} color="#334155" />
                    </Pressable>
                  ) : null}
                  {index < selectedImages.length - 1 ? (
                    <Pressable style={[styles.imageActionBtn, styles.imageActionBtnDown]} onPress={() => moveImageDown(index)}>
                      <MobileIcon name="chevron" size={12} color="#334155" />
                    </Pressable>
                  ) : null}
                  <Pressable style={[styles.imageActionBtn, styles.imageActionBtnRemove]} onPress={() => removeImage(index)}>
                    <MobileIcon name="trash" size={12} color="#dc2626" />
                  </Pressable>
                </View>
              </View>
            ))}
            {canAddMoreImages ? (
              <Pressable style={styles.addImageSlot} onPress={() => void pickImages()} disabled={isImagePicking}>
                <MobileIcon name="image" size={22} color="#64748b" />
                <Text style={styles.addImageLabel}>{t("marketplace.create.images.addPhotos")}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Error */}
        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={[styles.errorText, { textAlign }]}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Save button */}
        <Pressable
          style={[styles.saveButton, isSaving ? styles.saveButtonDisabled : undefined]}
          disabled={isSaving}
          onPress={() => void handleSave()}
        >
          <Text style={styles.saveButtonLabel}>
            {isSaving ? t("marketplace.create.edit.saving") : t("marketplace.create.edit.saveChanges")}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Success overlay */}
      {showSuccess ? (
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <MobileIcon name="verified" size={42} color="#0f766e" focused />
            <Text style={styles.successText}>{t("marketplace.create.edit.success")}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f8fafc"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0"
  },
  headerRtl: {
    flexDirection: "row-reverse"
  },
  backButton: {
    padding: 8,
    borderRadius: 999
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center"
  },
  headerSpacer: {
    width: 36
  },
  body: {
    padding: 16,
    gap: 16,
    paddingBottom: 40
  },
  field: {
    gap: 6
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155"
  },
  fieldHint: {
    fontSize: 12,
    color: "#64748b"
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe4ee",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0f172a",
    minHeight: 46
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
    paddingTop: 12
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  imageSlot: {
    width: 96,
    height: 96,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#e2e8f0",
    position: "relative"
  },
  imageSlotPrimary: {
    borderWidth: 2,
    borderColor: "#0f766e"
  },
  imageThumbnail: {
    width: "100%",
    height: "100%"
  },
  primaryBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    backgroundColor: "#0f766e",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  primaryBadgeLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#ffffff"
  },
  imageActions: {
    position: "absolute",
    bottom: 4,
    right: 4,
    flexDirection: "row",
    gap: 4
  },
  imageActionsRtl: {
    right: undefined,
    left: 4
  },
  imageActionBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center"
  },
  imageActionBtnDown: {
    transform: [{ rotate: "180deg" }]
  },
  imageActionBtnRemove: {
    backgroundColor: "rgba(254,226,226,0.95)"
  },
  addImageSlot: {
    width: 96,
    height: 96,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#dbe4ee",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    gap: 4
  },
  addImageLabel: {
    fontSize: 11,
    color: "#64748b",
    textAlign: "center"
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    padding: 12
  },
  errorText: {
    fontSize: 13,
    color: "#dc2626"
  },
  saveButton: {
    backgroundColor: "#0f766e",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8
  },
  saveButtonDisabled: {
    opacity: 0.55
  },
  saveButtonLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff"
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99
  },
  successCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 36,
    alignItems: "center",
    gap: 16,
    minWidth: 200
  },
  successText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f766e",
    textAlign: "center"
  }
});
