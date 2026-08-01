import { useEffect, useMemo, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Animated, Image, PanResponder, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { getPrimaryListingImageUrl } from "@sanany/shared";
import type { MarketplaceListing } from "@sanany/types";
import { type Direction } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { consumePendingChatListingIntent } from "../lib/chat-intent-store";
import { getMobileSellersRepository } from "../lib/sellers-repository";

type ChatScreenProps = {
  direction: Direction;
  openListingIntent?: MarketplaceListing | null;
  onIntentHandled?(): void;
  onUnreadCountChange?(count: number): void;
  onThreadOpenChange?(isOpen: boolean): void;
};

type ChatFilter = "all" | "seller" | "buyer";

type ChatThread = {
  id: string;
  kind: "seller" | "buyer";
  name: string;
  listingTitle: string;
  lastMessage: string;
  minutesAgo: number;
  unreadCount: number;
  imageUrl: string | null;
  isOfficial?: boolean;
};

type ChatMessage = {
  id: string;
  from: "me" | "other";
  text: string;
};

const HIDDEN_THREADS_STORAGE_KEY = "sanany:hidden-chat-threads";
const READ_THREADS_STORAGE_KEY = "sanany:read-chat-threads";
const CHAT_OPEN_INTENT_STORAGE_KEY = "sanany:chat-open-intent";
const CHAT_OPEN_THREAD_STORAGE_KEY = "sanany:chat-open-thread-id";
const SWIPE_ACTION_WIDTH = 92;

type SwipeableThreadCardProps = {
  direction: Direction;
  thread: ChatThread;
  onOpen(thread: ChatThread): void;
  onDelete(threadId: string): void;
};

function SwipeableThreadCard({ direction, thread, onOpen, onDelete }: SwipeableThreadCardProps) {
  const { t } = useTranslation();
  const isRtl = direction === "rtl";
  const textAlign = isRtl ? "right" : "left";
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpenRef = useRef(false);
  const actionDirection = isRtl ? 1 : -1;
  const openValue = SWIPE_ACTION_WIDTH * actionDirection;
  const canDelete = !thread.isOfficial;

  const closeRow = () => {
    Animated.timing(translateX, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true
    }).start(() => {
      isOpenRef.current = false;
    });
  };

  const openRow = () => {
    Animated.timing(translateX, {
      toValue: openValue,
      duration: 140,
      useNativeDriver: true
    }).start(() => {
      isOpenRef.current = true;
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => canDelete,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => {
        const nextRaw = gesture.dx;
        const min = Math.min(0, openValue);
        const max = Math.max(0, openValue);
        const next = Math.min(max, Math.max(min, nextRaw));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const shouldOpen = isRtl ? gesture.dx > SWIPE_ACTION_WIDTH * 0.45 : gesture.dx < -SWIPE_ACTION_WIDTH * 0.45;
        if (shouldOpen) {
          openRow();
        } else {
          closeRow();
        }
      },
      onPanResponderTerminate: closeRow
    })
  ).current;

  if (!canDelete) {
    return (
      <Pressable style={[styles.threadCard, thread.isOfficial ? styles.officialCard : undefined]} onPress={() => onOpen(thread)}>
        <View style={[styles.threadRow, isRtl ? styles.threadRowRtl : undefined]}>
          <View style={styles.threadMeta}>
            <Text style={[styles.threadName, { textAlign }]} numberOfLines={1}>
              {thread.name}
            </Text>
            <Text style={[styles.threadListing, { textAlign }]} numberOfLines={1}>
              {thread.listingTitle}
            </Text>
            <Text style={[styles.threadMessage, { textAlign }]} numberOfLines={1}>
              {thread.lastMessage}
            </Text>
          </View>

          <View style={styles.imageWrap}>
            {thread.imageUrl ? (
              <Image source={{ uri: thread.imageUrl }} style={styles.threadImage} resizeMode="cover" />
            ) : (
              <View style={styles.logoCard}>
                <Text style={styles.logoTitle}>{t("chat.official.logoTitle")}</Text>
                <Text style={styles.logoSubtitle}>{t("chat.official.logoSubtitle")}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={[styles.metaRow, isRtl ? styles.metaRowRtl : undefined]}>
          <Text style={styles.timeLabel}>{t("chat.minutesAgo", { count: thread.minutesAgo })}</Text>
          {thread.unreadCount > 0 ? (
            <View style={styles.unreadDot}>
              <Text style={styles.unreadDotLabel}>{thread.unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.swipeContainer}>
      <View style={[styles.deleteActionWrap, isRtl ? styles.deleteActionWrapRtl : undefined]}>
        <Pressable
          style={styles.deleteActionButton}
          onPress={() => {
            closeRow();
            onDelete(thread.id);
          }}
        >
          <Ionicons name="trash-outline" size={18} color="#ffffff" />
          <Text style={styles.deleteActionLabel}>{t("chat.deleteAction")}</Text>
        </Pressable>
      </View>

      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <Pressable
          style={[styles.threadCard, thread.isOfficial ? styles.officialCard : undefined]}
          onPress={() => {
            if (isOpenRef.current) {
              closeRow();
              return;
            }
            onOpen(thread);
          }}
        >
          <View style={[styles.threadRow, isRtl ? styles.threadRowRtl : undefined]}>
            <View style={styles.threadMeta}>
              <Text style={[styles.threadName, { textAlign }]} numberOfLines={1}>
                {thread.name}
              </Text>
              <Text style={[styles.threadListing, { textAlign }]} numberOfLines={1}>
                {thread.listingTitle}
              </Text>
              <Text style={[styles.threadMessage, { textAlign }]} numberOfLines={1}>
                {thread.lastMessage}
              </Text>
            </View>

            <View style={styles.imageWrap}>
              {thread.imageUrl ? (
                <Image source={{ uri: thread.imageUrl }} style={styles.threadImage} resizeMode="cover" />
              ) : (
                <View style={styles.logoCard}>
                  <Text style={styles.logoTitle}>{t("chat.official.logoTitle")}</Text>
                  <Text style={styles.logoSubtitle}>{t("chat.official.logoSubtitle")}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={[styles.metaRow, isRtl ? styles.metaRowRtl : undefined]}>
            <Text style={styles.timeLabel}>{t("chat.minutesAgo", { count: thread.minutesAgo })}</Text>
            {thread.unreadCount > 0 ? (
              <View style={styles.unreadDot}>
                <Text style={styles.unreadDotLabel}>{thread.unreadCount}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function ChatScreen({ direction, openListingIntent = null, onIntentHandled, onUnreadCountChange, onThreadOpenChange }: ChatScreenProps) {
  const { t } = useTranslation();
  const { snapshot, accountProfile } = useAuth();
  const sellersRepository = useMemo(() => getMobileSellersRepository(), []);
  const isRtl = direction === "rtl";
  const textAlign = isRtl ? "right" : "left";
  const [activeFilter, setActiveFilter] = useState<ChatFilter>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [listingThreads, setListingThreads] = useState<ChatThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [threadMessages, setThreadMessages] = useState<Record<string, ChatMessage[]>>({});
  const [composerText, setComposerText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hiddenThreadIds, setHiddenThreadIds] = useState<string[]>([]);
  const [readThreadIds, setReadThreadIds] = useState<string[]>([]);
  const [forcedVisibleThreadId, setForcedVisibleThreadId] = useState<string | null>(null);
  const [storageListingIntent, setStorageListingIntent] = useState<MarketplaceListing | null>(null);
  const [runtimeListingIntent, setRuntimeListingIntent] = useState<MarketplaceListing | null>(() => consumePendingChatListingIntent());

  const activeListingIntent = openListingIntent ?? storageListingIntent ?? runtimeListingIntent;

  useEffect(() => {
    void AsyncStorage.getItem(HIDDEN_THREADS_STORAGE_KEY).then((raw) => {
      if (!raw) {
        return;
      }

      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setHiddenThreadIds(parsed.filter((item): item is string => typeof item === "string"));
        }
      } catch {
        setHiddenThreadIds([]);
      }
    });
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(READ_THREADS_STORAGE_KEY).then((raw) => {
      if (!raw) {
        return;
      }

      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setReadThreadIds(parsed.filter((item): item is string => typeof item === "string"));
        }
      } catch {
        setReadThreadIds([]);
      }
    });
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(CHAT_OPEN_INTENT_STORAGE_KEY).then((raw) => {
      if (!raw) {
        return;
      }
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed === "object" && parsed !== null && "id" in parsed && typeof parsed.id === "string") {
          setStorageListingIntent(parsed as MarketplaceListing);
        }
      } catch {}
      void AsyncStorage.removeItem(CHAT_OPEN_INTENT_STORAGE_KEY);
    });
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(CHAT_OPEN_THREAD_STORAGE_KEY).then((raw) => {
      if (!raw) {
        return;
      }
      const threadId = `listing-${raw}`;
      setForcedVisibleThreadId(threadId);
      setActiveFilter("buyer");
      setUnreadOnly(false);
      setHiddenThreadIds((current) => {
        if (!current.includes(threadId)) {
          return current;
        }
        const next = current.filter((id) => id !== threadId);
        void AsyncStorage.setItem(HIDDEN_THREADS_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      void AsyncStorage.removeItem(CHAT_OPEN_THREAD_STORAGE_KEY);
    });
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setListingThreads([]);
    setThreadMessages({});
    setSelectedThread(null);
    setForcedVisibleThreadId(null);
    setHiddenThreadIds([]);
    setReadThreadIds([]);
    void AsyncStorage.multiRemove([HIDDEN_THREADS_STORAGE_KEY, READ_THREADS_STORAGE_KEY, CHAT_OPEN_INTENT_STORAGE_KEY, CHAT_OPEN_THREAD_STORAGE_KEY]).finally(
      () => {
        setIsLoading(false);
      }
    );
  }, []);

  useEffect(() => {
    if (!activeListingIntent) {
      return;
    }

    let isCancelled = false;
    const fallbackName = resolveListingThreadName(activeListingIntent, t);
    const intentThread = mapListingToThread(activeListingIntent, t, snapshot.user?.id ?? null, fallbackName);
    setForcedVisibleThreadId(intentThread.id);
    setListingThreads((current) => {
      const withoutSame = current.filter((item) => item.id !== intentThread.id);
      return [intentThread, ...withoutSame];
    });

    setHiddenThreadIds((current) => {
      if (!current.includes(intentThread.id)) {
        return current;
      }
      const nextHidden = current.filter((id) => id !== intentThread.id);
      void AsyncStorage.setItem(HIDDEN_THREADS_STORAGE_KEY, JSON.stringify(nextHidden));
      return nextHidden;
    });
    void AsyncStorage.getItem(HIDDEN_THREADS_STORAGE_KEY).then((raw) => {
      if (!raw) {
        return;
      }
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
          return;
        }
        const persisted = parsed.filter((item): item is string => typeof item === "string");
        if (!persisted.includes(intentThread.id)) {
          return;
        }
        const nextHidden = persisted.filter((id) => id !== intentThread.id);
        setHiddenThreadIds((current) => current.filter((id) => id !== intentThread.id));
        void AsyncStorage.setItem(HIDDEN_THREADS_STORAGE_KEY, JSON.stringify(nextHidden));
      } catch {}
    });

    setThreadMessages((current) => {
      if (current[intentThread.id]) {
        return current;
      }

      return {
        ...current,
        [intentThread.id]: []
      };
    });
    setSelectedThread(intentThread);
    setComposerText("");
    setActiveFilter(intentThread.kind);
    setUnreadOnly(false);
    setReadThreadIds((current) => {
      if (current.includes(intentThread.id)) {
        return current;
      }
      const nextReadThreadIds = [...current, intentThread.id];
      void AsyncStorage.setItem(READ_THREADS_STORAGE_KEY, JSON.stringify(nextReadThreadIds));
      return nextReadThreadIds;
    });
    setStorageListingIntent(null);
    setRuntimeListingIntent(null);
    onIntentHandled?.();

    if (!activeListingIntent.ownerId || activeListingIntent.ownerId === snapshot.user?.id) {
      const ownDisplayName = accountProfile?.displayName?.trim() || "";
      const ownUsername = accountProfile?.username?.trim() || "";
      const ownThreadName = formatThreadIdentity(ownDisplayName, ownUsername, fallbackName);
      if (ownThreadName !== fallbackName) {
        setListingThreads((current) => current.map((thread) => (thread.id === intentThread.id ? { ...thread, name: ownThreadName } : thread)));
        setSelectedThread((current) => (current?.id === intentThread.id ? { ...current, name: ownThreadName } : current));
      } else if (snapshot.user?.id) {
        void sellersRepository
          .getProfile(snapshot.user.id, snapshot.user.id)
          .then((profile) => {
            if (isCancelled || !profile) {
              return;
            }
            const resolvedOwnName = formatThreadIdentity(profile.displayName?.trim() || "", profile.username?.trim() || "", fallbackName);
            if (!resolvedOwnName || resolvedOwnName === fallbackName) {
              return;
            }
            setListingThreads((current) => current.map((thread) => (thread.id === intentThread.id ? { ...thread, name: resolvedOwnName } : thread)));
            setSelectedThread((current) => (current?.id === intentThread.id ? { ...current, name: resolvedOwnName } : current));
          })
          .catch(() => {
            // Keep fallback when own profile cannot be loaded.
          });
      }
    } else if (activeListingIntent.ownerId && activeListingIntent.ownerId !== snapshot.user?.id) {
      void sellersRepository
        .getProfile(activeListingIntent.ownerId, snapshot.user?.id ?? null)
        .then((profile) => {
          const sellerName = formatThreadIdentity(profile?.displayName?.trim() || "", profile?.username?.trim() || "", fallbackName);
          if (!sellerName || sellerName === fallbackName) {
            return;
          }
          setListingThreads((current) => current.map((thread) => (thread.id === intentThread.id ? { ...thread, name: sellerName } : thread)));
          setSelectedThread((current) => (current?.id === intentThread.id ? { ...current, name: sellerName } : current));
        })
        .catch(() => {
          // Keep the translated fallback name if seller profile couldn't be loaded.
        });
    }

    return () => {
      isCancelled = true;
    };
  }, [activeListingIntent, accountProfile?.displayName, accountProfile?.username, onIntentHandled, sellersRepository, snapshot.user?.id, t]);

  const threads = useMemo<ChatThread[]>(
    () =>
      listingThreads.map((thread) => ({
        ...thread,
        unreadCount: readThreadIds.includes(thread.id) ? 0 : thread.unreadCount
      })),
    [listingThreads, readThreadIds]
  );

  const filteredThreads = threads.filter((thread) => {
    if (activeFilter !== "all" && thread.kind !== activeFilter) {
      return false;
    }

    if (unreadOnly && thread.unreadCount <= 0) {
      return false;
    }

    return true;
  });
  const visibleThreads = filteredThreads.filter(
    (thread) => thread.id === "official" || thread.id === forcedVisibleThreadId || !hiddenThreadIds.includes(thread.id)
  );

  useEffect(() => {
    const totalUnread = threads.reduce((sum, thread) => sum + thread.unreadCount, 0);
    onUnreadCountChange?.(totalUnread);
  }, [onUnreadCountChange, threads]);

  useEffect(() => {
    onThreadOpenChange?.(selectedThread !== null);
  }, [onThreadOpenChange, selectedThread]);

  const openThread = (thread: ChatThread) => {
    if (!readThreadIds.includes(thread.id)) {
      const nextReadThreadIds = [...readThreadIds, thread.id];
      setReadThreadIds(nextReadThreadIds);
      void AsyncStorage.setItem(READ_THREADS_STORAGE_KEY, JSON.stringify(nextReadThreadIds));
    }

    setThreadMessages((current) => {
      if (current[thread.id]) {
        return current;
      }

      return {
        ...current,
        [thread.id]: []
      };
    });
    setSelectedThread(thread);
  };

  const sendMessage = () => {
    if (!selectedThread) {
      return;
    }

    const text = composerText.trim();
    if (!text) {
      return;
    }

    setThreadMessages((current) => ({
      ...current,
      [selectedThread.id]: [
        ...(current[selectedThread.id] ?? []),
        {
          id: `msg-${Date.now()}`,
          from: "me",
          text
        }
      ]
    }));
    setComposerText("");
  };

  const deleteThread = (threadId: string) => {
    if (threadId === "official") {
      return;
    }

    const nextHiddenIds = hiddenThreadIds.includes(threadId) ? hiddenThreadIds : [...hiddenThreadIds, threadId];
    setHiddenThreadIds(nextHiddenIds);
    void AsyncStorage.setItem(HIDDEN_THREADS_STORAGE_KEY, JSON.stringify(nextHiddenIds));
    setThreadMessages((current) => {
      const next = { ...current };
      delete next[threadId];
      return next;
    });
    if (selectedThread?.id === threadId) {
      setSelectedThread(null);
    }
    if (forcedVisibleThreadId === threadId) {
      setForcedVisibleThreadId(null);
    }
  };

  if (selectedThread) {
    const quickReplies = [t("chat.detail.quickReplies.duration"), t("chat.detail.quickReplies.finalPrice"), t("chat.detail.quickReplies.latest")];
    const detailMessages = threadMessages[selectedThread.id] ?? [];

    return (
      <View style={styles.detailContainer}>
        <View style={[styles.detailHeader, isRtl ? styles.detailHeaderRtl : undefined]}>
          <Pressable style={styles.headerIconBtn}>
            <Ionicons name="call-outline" size={22} color="#52525b" />
          </Pressable>

          <View style={[styles.detailCenter, isRtl ? styles.detailCenterRtl : undefined]}>
            <View style={styles.detailMeta}>
              <Text style={[styles.detailName, { textAlign }]} numberOfLines={1}>
                {selectedThread.name}
              </Text>
              <Text style={[styles.detailListing, { textAlign }]} numberOfLines={1}>
                {selectedThread.listingTitle}
              </Text>
            </View>
            <View style={styles.detailThumbWrap}>
              {selectedThread.imageUrl ? (
                <Image source={{ uri: selectedThread.imageUrl }} style={styles.detailThumb} resizeMode="cover" />
              ) : (
                <View style={styles.logoCard}>
                  <Text style={styles.logoTitle}>{t("chat.official.logoTitle")}</Text>
                  <Text style={styles.logoSubtitle}>{t("chat.official.logoSubtitle")}</Text>
                </View>
              )}
            </View>
          </View>

          <Pressable
            style={styles.headerIconBtn}
            onPress={() => {
              setSelectedThread(null);
            }}
          >
            <Ionicons name={isRtl ? "chevron-back" : "chevron-forward"} size={24} color="#52525b" />
          </Pressable>
        </View>

        <View style={styles.messagesArea}>
          <View style={styles.messagesSpacer} />
          <View style={styles.messagesList}>
            {detailMessages.map((message) => (
              <View key={message.id} style={[styles.bubbleWrap, message.from === "me" ? styles.bubbleWrapMe : styles.bubbleWrapOther]}>
                <View style={[styles.bubble, message.from === "me" ? styles.bubbleMe : styles.bubbleOther]}>
                  <Text style={[styles.bubbleText, message.from === "me" ? styles.bubbleTextMe : undefined, { textAlign: message.from === "me" ? (isRtl ? "right" : "left") : isRtl ? "left" : "right" }]}>
                    {message.text}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.quickRepliesRow, isRtl ? styles.quickRepliesRowRtl : undefined]}>
          {quickReplies.map((reply) => (
            <Pressable key={reply} style={styles.quickReplyChip}>
              <Text style={styles.quickReplyLabel}>{reply}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.composerRow, isRtl ? styles.composerRowRtl : undefined]}>
          <View style={[styles.composerInputWrap, isRtl ? styles.composerInputWrapRtl : undefined]}>
            <Ionicons name="attach-outline" size={20} color="#44403c" />
            <Ionicons name="image-outline" size={20} color="#44403c" />
            <TextInput
              style={[styles.composerInput, { textAlign }]}
              value={composerText}
              onChangeText={setComposerText}
              placeholder={t("chat.detail.inputPlaceholder")}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
          </View>
          <Pressable
            style={styles.micButton}
            onPress={sendMessage}
          >
            <Ionicons name={composerText.trim().length > 0 ? "send" : "mic-outline"} size={24} color="#ffffff" />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.tabsRow, isRtl ? styles.tabsRowRtl : undefined]}>
        {(["all", "seller", "buyer"] as const).map((filter) => (
          <Pressable key={filter} style={styles.tabButton} onPress={() => setActiveFilter(filter)}>
            <Text style={[styles.tabLabel, activeFilter === filter ? styles.tabLabelActive : undefined]}>{t(`chat.filters.${filter}`)}</Text>
            {activeFilter === filter ? <View style={styles.tabIndicator} /> : null}
          </Pressable>
        ))}
      </View>

      <View style={[styles.unreadCard, isRtl ? styles.unreadCardRtl : undefined]}>
        <Switch
          trackColor={{ false: "#d1d5db", true: "#0f766e" }}
          thumbColor="#ffffff"
          ios_backgroundColor="#d1d5db"
          value={unreadOnly}
          onValueChange={setUnreadOnly}
        />
        <Text style={styles.unreadLabel}>{t("chat.unreadOnly")}</Text>
      </View>

      {isLoading ? <Text style={[styles.infoText, { textAlign }]}>{t("common.loading")}</Text> : null}
      {error ? <Text style={[styles.errorText, { textAlign }]}>{error}</Text> : null}
      {!isLoading && !error && visibleThreads.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={[styles.emptyTitle, { textAlign }]}>{t("chat.emptyTitle")}</Text>
          <Text style={[styles.emptyHint, { textAlign }]}>{t("chat.emptyHint")}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {visibleThreads.map((thread) => (
          <SwipeableThreadCard key={thread.id} direction={direction} thread={thread} onOpen={openThread} onDelete={deleteThread} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  tabsRow: {
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db"
  },
  tabsRowRtl: {
    flexDirection: "row-reverse"
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151"
  },
  tabLabelActive: {
    color: "#0f766e"
  },
  tabIndicator: {
    marginTop: 8,
    width: "100%",
    height: 4,
    borderRadius: 999,
    backgroundColor: "#84c79c"
  },
  unreadCard: {
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  unreadCardRtl: {
    flexDirection: "row-reverse"
  },
  unreadLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151"
  },
  infoText: {
    marginBottom: 8,
    fontSize: 13,
    color: "#475569"
  },
  errorText: {
    marginBottom: 8,
    fontSize: 13,
    color: "#b91c1c"
  },
  emptyCard: {
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f2937"
  },
  emptyHint: {
    fontSize: 13,
    color: "#6b7280"
  },
  listContent: {
    gap: 8,
    paddingBottom: 8
  },
  swipeContainer: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 12
  },
  deleteActionWrap: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: SWIPE_ACTION_WIDTH,
    justifyContent: "center",
    alignItems: "center"
  },
  deleteActionWrapRtl: {
    right: undefined,
    left: 0
  },
  deleteActionButton: {
    height: "100%",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#dc2626"
  },
  deleteActionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff"
  },
  threadCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 10
  },
  officialCard: {
    backgroundColor: "#def2ea"
  },
  threadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  threadRowRtl: {
    flexDirection: "row-reverse"
  },
  threadMeta: {
    flex: 1
  },
  threadName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827"
  },
  threadListing: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "600",
    color: "#0f766e"
  },
  threadMessage: {
    marginTop: 2,
    fontSize: 13,
    color: "#6b7280"
  },
  imageWrap: {
    width: 116,
    height: 74,
    borderRadius: 10,
    overflow: "hidden"
  },
  threadImage: {
    width: "100%",
    height: "100%"
  },
  logoCard: {
    flex: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff"
  },
  logoTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1f2937"
  },
  logoSubtitle: {
    marginTop: -2,
    fontSize: 11,
    fontWeight: "700",
    color: "#1f2937"
  },
  metaRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  metaRowRtl: {
    flexDirection: "row-reverse"
  },
  timeLabel: {
    fontSize: 13,
    color: "#6b7280"
  },
  unreadDot: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e11d48"
  },
  unreadDotLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#ffffff"
  },
  detailContainer: {
    flex: 1,
    backgroundColor: "#ffffff"
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  detailHeaderRtl: {
    flexDirection: "row-reverse"
  },
  headerIconBtn: {
    width: 34,
    alignItems: "center",
    justifyContent: "center"
  },
  detailCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8
  },
  detailCenterRtl: {
    flexDirection: "row-reverse"
  },
  detailMeta: {
    flex: 1
  },
  detailName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f2937"
  },
  detailListing: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "600",
    color: "#0f766e"
  },
  detailThumbWrap: {
    width: 72,
    height: 46,
    borderRadius: 8,
    overflow: "hidden"
  },
  detailThumb: {
    width: "100%",
    height: "100%"
  },
  messagesArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingBottom: 8
  },
  messagesSpacer: {
    flex: 1
  },
  messagesList: {
    gap: 10
  },
  bubbleWrap: {
    width: "100%"
  },
  bubbleWrapMe: {
    alignItems: "flex-end"
  },
  bubbleWrapOther: {
    alignItems: "flex-start"
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  bubbleMe: {
    backgroundColor: "#0f766e"
  },
  bubbleOther: {
    backgroundColor: "#f0fdfa",
    borderWidth: 1,
    borderColor: "#ccfbf1"
  },
  bubbleText: {
    fontSize: 15,
    color: "#1f2937"
  },
  bubbleTextMe: {
    color: "#ffffff"
  },
  quickRepliesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  quickRepliesRowRtl: {
    flexDirection: "row-reverse"
  },
  quickReplyChip: {
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  quickReplyLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3f3f46"
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 10,
    paddingBottom: 12,
    paddingTop: 2
  },
  composerRowRtl: {
    flexDirection: "row-reverse"
  },
  composerInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 18,
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 10
  },
  composerInputWrapRtl: {
    flexDirection: "row-reverse"
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    fontSize: 16,
    color: "#111827"
  },
  micButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#0f766e"
  }
});

