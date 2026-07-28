import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import type { FollowedSellerStories, MarketplaceListing, Story, StoryMedia } from "@sanany/types";
import type { Direction } from "@sanany/utils";
import { MobileIcon } from "./mobile-icons";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

// ─── Story Avatar Ring ────────────────────────────────────────────────────────

type StoryRingProps = {
  avatarUrl: string | null;
  name: string;
  hasUnviewed: boolean;
  isOwn?: boolean;
  size?: number;
  onPress(): void;
};

export function StoryRing({ avatarUrl, name, hasUnviewed, isOwn, size = 60, onPress }: StoryRingProps) {
  const { t } = useTranslation();
  const ringColor = isOwn ? "#0f766e" : hasUnviewed ? "#0f766e" : "#cbd5e1";
  const ringWidth = isOwn || hasUnviewed ? 2.5 : 2;

  return (
    <Pressable style={styles.ringWrapper} onPress={onPress}>
      <View style={[
        styles.ring,
        {
          borderColor: ringColor,
          borderWidth: ringWidth,
          width: size + 8,
          height: size + 8,
          borderRadius: (size + 8) / 2
        }
      ]}>
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
          />
        ) : (
          <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
            <Text style={styles.avatarInitial}>
              {name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {isOwn && (
          <View style={styles.addBadge}>
            <Text style={styles.addBadgeText}>+</Text>
          </View>
        )}
      </View>
      <Text style={styles.ringLabel} numberOfLines={1}>{isOwn ? t("stories.myStory") : name}</Text>
    </Pressable>
  );
}

// ─── Stories Row ─────────────────────────────────────────────────────────────

type StoriesRowProps = {
  direction: Direction;
  followedStories: FollowedSellerStories[];
  currentUserId: string | null;
  onAddStory(): void;
  onOpenStory(sellerId: string, stories: Story[]): void;
};

export function StoriesRow({ followedStories, currentUserId, onAddStory, onOpenStory }: StoriesRowProps) {
  const { t } = useTranslation();

  const renderEmpty = () => (
    <View style={styles.emptyStoriesState}>
      <Text style={styles.emptyStoriesText}>{t("stories.noStoriesDescription")}</Text>
    </View>
  );

  return (
    <View style={styles.storiesRowContainer}>
      <FlatList
        data={followedStories}
        keyExtractor={(item) => item.sellerId}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesRowContent}
        ListHeaderComponent={
          currentUserId ? (
            <StoryRing
              avatarUrl={null}
              name={t("stories.myStory")}
              hasUnviewed={false}
              isOwn
              onPress={onAddStory}
            />
          ) : null
        }
        ListEmptyComponent={currentUserId ? renderEmpty : null}
        renderItem={({ item }) => (
          <StoryRing
            avatarUrl={item.sellerAvatarUrl}
            name={item.sellerName}
            hasUnviewed={item.hasUnviewed}
            onPress={() => onOpenStory(item.sellerId, item.stories)}
          />
        )}
      />
    </View>
  );
}

// ─── Story Viewer ─────────────────────────────────────────────────────────────

type StoryViewerProps = {
  visible: boolean;
  stories: Story[];
  initialIndex?: number;
  direction: Direction;
  onClose(): void;
  onMarkViewed(storyId: string): void;
  onOpenListing(listing: MarketplaceListing): void;
};

