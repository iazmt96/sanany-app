import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Story,
  FollowedSellerStories,
  StoryHighlight,
  CreateStoryInput,
  AddToHighlightInput,
  CreateHighlightInput
} from "@sanany/types";
import {
  getFollowedSellersStories,
  getSellerStories,
  createStory,
  markStoryViewed,
  deleteStory,
  getSellerHighlights,
  createHighlight,
  addStoryToHighlight
} from "@sanany/api";
import { getMobileSupabaseClient } from "./supabase-client";

function getClient(): SupabaseClient {
  return getMobileSupabaseClient();
}

export function getMobileStoriesRepository() {
  return {
    getFollowedSellersStories: (userId: string): Promise<FollowedSellerStories[]> =>
      getFollowedSellersStories(getClient(), userId),

    getSellerStories: (sellerId: string, currentUserId: string | null): Promise<Story[]> =>
      getSellerStories(getClient(), sellerId, currentUserId),

    createStory: (input: CreateStoryInput): Promise<Story | null> =>
      createStory(getClient(), input),

    markStoryViewed: (storyId: string, viewerId: string): Promise<void> =>
      markStoryViewed(getClient(), storyId, viewerId),

    deleteStory: (storyId: string): Promise<void> =>
      deleteStory(getClient(), storyId),

    getSellerHighlights: (sellerId: string): Promise<StoryHighlight[]> =>
      getSellerHighlights(getClient(), sellerId),

    createHighlight: (input: CreateHighlightInput): Promise<StoryHighlight | null> =>
      createHighlight(getClient(), input),

    addStoryToHighlight: (input: AddToHighlightInput): Promise<void> =>
      addStoryToHighlight(getClient(), input)
  };
}

export type MobileStoriesRepository = ReturnType<typeof getMobileStoriesRepository>;