function mapListingToThread(
  listing: MarketplaceListing,
  t: (key: string, options?: Record<string, unknown>) => string,
  currentUserId: string | null,
  threadName: string
): ChatThread {
  const firstImage = getPrimaryListingImageUrl(listing.imageUrl);

  const rawMinutes = Math.floor((Date.now() - new Date(listing.createdAt).getTime()) / (1000 * 60));
  const minutesAgo = Number.isFinite(rawMinutes) && rawMinutes > 0 ? rawMinutes : 1;

  return {
    id: `listing-${listing.id}`,
    kind: listing.ownerId && currentUserId && listing.ownerId === currentUserId ? "seller" : "buyer",
    name: threadName,
    listingTitle: listing.title,
    lastMessage: t("chat.listingMessage"),
    minutesAgo,
    unreadCount: 1,
    imageUrl: firstImage
  };
}

function resolveListingThreadName(listing: MarketplaceListing, t: (key: string, options?: Record<string, unknown>) => string): string {
  return t("chat.threadName", { id: listing.id.slice(0, 4).toUpperCase() });
}

function formatThreadIdentity(displayName: string, username: string, fallback: string): string {
  const cleanName = displayName.trim();
  const cleanUsername = username.trim().replace(/^@+/, "");
  if (cleanName && cleanUsername) {
    return `${cleanName} • @${cleanUsername}`;
  }
  if (cleanName) {
    return cleanName;
  }
  if (cleanUsername) {
    return `@${cleanUsername}`;
  }
  return fallback;
}