export function StoryViewer({
  visible,
  stories,
  initialIndex = 0,
  direction,
  onClose,
  onMarkViewed,
  onOpenListing
}: StoryViewerProps) {
  const { t } = useTranslation();
  const [currentStoryIndex, setCurrentStoryIndex] = useState(initialIndex);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showListings, setShowListings] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRtl = direction === "rtl";

  const currentStory = stories[currentStoryIndex];
  const currentMedia: StoryMedia | undefined = currentStory?.media[currentMediaIndex];
  const duration = currentMedia?.durationMs ?? 5000;

  const goNext = useCallback(() => {
    if (!currentStory) return;
    if (currentMediaIndex < currentStory.media.length - 1) {
      setCurrentMediaIndex((i) => i + 1);
    } else if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex((i) => i + 1);
      setCurrentMediaIndex(0);
    } else {
      onClose();
    }
  }, [currentStory, currentMediaIndex, currentStoryIndex, stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (currentMediaIndex > 0) {
      setCurrentMediaIndex((i) => i - 1);
    } else if (currentStoryIndex > 0) {
      setCurrentStoryIndex((i) => i - 1);
      setCurrentMediaIndex(0);
    }
  }, [currentMediaIndex, currentStoryIndex]);

  // Start progress animation for current media
  useEffect(() => {
    if (!visible || paused || !currentStory) return;
    progressAnim.setValue(0);
    if (progressTimer.current) clearTimeout(progressTimer.current);

    const anim = Animated.timing(progressAnim, {
      toValue: 1,
      duration,
      useNativeDriver: false
    });
    anim.start(({ finished }) => {
      if (finished) goNext();
    });
    onMarkViewed(currentStory.id);

    return () => {
      anim.stop();
      if (progressTimer.current) clearTimeout(progressTimer.current);
    };
  }, [visible, currentStoryIndex, currentMediaIndex, paused]);

  if (!visible || !currentStory || !currentMedia) return null;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent transparent>
      <View style={styles.viewerContainer}>
        {/* Progress bars */}
        <View style={styles.progressBars}>
          {currentStory.media.map((_, i) => (
            <View key={i} style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: i < currentMediaIndex ? "100%" :
                           i === currentMediaIndex
                             ? progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] })
                             : "0%"
                  }
                ]}
              />
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={[styles.storyHeader, isRtl ? styles.rowReverse : undefined]}>
          {currentStory.sellerAvatarUrl ? (
            <Image source={{ uri: currentStory.sellerAvatarUrl }} style={styles.storyHeaderAvatar} />
          ) : (
            <View style={styles.storyHeaderAvatarPlaceholder}>
              <Text style={styles.storyHeaderAvatarInitial}>
                {currentStory.sellerName.charAt(0)}
              </Text>
            </View>
          )}
          <Text style={styles.storyHeaderName}>{currentStory.sellerName}</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={16}>
            <MobileIcon name="close" size={22} color="white" />
          </Pressable>
        </View>

        {/* Story media */}
        <Pressable
          style={styles.viewerTapArea}
          onLongPress={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
        >
          {currentMedia.mediaType === "text" ? (
            <View style={styles.textStoryBg}>
              <Text style={styles.textStoryContent}>{currentMedia.textContent}</Text>
              {currentMedia.caption ? (
                <Text style={styles.textStoryCaption}>{currentMedia.caption}</Text>
              ) : null}
            </View>
          ) : currentMedia.mediaUrl ? (
            <Image
              source={{ uri: currentMedia.mediaUrl }}
              style={styles.storyImage}
              resizeMode="cover"
            />
          ) : null}
        </Pressable>

        {/* Left/right tap zones */}
        <Pressable style={styles.tapZoneLeft} onPress={goPrev} />
        <Pressable style={styles.tapZoneRight} onPress={goNext} />

        {/* Attached listings */}
        {currentStory.attachedListings.length > 0 && (
          <View style={styles.listingsCta}>
            <Pressable
              style={styles.viewListingsBtn}
              onPress={() => {
                if (currentStory.attachedListings.length === 1 && currentStory.attachedListings[0].listing) {
                  onOpenListing(currentStory.attachedListings[0].listing);
                } else {
                  setShowListings((v) => !v);
                }
              }}
            >
              <MobileIcon name="tag" size={16} color="white" />
              <Text style={styles.viewListingsBtnText}>
                {currentStory.attachedListings.length === 1
                  ? t("stories.viewListing")
                  : t("stories.viewListings")}
              </Text>
            </Pressable>

            {showListings && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.listingsCarousel}
                contentContainerStyle={styles.listingsCarouselContent}
              >
                {currentStory.attachedListings
                  .filter((al) => al.listing !== null)
                  .map((al) => (
                    <Pressable
                      key={al.id}
                      style={styles.listingCard}
                      onPress={() => al.listing && onOpenListing(al.listing)}
                    >
                      {al.listing?.imageUrl ? (
                        <Image source={{ uri: al.listing.imageUrl }} style={styles.listingCardImage} />
                      ) : (
                        <View style={styles.listingCardImagePlaceholder} />
                      )}
                      <Text style={styles.listingCardTitle} numberOfLines={2}>{al.listing?.title}</Text>
                      <Text style={styles.listingCardPrice}>
                        {al.listing?.price != null ? `${al.listing.price.toLocaleString()} ريال` : ""}
                      </Text>
                    </Pressable>
                  ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── Story Creator ────────────────────────────────────────────────────────────

type StoryCreatorProps = {
  visible: boolean;
  direction: Direction;
  myListings: MarketplaceListing[];
  onClose(): void;
  onPublish(params: {
    mediaType: "image" | "video" | "text";
    mediaUri?: string;
    textContent?: string;
    caption?: string;
    attachedListingIds: string[];
  }): Promise<void>;
};

type CreatorStep = "type" | "compose" | "attach" | "preview";

export function StoryCreator({ visible, direction, myListings, onClose, onPublish }: StoryCreatorProps) {
  const { t } = useTranslation();
  const isRtl = direction === "rtl";
  const textAlign = isRtl ? "right" : "left";

  const [step, setStep] = useState<CreatorStep>("type");
  const [mediaType, setMediaType] = useState<"image" | "video" | "text" | null>(null);
  const [textContent, setTextContent] = useState("");
  const [caption, setCaption] = useState("");
  const [selectedListingIds, setSelectedListingIds] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep("type");
    setMediaType(null);
    setTextContent("");
    setCaption("");
    setSelectedListingIds([]);
    setPublishing(false);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePublish = async () => {
    if (!mediaType) return;
    if (mediaType === "text" && !textContent.trim()) {
      setError(t("stories.mediaRequired"));
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      await onPublish({
        mediaType,
        textContent: mediaType === "text" ? textContent : undefined,
        caption: caption.trim() || undefined,
        attachedListingIds: selectedListingIds
      });
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.retry"));
    } finally {
      setPublishing(false);
    }
  };

  const toggleListing = (id: string) => {
    setSelectedListingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={styles.creatorContainer}>
        {/* Header */}
        <View style={[styles.creatorHeader, isRtl ? styles.rowReverse : undefined]}>
          <Pressable onPress={handleClose} hitSlop={12}>
            <MobileIcon name="close" size={22} color="#1e293b" />
          </Pressable>
          <Text style={styles.creatorTitle}>{t("stories.newStory")}</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={styles.creatorBody} keyboardShouldPersistTaps="handled">
          {/* Step: Type selection */}
          {step === "type" && (
            <View style={styles.typeGrid}>
              <Pressable
                style={styles.typeCard}
                onPress={() => { setMediaType("image"); setStep("compose"); }}
              >
                <Text style={styles.typeCardIcon}>🖼️</Text>
                <Text style={[styles.typeCardLabel, { textAlign }]}>{t("stories.uploadImage")}</Text>
              </Pressable>
              <Pressable
                style={styles.typeCard}
                onPress={() => { setMediaType("video"); setStep("compose"); }}
              >
                <Text style={styles.typeCardIcon}>🎥</Text>
                <Text style={[styles.typeCardLabel, { textAlign }]}>{t("stories.uploadVideo")}</Text>
              </Pressable>
              <Pressable
                style={styles.typeCard}
                onPress={() => { setMediaType("text"); setStep("compose"); }}
              >
                <Text style={styles.typeCardIcon}>✏️</Text>
                <Text style={[styles.typeCardLabel, { textAlign }]}>{t("stories.writeText")}</Text>
              </Pressable>
            </View>
          )}

          {/* Step: Compose */}
          {step === "compose" && mediaType && (
            <View style={styles.composeSection}>
              {mediaType === "text" && (
                <TextInput
                  style={[styles.textStoryInput, { textAlign, writingDirection: direction === "rtl" ? "rtl" : "ltr" }]}
                  multiline
                  numberOfLines={8}
                  placeholder={t("stories.typeStoryText")}
                  value={textContent}
                  onChangeText={setTextContent}
                  placeholderTextColor="#94a3b8"
                  maxLength={500}
                />
              )}
              {(mediaType === "image" || mediaType === "video") && (
                <View style={styles.mediaPickerPlaceholder}>
                  <Text style={styles.mediaPickerIcon}>📁</Text>
                  <Text style={[styles.mediaPickerHint, { textAlign }]}>{t("stories.chooseMedia")}</Text>
                </View>
              )}
              <TextInput
                style={[styles.captionInput, { textAlign, writingDirection: direction === "rtl" ? "rtl" : "ltr" }]}
                placeholder={t("stories.addCaption")}
                value={caption}
                onChangeText={setCaption}
                placeholderTextColor="#94a3b8"
                maxLength={200}
              />
              <Pressable style={styles.nextBtn} onPress={() => setStep("attach")}>
                <Text style={styles.nextBtnText}>{t("common.next")}</Text>
              </Pressable>
            </View>
          )}

          {/* Step: Attach listings */}
          {step === "attach" && (
            <View>
              <Text style={[styles.attachHeading, { textAlign }]}>{t("stories.attachListing")}</Text>
              {myListings.length === 0 ? (
                <Text style={[styles.emptyAttachText, { textAlign }]}>{t("stories.noListingsToAttach")}</Text>
              ) : (
                myListings.map((listing) => {
                  const isSelected = selectedListingIds.includes(listing.id);
                  return (
                    <Pressable
                      key={listing.id}
                      style={[styles.attachListingRow, isSelected && styles.attachListingRowSelected]}
                      onPress={() => toggleListing(listing.id)}
                    >
                      {listing.imageUrl ? (
                        <Image source={{ uri: listing.imageUrl }} style={styles.attachListingImage} />
                      ) : (
                        <View style={styles.attachListingImagePlaceholder} />
                      )}
                      <View style={styles.attachListingInfo}>
                        <Text style={[styles.attachListingTitle, { textAlign }]} numberOfLines={2}>{listing.title}</Text>
                        <Text style={[styles.attachListingPrice, { textAlign }]}>
                          {listing.price?.toLocaleString()} {direction === "rtl" ? "ريال" : "SAR"}
                        </Text>
                      </View>
                      <View style={[styles.attachCheckbox, isSelected && styles.attachCheckboxSelected]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    </Pressable>
                  );
                })
              )}
              <Pressable style={styles.nextBtn} onPress={() => setStep("preview")}>
                <Text style={styles.nextBtnText}>{t("common.next")}</Text>
              </Pressable>
            </View>
          )}

          {/* Step: Preview + Publish */}
          {step === "preview" && (
            <View style={styles.previewSection}>
              <View style={styles.previewCard}>
                {mediaType === "text" && textContent ? (
                  <View style={styles.previewTextBg}>
                    <Text style={styles.previewTextContent}>{textContent}</Text>
                  </View>
                ) : (
                  <View style={styles.previewMediaPlaceholder}>
                    <Text style={styles.previewMediaIcon}>{mediaType === "image" ? "🖼️" : "🎥"}</Text>
                  </View>
                )}
                {caption ? (
                  <Text style={[styles.previewCaption, { textAlign }]}>{caption}</Text>
                ) : null}
                {selectedListingIds.length > 0 && (
                  <View style={styles.previewListingsBadge}>
                    <Text style={styles.previewListingsBadgeText}>
                      🏷️ {selectedListingIds.length} {t("stories.attachedListings")}
                    </Text>
                  </View>
                )}
              </View>

              {error ? (
                <Text style={[styles.errorText, { textAlign }]}>{error}</Text>
              ) : null}

              <Pressable
                style={[styles.publishBtn, publishing && styles.publishBtnDisabled]}
                onPress={handlePublish}
                disabled={publishing}
              >
                <Text style={styles.publishBtnText}>
                  {publishing ? t("stories.publishing") : t("stories.publishStory")}
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Ring
  ringWrapper: { alignItems: "center", marginHorizontal: 6 },
  ring: { padding: 3, justifyContent: "center", alignItems: "center" },
  avatar: {},
  avatarPlaceholder: {
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center"
  },
  avatarInitial: { fontSize: 22, fontWeight: "700", color: "#64748b" },
  addBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#0f766e",
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "white"
  },
  addBadgeText: { color: "white", fontSize: 12, fontWeight: "700", lineHeight: 14 },
  ringLabel: { fontSize: 11, color: "#475569", marginTop: 4, maxWidth: 68, textAlign: "center" },

  // Stories row
  storiesRowContainer: { backgroundColor: "white", paddingVertical: 12 },
  storiesRowContent: { paddingHorizontal: 12, alignItems: "center" },
  emptyStoriesState: { paddingHorizontal: 16 },
  emptyStoriesText: { fontSize: 13, color: "#94a3b8", maxWidth: 240 },

  // Viewer
  viewerContainer: { flex: 1, backgroundColor: "black" },
  progressBars: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 52,
    zIndex: 10
  },
  progressTrack: {
    flex: 1,
    height: 2.5,
    backgroundColor: "rgba(255,255,255,0.35)",
    borderRadius: 2,
    overflow: "hidden"
  },
  progressFill: { height: "100%", backgroundColor: "white" },
  storyHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 10,
    zIndex: 10
  },
  rowReverse: { flexDirection: "row-reverse" },
  storyHeaderAvatar: { width: 36, height: 36, borderRadius: 18 },
  storyHeaderAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center"
  },
  storyHeaderAvatarInitial: { color: "white", fontSize: 16, fontWeight: "700" },
  storyHeaderName: { flex: 1, color: "white", fontSize: 14, fontWeight: "600" },
  closeBtn: { padding: 4 },
  viewerTapArea: { flex: 1, justifyContent: "center", alignItems: "center" },
  storyImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.75 },
  textStoryBg: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.72,
    backgroundColor: "#0f766e",
    justifyContent: "center",
    alignItems: "center",
    padding: 32
  },
  textStoryContent: { color: "white", fontSize: 24, fontWeight: "700", textAlign: "center", lineHeight: 36 },
  textStoryCaption: { color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 16, textAlign: "center" },
  tapZoneLeft: { position: "absolute", left: 0, top: "20%", width: SCREEN_WIDTH * 0.35, height: "60%" },
  tapZoneRight: { position: "absolute", right: 0, top: "20%", width: SCREEN_WIDTH * 0.35, height: "60%" },
  listingsCta: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 12
  },
  viewListingsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)"
  },
  viewListingsBtnText: { color: "white", fontSize: 14, fontWeight: "600" },
  listingsCarousel: { maxHeight: 160 },
  listingsCarouselContent: { paddingHorizontal: 16, gap: 10 },
  listingCard: {
    width: 110,
    backgroundColor: "white",
    borderRadius: 10,
    overflow: "hidden"
  },
  listingCardImage: { width: 110, height: 70 },
  listingCardImagePlaceholder: { width: 110, height: 70, backgroundColor: "#e2e8f0" },
  listingCardTitle: { fontSize: 11, fontWeight: "600", color: "#1e293b", padding: 6, paddingBottom: 2, lineHeight: 15 },
  listingCardPrice: { fontSize: 12, color: "#0f766e", fontWeight: "700", paddingHorizontal: 6, paddingBottom: 6 },

  // Creator
  creatorContainer: { flex: 1, backgroundColor: "#f8fafc" },
  creatorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9"
  },
  creatorTitle: { fontSize: 17, fontWeight: "700", color: "#1e293b" },
  creatorBody: { padding: 16, gap: 16 },
  typeGrid: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  typeCard: {
    flex: 1,
    minWidth: "28%",
    backgroundColor: "white",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2
  },
  typeCardIcon: { fontSize: 32 },
  typeCardLabel: { fontSize: 13, fontWeight: "600", color: "#334155" },
  composeSection: { gap: 12 },
  textStoryInput: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 160,
    color: "#1e293b",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    textAlignVertical: "top"
  },
  mediaPickerPlaceholder: {
    backgroundColor: "white",
    borderRadius: 12,
    height: 180,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderStyle: "dashed"
  },
  mediaPickerIcon: { fontSize: 40 },
  mediaPickerHint: { fontSize: 14, color: "#64748b", marginTop: 10 },
  captionInput: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#1e293b",
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  nextBtn: {
    backgroundColor: "#0f766e",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8
  },
  nextBtnText: { color: "white", fontSize: 15, fontWeight: "700" },
  attachHeading: { fontSize: 16, fontWeight: "700", color: "#1e293b", marginBottom: 12 },
  emptyAttachText: { fontSize: 14, color: "#94a3b8", marginBottom: 20 },
  attachListingRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    gap: 12,
    borderWidth: 2,
    borderColor: "transparent"
  },
  attachListingRowSelected: { borderColor: "#0f766e", backgroundColor: "#f0fdfb" },
  attachListingImage: { width: 56, height: 56, borderRadius: 8 },
  attachListingImagePlaceholder: { width: 56, height: 56, borderRadius: 8, backgroundColor: "#e2e8f0" },
  attachListingInfo: { flex: 1 },
  attachListingTitle: { fontSize: 13, fontWeight: "600", color: "#1e293b" },
  attachListingPrice: { fontSize: 13, color: "#0f766e", fontWeight: "700", marginTop: 2 },
  attachCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    justifyContent: "center",
    alignItems: "center"
  },
  attachCheckboxSelected: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  checkmark: { color: "white", fontSize: 13, fontWeight: "700" },
  previewSection: { gap: 16 },
  previewCard: {
    backgroundColor: "white",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 3
  },
  previewTextBg: {
    backgroundColor: "#0f766e",
    minHeight: 200,
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  previewTextContent: { color: "white", fontSize: 20, fontWeight: "700", textAlign: "center" },
  previewMediaPlaceholder: {
    height: 200,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center"
  },
  previewMediaIcon: { fontSize: 48 },
  previewCaption: { fontSize: 14, color: "#475569", padding: 12 },
  previewListingsBadge: {
    backgroundColor: "#f0fdfb",
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0"
  },
  previewListingsBadgeText: { fontSize: 13, color: "#0f766e", fontWeight: "600" },
  errorText: { color: "#ef4444", fontSize: 13 },
  publishBtn: {
    backgroundColor: "#0f766e",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center"
  },
  publishBtnDisabled: { opacity: 0.6 },
  publishBtnText: { color: "white", fontSize: 15, fontWeight: "700" }
});
