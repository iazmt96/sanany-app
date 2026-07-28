"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import type { FollowedSellerStories, Story } from "@sanany/types";

// ── Story ring component ──────────────────────────────────────────────────────

function StoryRingWeb({
  imageUrl,
  name,
  hasUnread,
  isMe,
  onClick
}: {
  imageUrl?: string | null;
  name: string;
  hasUnread: boolean;
  isMe?: boolean;
  onClick(): void;
}) {
  const initials = name.charAt(0).toUpperCase();
  const ringClass = hasUnread
    ? "ring-2 ring-offset-2 ring-teal-600"
    : "ring-2 ring-offset-2 ring-slate-300";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 min-w-[68px] group"
    >
      <div className={`relative h-14 w-14 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center transition group-hover:scale-105 ${ringClass}`}>
        {isMe ? (
          <>
            {imageUrl ? (
              <Image src={imageUrl} alt={name} fill className="object-cover" />
            ) : (
              <span className="text-xl font-bold text-slate-400">{initials}</span>
            )}
            <div className="absolute bottom-0 right-0 h-5 w-5 bg-teal-600 rounded-full flex items-center justify-center border-2 border-white">
              <span className="text-white text-xs font-bold leading-none">+</span>
            </div>
          </>
        ) : imageUrl ? (
          <Image src={imageUrl} alt={name} fill className="object-cover" />
        ) : (
          <span className="text-xl font-bold text-slate-500">{initials}</span>
        )}
      </div>
      <span className="text-xs text-slate-600 font-medium max-w-[64px] truncate text-center">{name}</span>
    </button>
  );
}

// ── Story viewer modal ────────────────────────────────────────────────────────

function StoryViewerModal({
  stories,
  startIndex,
  onClose,
  onMarkViewed,
  onOpenListing
}: {
  stories: Story[];
  startIndex: number;
  onClose(): void;
  onMarkViewed(storyId: string): void;
  onOpenListing?(listingId: string): void;
}) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const DURATION = 5000;

  const story = stories[current];

  const goNext = useCallback(() => {
    if (current < stories.length - 1) {
      setCurrent((c) => c + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [current, stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (current > 0) {
      setCurrent((c) => c - 1);
      setProgress(0);
    }
  }, [current]);

  useEffect(() => {
    if (!story) return;
    onMarkViewed(story.id);
  }, [story, onMarkViewed]);

  useEffect(() => {
    if (paused) return;
    intervalRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          goNext();
          return 0;
        }
        return p + 100 / (DURATION / 50);
      });
    }, 50);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [paused, current, goNext]);

  if (!story) return null;

  const mediaItem = story.media?.[0];
  const attachedListings = story.attachedListings ?? [];

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center" role="dialog" aria-modal="true">
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-5 end-5 z-20 text-white/80 hover:text-white text-2xl font-bold"
        aria-label={t("common.close")}
      >
        ✕
      </button>

      {/* Progress bars */}
      <div className="absolute top-4 start-4 end-4 z-20 flex gap-1">
        {stories.map((s, idx) => (
          <div key={s.id} className="h-0.5 flex-1 rounded bg-white/30 overflow-hidden">
            <div
              className="h-full bg-white transition-none"
              style={{ width: idx < current ? "100%" : idx === current ? `${progress}%` : "0%" }}
            />
          </div>
        ))}
      </div>

      {/* Content */}
      <div
        className="relative h-full w-full max-w-sm mx-auto select-none"
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {mediaItem?.mediaType === "text" || !mediaItem?.mediaUrl ? (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-teal-700 to-teal-900 p-8">
            <p className="text-center text-2xl font-bold text-white leading-relaxed">
              {mediaItem?.textContent ?? mediaItem?.caption}
            </p>
          </div>
        ) : mediaItem.mediaType === "video" ? (
          <video
            src={mediaItem.mediaUrl}
            className="h-full w-full object-cover"
            autoPlay
            playsInline
            muted={false}
            onEnded={goNext}
          />
        ) : (
          <Image src={mediaItem.mediaUrl} alt={mediaItem.caption ?? ""} fill className="object-cover" />
        )}

        {/* Caption */}
        {mediaItem?.caption ? (
          <div className="absolute bottom-24 start-0 end-0 px-6">
            <p className="text-sm text-white font-medium text-center drop-shadow">{mediaItem.caption}</p>
          </div>
        ) : null}

        {/* Attached listings */}
        {attachedListings.length > 0 ? (
          <div className="absolute bottom-5 start-0 end-0 px-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {attachedListings.map((al) => (
                <button
                  key={al.listingId}
                  type="button"
                  onClick={() => onOpenListing?.(al.listingId)}
                  className="flex-shrink-0 rounded-2xl bg-white/90 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-white transition"
                >
                  {al.listing?.title ?? t("stories.viewListing")}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Navigation tap zones */}
        <div className="absolute inset-y-0 start-0 w-1/3 cursor-pointer" onClick={goPrev} />
        <div className="absolute inset-y-0 end-0 w-1/3 cursor-pointer" onClick={goNext} />
      </div>
    </div>
  );
}

