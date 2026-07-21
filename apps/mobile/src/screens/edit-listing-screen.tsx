import { useCallback, useMemo, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { createClient } from "@supabase/supabase-js";
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { CAR_CONDITIONS, CAR_FUEL_TYPES, CAR_PRICE_MODES, type CarCondition, type CarFuelType, type CarPriceMode, type MarketplaceListing } from "@sanany/types";
import { createListingsRepository } from "@sanany/api";
import {
  buildListingImageStoragePath,
  createListingImageUploadItem,
  extractListingImageStoragePath,
  getRenderableListingImageUrls,
  LISTING_IMAGES_BUCKET,
  normalizeListingImageOrder,
  readMetadataPhone,
  serializeListingImageUrls,
  toCreateListingImageInputs,
  type ListingImageUploadItem
} from "@sanany/shared";
import { type Direction } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { getMobileSupabaseEnv } from "../config/env";
import { createStaticMapPreviewUrl, reverseGeocodeLocation, translateMapPressToCoordinates } from "../lib/location-map";
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

type StructuredSpecRow = {
  label: string;
  value: string;
};

type ParsedDescriptionContent = {
  cleanDescription: string;
  rows: StructuredSpecRow[];
};

function normalizeSelectedImages(items: SelectedImage[]): SelectedImage[] {
  return normalizeListingImageOrder(items.map((item, index) => ({ ...item, isPrimary: index === 0, sortOrder: index })));
}

function parseStructuredSpecificationRows(description: string): ParsedDescriptionContent {
  if (!description.trim()) {
    return { cleanDescription: "", rows: [] };
  }

  const sourceLines = description.split("\n");
  const lines = sourceLines.map((line) => line.trim()).filter((line) => line.length > 0);
  const structuredIndex = lines.findIndex((line) => line === "بيانات السيارة" || line === "Car data");
  if (structuredIndex < 0) {
    return { cleanDescription: description.trim(), rows: [] };
  }

  const rows: StructuredSpecRow[] = [];
  for (const line of lines.slice(structuredIndex + 1)) {
    if (!line.startsWith("- ")) {
      continue;
    }
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }
    const label = line.slice(2, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!label || !value || value === "-") {
      continue;
    }
    rows.push({
      label,
      value
    });
  }
  const cleanDescription = lines.slice(0, structuredIndex).join("\n").trim();
  if (cleanDescription.length > 0) {
    return { cleanDescription, rows };
  }
  const rawStructuredAnchor = sourceLines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed === "بيانات السيارة" || trimmed === "Car data";
  });
  if (rawStructuredAnchor < 0) {
    return { cleanDescription: description.trim(), rows };
  }
  const rawCleanDescription = sourceLines
    .slice(0, rawStructuredAnchor)
    .join("\n")
    .trim();
  return { cleanDescription: rawCleanDescription, rows };
}

function normalizeLabelToken(label: string): string {
  return label.trim().toLowerCase();
}

function isSpecLabelType(label: string, type: "condition" | "fuelType" | "priceMode" | "location"): boolean {
  const token = normalizeLabelToken(label);
  if (type === "condition") {
    return token.includes("حالة السيارة") || token.includes("condition");
  }
  if (type === "fuelType") {
    return token.includes("الوقود") || token.includes("fuel");
  }
  if (type === "priceMode") {
    return token.includes("تسعير الإعلان") || token.includes("price mode");
  }
  return token.includes("الموقع") || token.includes("location");
}

function resolveEditErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
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
  const { t, i18n } = useTranslation();
  const { snapshot } = useAuth();
  const listingsRepository = useMemo(() => getMobileListingsRepository(), []);
  const isRtl = direction === "rtl";
  const textAlign = isRtl ? "right" : "left";
  const parsedDescription = useMemo(() => parseStructuredSpecificationRows(listing.description ?? ""), [listing.description]);
  const listingAttributes = useMemo(
    () => (listing.attributes && typeof listing.attributes === "object" ? listing.attributes : {}),
    [listing.attributes]
  );
  const resolveSpecValue = useCallback(
    (type: "condition" | "fuelType" | "priceMode"): string | null => {
      const row = parsedDescription.rows.find((item) => isSpecLabelType(item.label, type));
      return row?.value?.trim() || null;
    },
    [parsedDescription.rows]
  );
  const resolveOptionValue = useCallback(
    <T extends string>(keys: readonly T[], translationKeyBase: string, value: unknown): T | null => {
      if (typeof value !== "string" || value.trim().length === 0) {
        return null;
      }
      const normalizedValue = value.trim().toLowerCase();
      const matched = keys.find((key) => {
        const localizedLabel = t(`${translationKeyBase}.${key}`);
        return localizedLabel.trim().toLowerCase() === normalizedValue;
      });
      return matched ?? null;
    },
    [t]
  );

  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(parsedDescription.cleanDescription);
  const [price, setPrice] = useState(listing.price > 0 ? String(listing.price) : "");
  const [carCondition, setCarCondition] = useState<CarCondition>(() => {
    const attributeValue = listingAttributes.condition;
    if (typeof attributeValue === "string" && CAR_CONDITIONS.includes(attributeValue as CarCondition)) {
      return attributeValue as CarCondition;
    }
    const parsedValue = resolveOptionValue(CAR_CONDITIONS, "marketplace.create.carDetails.conditionOptions", resolveSpecValue("condition"));
    return parsedValue ?? "new";
  });
  const [carFuelType, setCarFuelType] = useState<CarFuelType>(() => {
    const attributeValue = listingAttributes.fuelType;
    if (typeof attributeValue === "string" && CAR_FUEL_TYPES.includes(attributeValue as CarFuelType)) {
      return attributeValue as CarFuelType;
    }
    const parsedValue = resolveOptionValue(CAR_FUEL_TYPES, "marketplace.create.carDetails.fuelOptions", resolveSpecValue("fuelType"));
    return parsedValue ?? "gasoline";
  });
  const [carPriceMode, setCarPriceMode] = useState<CarPriceMode>(() => {
    const attributeValue = listingAttributes.priceMode;
    if (typeof attributeValue === "string" && CAR_PRICE_MODES.includes(attributeValue as CarPriceMode)) {
      return attributeValue as CarPriceMode;
    }
    const parsedValue = resolveOptionValue(CAR_PRICE_MODES, "marketplace.create.carDetails.priceModeOptions", resolveSpecValue("priceMode"));
    return parsedValue ?? "fixed";
  });
  const [locationName, setLocationName] = useState(listing.locationName ?? "");
  const [locationLatitude, setLocationLatitude] = useState<number | null>(listing.latitude ?? null);
  const [locationLongitude, setLocationLongitude] = useState<number | null>(listing.longitude ?? null);
  const [isMapEditorOpen, setIsMapEditorOpen] = useState(false);
  const [mapDraftLocation, setMapDraftLocation] = useState(listing.locationName ?? "");
  const [mapDraftLatitude, setMapDraftLatitude] = useState<number>(listing.latitude ?? 24.7136);
  const [mapDraftLongitude, setMapDraftLongitude] = useState<number>(listing.longitude ?? 46.6753);
  const [mapPreviewSize, setMapPreviewSize] = useState({ width: 0, height: 0 });
  const [isResolvingMapLocation, setIsResolvingMapLocation] = useState(false);
  const [mapLocationError, setMapLocationError] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>(() => buildInitialImages(listing));
  const [isImagePicking, setIsImagePicking] = useState(false);
  const [submitMode, setSubmitMode] = useState<"save" | "publish" | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasUnsavedChangesRef = useRef(false);

  const markChanged = useCallback(() => {
    hasUnsavedChangesRef.current = true;
  }, []);

  const canAddMoreImages = selectedImages.length < MAX_IMAGE_COUNT;
  const parsedPrice = Number(price);
  const validPrice = Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : 0;
  const shouldShowPriceInput = carPriceMode === "fixed";
  const defaultLatitude = 24.7136;
  const defaultLongitude = 46.6753;
  const defaultLocationName = t("marketplace.create.defaultLocation");
  const mapPreviewUrl = createStaticMapPreviewUrl(mapDraftLatitude, mapDraftLongitude);
  const specificationRows = useMemo(
    () =>
      parsedDescription.rows.filter(
        (row) =>
          !isSpecLabelType(row.label, "condition") &&
          !isSpecLabelType(row.label, "fuelType") &&
          !isSpecLabelType(row.label, "priceMode") &&
          !isSpecLabelType(row.label, "location")
      ),
    [parsedDescription.rows]
  );
  const hasEditableSpecsContext = useMemo(() => {
    if (parsedDescription.rows.length > 0) {
      return true;
    }
    return (
      typeof listingAttributes.condition === "string" ||
      typeof listingAttributes.fuelType === "string" ||
      typeof listingAttributes.priceMode === "string"
    );
  }, [listingAttributes.condition, listingAttributes.fuelType, listingAttributes.priceMode, parsedDescription.rows.length]);

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

  const openMapEditor = () => {
    setMapDraftLatitude(locationLatitude ?? defaultLatitude);
    setMapDraftLongitude(locationLongitude ?? defaultLongitude);
    setMapDraftLocation(locationName.trim() || defaultLocationName);
    setMapLocationError(null);
    setIsMapEditorOpen(true);
  };

  const handleMapPress = async (pressX: number, pressY: number, width: number, height: number) => {
    const nextCoordinates = translateMapPressToCoordinates({
      centerLatitude: mapDraftLatitude,
      centerLongitude: mapDraftLongitude,
      pressX,
      pressY,
      width,
      height
    });

    setMapDraftLatitude(nextCoordinates.latitude);
    setMapDraftLongitude(nextCoordinates.longitude);
    setIsResolvingMapLocation(true);
    setMapLocationError(null);

    try {
      const nextLocationLabel = await reverseGeocodeLocation({
        latitude: nextCoordinates.latitude,
        longitude: nextCoordinates.longitude,
        language: i18n.language || "ar"
      });
      setMapDraftLocation(nextLocationLabel || defaultLocationName);
    } catch {
      setMapLocationError(t("marketplace.edit.errors.locationResolveFailed"));
    } finally {
      setIsResolvingMapLocation(false);
    }
  };

  const onSaveMapEditor = () => {
    setLocationLatitude(mapDraftLatitude);
    setLocationLongitude(mapDraftLongitude);
    setLocationName(mapDraftLocation.trim() || defaultLocationName);
    setIsMapEditorOpen(false);
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

  const handleSubmit = async (mode: "save" | "publish") => {
    const ownerId = snapshot.user?.id;
    if (!ownerId) {
      setErrorMessage(t("marketplace.edit.errors.authRequired"));
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage(t("marketplace.edit.errors.titleRequired"));
      return;
    }
    if (shouldShowPriceInput && validPrice <= 0) {
      setErrorMessage(t("marketplace.edit.errors.priceInvalid"));
      return;
    }
    if (selectedImages.length === 0) {
      setErrorMessage(t("marketplace.edit.errors.imageRequired"));
      return;
    }
    if (isImagePicking) {
      setErrorMessage(t("marketplace.edit.errors.imagesProcessing"));
      return;
    }

    setSubmitMode(mode);
    setErrorMessage(null);
    try {
      const ownerPhone =
        (snapshot.user?.phone && snapshot.user.phone.trim().length > 0 ? snapshot.user.phone.trim() : null) ??
        readMetadataPhone(snapshot.user?.user_metadata) ??
        listing.ownerPhone ??
        null;
      const sessionToken = snapshot.session?.access_token;
      const repository =
        sessionToken && sessionToken.trim().length > 0
          ? createListingsRepository(
              createClient(getMobileSupabaseEnv().supabaseUrl, getMobileSupabaseEnv().supabaseAnonKey, {
                auth: { persistSession: false, autoRefreshToken: false },
                global: {
                  headers: {
                    Authorization: `Bearer ${sessionToken}`
                  }
                }
              })
            )
          : listingsRepository;
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
          } catch (uploadError) {
            console.error("[edit-listing-screen] image upload failed", uploadError);
            throw new Error(resolveEditErrorMessage(uploadError, t("marketplace.edit.errors.saveFailed")));
          }
        }
      }

      const serializedImageUrl = serializeListingImageUrls(
        uploadedImages.map((img) => img.publicUrl ?? img.previewUri)
      );

      const nextAttributes = {
        ...listingAttributes,
        condition: carCondition,
        fuelType: carFuelType,
        priceMode: carPriceMode
      };
      const metadataParts: string[] = [];
      if (hasEditableSpecsContext) {
        metadataParts.push(t("marketplace.create.carDetails.structuredTitle"));
        metadataParts.push(...specificationRows.map((row) => `- ${row.label}: ${row.value}`));
        metadataParts.push(`- ${t("marketplace.create.carDetails.locationLabel")}: ${locationName.trim() || "-"}`);
        metadataParts.push(`- ${t("marketplace.create.carDetails.conditionLabel")}: ${t(`marketplace.create.carDetails.conditionOptions.${carCondition}`)}`);
        metadataParts.push(`- ${t("marketplace.create.carDetails.fuelLabel")}: ${t(`marketplace.create.carDetails.fuelOptions.${carFuelType}`)}`);
        metadataParts.push(`- ${t("marketplace.create.carDetails.priceModeLabel")}: ${t(`marketplace.create.carDetails.priceModeOptions.${carPriceMode}`)}`);
      }
      const baseDescription = description.trim();
      const nextDescription = metadataParts.length > 0 ? (baseDescription ? `${baseDescription}\n\n${metadataParts.join("\n")}` : metadataParts.join("\n")) : baseDescription;
      const payload = {
        id: listing.id,
        ownerId,
        title: trimmedTitle,
        description: nextDescription,
        price: shouldShowPriceInput ? validPrice : listing.price,
        status: mode === "publish" ? ("available" as const) : ("draft" as const),
        imageUrl: serializedImageUrl ?? undefined,
        locationName: locationName.trim() || undefined,
        latitude: locationLatitude ?? undefined,
        longitude: locationLongitude ?? undefined,
        ownerPhone: ownerPhone ?? undefined,
        offerType: listing.offerType ?? undefined,
        categorySlug: listing.categorySlug ?? undefined,
        attributes: nextAttributes,
        images: toCreateListingImageInputs(uploadedImages)
      };

      const updated =
        mode === "publish"
          ? await repository.publishDraft(payload)
          : await repository.saveDraft(payload);

      hasUnsavedChangesRef.current = false;
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onSaved(updated);
      }, 1500);
    } catch (err) {
      console.error("[edit-listing-screen] submit failed", err);
      setErrorMessage(resolveEditErrorMessage(err, t("marketplace.edit.errors.saveFailed")));
    } finally {
      setSubmitMode(null);
    }
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, isRtl ? styles.headerRtl : undefined]}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <MobileIcon name="chevron" size={18} color="#334155" />
        </Pressable>
        <Text style={styles.headerTitle}>{t("marketplace.edit.title")}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Title */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { textAlign }]}>{t("marketplace.edit.titleLabel")}</Text>
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
          <Text style={[styles.fieldLabel, { textAlign }]}>{t("marketplace.edit.descriptionLabel")}</Text>
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

        {hasEditableSpecsContext ? (
          <View style={styles.field}>
          <Text style={[styles.fieldLabel, { textAlign }]}>{t("marketplace.edit.specificationsEditableTitle")}</Text>
          <Text style={[styles.fieldHint, { textAlign }]}>{t("marketplace.edit.pricingModeHint")}</Text>
          <View style={[styles.optionChipWrap, isRtl ? styles.optionChipWrapRtl : undefined]}>
            {CAR_PRICE_MODES.map((mode) => (
              <Pressable
                key={mode}
                style={[styles.optionChip, carPriceMode === mode ? styles.optionChipSelected : undefined]}
                onPress={() => {
                  setCarPriceMode(mode);
                  markChanged();
                }}
              >
                <Text style={[styles.optionChipLabel, carPriceMode === mode ? styles.optionChipLabelSelected : undefined]}>
                  {t(`marketplace.create.carDetails.priceModeOptions.${mode}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          {!shouldShowPriceInput ? <Text style={[styles.fieldHint, { textAlign }]}>{t("marketplace.edit.priceOptionalHint")}</Text> : null}
          <Text style={[styles.fieldLabel, { textAlign }]}>{t("marketplace.create.carDetails.conditionLabel")}</Text>
          <View style={[styles.optionChipWrap, isRtl ? styles.optionChipWrapRtl : undefined]}>
            {CAR_CONDITIONS.map((condition) => (
              <Pressable
                key={condition}
                style={[styles.optionChip, carCondition === condition ? styles.optionChipSelected : undefined]}
                onPress={() => {
                  setCarCondition(condition);
                  markChanged();
                }}
              >
                <Text style={[styles.optionChipLabel, carCondition === condition ? styles.optionChipLabelSelected : undefined]}>
                  {t(`marketplace.create.carDetails.conditionOptions.${condition}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.fieldLabel, { textAlign }]}>{t("marketplace.create.carDetails.fuelLabel")}</Text>
          <View style={[styles.optionChipWrap, isRtl ? styles.optionChipWrapRtl : undefined]}>
            {CAR_FUEL_TYPES.map((fuelType) => (
              <Pressable
                key={fuelType}
                style={[styles.optionChip, carFuelType === fuelType ? styles.optionChipSelected : undefined]}
                onPress={() => {
                  setCarFuelType(fuelType);
                  markChanged();
                }}
              >
                <Text style={[styles.optionChipLabel, carFuelType === fuelType ? styles.optionChipLabelSelected : undefined]}>
                  {t(`marketplace.create.carDetails.fuelOptions.${fuelType}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          </View>
        ) : null}

        {specificationRows.length > 0 ? (
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { textAlign }]}>{t("marketplace.edit.specificationsReadonlyTitle")}</Text>
            <View style={styles.specificationCard}>
              <View style={[styles.specificationGrid, isRtl ? styles.specificationGridRtl : undefined]}>
                {specificationRows.map((row, index) => (
                  <View key={`${row.label}-${index}`} style={styles.specificationItem}>
                    <Text style={[styles.specificationLabel, { textAlign }]} numberOfLines={1}>
                      {row.label}
                    </Text>
                    <Text style={[styles.specificationValue, { textAlign }]} numberOfLines={2}>
                      {row.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {/* Price */}
        {shouldShowPriceInput ? (
          <View style={styles.field}>
          <Text style={[styles.fieldLabel, { textAlign }]}>{t("marketplace.edit.priceLabel")}</Text>
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
        ) : null}

        {/* Location */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { textAlign }]}>{t("marketplace.edit.locationLabel")}</Text>
          <Pressable style={styles.locationSelectorCard} onPress={openMapEditor}>
            <View style={[styles.locationSelectorHeader, isRtl ? styles.locationSelectorHeaderRtl : undefined]}>
              <MobileIcon name="location" size={16} color="#0f766e" focused />
              <Text style={[styles.locationSelectorValue, { textAlign }]} numberOfLines={2}>
                {locationName.trim() || t("marketplace.create.carDetails.locationPlaceholder")}
              </Text>
            </View>
            <View style={[styles.locationSelectorActions, isRtl ? styles.locationSelectorActionsRtl : undefined]}>
              <Text style={[styles.locationSelectorHint, { textAlign }]}>{t("marketplace.edit.locationHint")}</Text>
              <View style={styles.mapPickerAction}>
                <Text style={styles.mapPickerActionLabel}>{t("marketplace.create.carDetails.editLocationFromMap")}</Text>
              </View>
            </View>
          </Pressable>
        </View>

        {/* Images */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { textAlign }]}>{t("marketplace.edit.imagesTitle")}</Text>
          <Text style={[styles.fieldHint, { textAlign }]}>{t("marketplace.edit.imagesHint")}</Text>

          <View style={styles.imageGrid}>
            {selectedImages.map((img, index) => (
              <View key={img.localId} style={[styles.imageSlot, img.isPrimary ? styles.imageSlotPrimary : undefined]}>
                <Image source={{ uri: img.publicUrl ?? img.previewUri }} style={styles.imageThumbnail} resizeMode="cover" />
                {img.isPrimary ? (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryBadgeLabel}>{t("marketplace.create.images.primaryBadge")}</Text>
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

        <View style={[styles.submitRow, isRtl ? styles.submitRowRtl : undefined]}>
          <Pressable
            style={[styles.secondarySubmitButton, submitMode !== null ? styles.saveButtonDisabled : undefined]}
            disabled={submitMode !== null}
            onPress={() => void handleSubmit("save")}
          >
            <Text style={styles.secondarySubmitButtonLabel}>
              {submitMode === "save" ? t("marketplace.edit.savingDraft") : t("marketplace.edit.saveAction")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.saveButton, submitMode !== null ? styles.saveButtonDisabled : undefined]}
            disabled={submitMode !== null}
            onPress={() => void handleSubmit("publish")}
          >
            <Text style={styles.saveButtonLabel}>
              {submitMode === "publish" ? t("marketplace.edit.publishing") : t("marketplace.edit.publishAction")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Success overlay */}
      {showSuccess ? (
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <MobileIcon name="verified" size={42} color="#0f766e" focused />
            <Text style={styles.successText}>{t("marketplace.edit.success")}</Text>
          </View>
        </View>
      ) : null}

      {isMapEditorOpen ? (
        <View style={styles.mapEditorOverlay}>
          <View style={styles.mapEditorCard}>
            <Text style={[styles.mapEditorTitle, { textAlign }]}>{t("marketplace.create.carDetails.mapEditorTitle")}</Text>
            <Text style={[styles.mapEditorHint, { textAlign }]}>{t("marketplace.edit.mapSelectionHint")}</Text>
            <Pressable
              style={styles.mapPreviewCard}
              onLayout={(event) => setMapPreviewSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
              onPress={(event) =>
                void handleMapPress(
                  event.nativeEvent.locationX,
                  event.nativeEvent.locationY,
                  mapPreviewSize.width || 1,
                  mapPreviewSize.height || 1
                )
              }
            >
              <Image source={{ uri: mapPreviewUrl }} style={styles.mapPreviewImage} resizeMode="cover" />
              <View pointerEvents="none" style={styles.mapPinBadge}>
                <MobileIcon name="location" size={18} color="#ffffff" focused />
              </View>
            </Pressable>
            <View style={styles.mapLocationSummary}>
              <Text style={[styles.fieldLabel, { textAlign }]}>{t("marketplace.edit.locationLabel")}</Text>
              <Text style={[styles.mapLocationValue, { textAlign }]}>{mapDraftLocation.trim() || defaultLocationName}</Text>
              {isResolvingMapLocation ? <Text style={[styles.mapLocationStatus, { textAlign }]}>{t("marketplace.edit.resolvingLocation")}</Text> : null}
              {mapLocationError ? <Text style={[styles.mapLocationError, { textAlign }]}>{mapLocationError}</Text> : null}
            </View>
            <View style={[styles.mapEditorActions, isRtl ? styles.mapEditorActionsRtl : undefined]}>
              <Pressable style={styles.secondaryButton} onPress={() => setIsMapEditorOpen(false)}>
                <Text style={styles.secondaryButtonLabel}>{t("marketplace.create.flow.back")}</Text>
              </Pressable>
              <Pressable style={styles.submitButtonInline} onPress={onSaveMapEditor}>
                <Text style={styles.submitButtonInlineLabel}>{t("marketplace.create.carDetails.saveMapLocation")}</Text>
              </Pressable>
            </View>
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
  specificationCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#f8fafc",
    padding: 12,
    gap: 10
  },
  specificationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  specificationGridRtl: {
    flexDirection: "row-reverse"
  },
  specificationItem: {
    flexBasis: "48.5%",
    flexGrow: 1,
    minWidth: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 4
  },
  specificationLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b"
  },
  specificationValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a"
  },
  optionChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  optionChipWrapRtl: {
    flexDirection: "row-reverse"
  },
  optionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#ffffff"
  },
  optionChipSelected: {
    borderColor: "#0f766e",
    backgroundColor: "#ecfdf5"
  },
  optionChipLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155"
  },
  optionChipLabelSelected: {
    color: "#0f766e"
  },
  locationSelectorCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 10
  },
  locationSelectorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  locationSelectorHeaderRtl: {
    flexDirection: "row-reverse"
  },
  locationSelectorValue: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a"
  },
  locationSelectorActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  locationSelectorActionsRtl: {
    flexDirection: "row-reverse"
  },
  locationSelectorHint: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#64748b"
  },
  mapPickerAction: {
    borderRadius: 999,
    backgroundColor: "#ecfdfa",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  mapPickerActionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f766e"
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
    textAlign: "center",
    lineHeight: 14,
    paddingHorizontal: 6
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
    flex: 1,
    backgroundColor: "#0f766e",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8
  },
  submitRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8
  },
  submitRowRtl: {
    flexDirection: "row-reverse"
  },
  secondarySubmitButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    marginTop: 8
  },
  secondarySubmitButtonLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155"
  },
  saveButtonDisabled: {
    opacity: 0.55
  },
  saveButtonLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff"
  },
  mapEditorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 98
  },
  mapEditorCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    padding: 18,
    gap: 14
  },
  mapEditorTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a"
  },
  mapEditorHint: {
    fontSize: 13,
    lineHeight: 20,
    color: "#475569"
  },
  mapPreviewCard: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#e2e8f0",
    height: 220,
    position: "relative"
  },
  mapPreviewImage: {
    width: "100%",
    height: "100%"
  },
  mapPinBadge: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 34,
    height: 34,
    marginLeft: -17,
    marginTop: -30,
    borderRadius: 17,
    backgroundColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff"
  },
  mapLocationSummary: {
    gap: 6
  },
  mapLocationValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a"
  },
  mapLocationStatus: {
    fontSize: 12,
    color: "#0f766e"
  },
  mapLocationError: {
    fontSize: 12,
    color: "#dc2626"
  },
  mapEditorActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  mapEditorActionsRtl: {
    flexDirection: "row-reverse"
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff"
  },
  secondaryButtonLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155"
  },
  submitButtonInline: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f766e"
  },
  submitButtonInlineLabel: {
    fontSize: 14,
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