// ── Main carousel ─────────────────────────────────────────────────────────────

type StoriesCarouselProps = {
  followedStories: FollowedSellerStories[];
  currentUserId: string | null;
  currentUserImageUrl?: string | null;
  currentUserName?: string | null;
  onAddStory(): void;
  onMarkViewed(storyId: string): void;
  onOpenListing?(listingId: string): void;
};

export function StoriesCarousel({
  followedStories,
  currentUserId,
  currentUserImageUrl,
  currentUserName,
  onAddStory,
  onMarkViewed,
  onOpenListing
}: StoriesCarouselProps) {
  const { t } = useTranslation();
  const [viewerState, setViewerState] = useState<{ stories: Story[]; startIndex: number } | null>(null);

  const hasUnreadForSeller = useCallback((sellerStories: FollowedSellerStories): boolean => {
    if (!currentUserId) return true;
    return sellerStories.stories.some((s) => !s.isViewed);
  }, [currentUserId]);

  const allStories = useMemo(() => followedStories.flatMap((fs) => fs.stories), [followedStories]);

  if (followedStories.length === 0 && !currentUserId) {
    return null;
  }

  return (
    <>
      <div className="w-full overflow-x-auto">
        <div className="flex gap-4 px-1 py-2 min-w-max">
          {/* My Story */}
          {currentUserId ? (
            <StoryRingWeb
              imageUrl={currentUserImageUrl}
              name={t("stories.myStory")}
              hasUnread={false}
              isMe
              onClick={onAddStory}
            />
          ) : null}

          {/* Followed sellers */}
          {followedStories.map((fs) => {
            const firstStoryIndex = allStories.indexOf(fs.stories[0]);
            return (
              <StoryRingWeb
                key={fs.sellerId}
                imageUrl={fs.sellerAvatarUrl}
                name={fs.sellerName}
                hasUnread={hasUnreadForSeller(fs)}
                onClick={() => setViewerState({ stories: allStories, startIndex: Math.max(0, firstStoryIndex) })}
              />
            );
          })}

          {/* Empty state when signed in but follows nobody */}
          {currentUserId && followedStories.length === 0 ? (
            <div className="flex items-center rounded-2xl border border-dashed border-slate-200 px-4 py-2">
              <p className="text-xs text-slate-400 max-w-[200px]">{t("stories.followToSeeStories")}</p>
            </div>
          ) : null}
        </div>
      </div>

      {viewerState ? (
        <StoryViewerModal
          stories={viewerState.stories}
          startIndex={viewerState.startIndex}
          onClose={() => setViewerState(null)}
          onMarkViewed={onMarkViewed}
          onOpenListing={onOpenListing}
        />
      ) : null}
    </>
  );
}
