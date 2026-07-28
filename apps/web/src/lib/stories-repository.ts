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
import type { CreateHighlightInput, CreateStoryInput, AddToHighlightInput } from "@sanany/types";
import { getWebSupabaseClient } from "./supabase-client";

export function getWebStoriesRepository() {
  const supabase = getWebSupabaseClient();
  return {
    getFollowedSellersStories: (userId: string) => getFollowedSellersStories(supabase, userId),
    getSellerStories: (sellerId: string, viewerId?: string) => getSellerStories(supabase, sellerId, viewerId ?? null),
    createStory: (input: CreateStoryInput) => createStory(supabase, input),
    markStoryViewed: (storyId: string, userId: string) => markStoryViewed(supabase, storyId, userId),
    deleteStory: (storyId: string) => deleteStory(supabase, storyId),
    getSellerHighlights: (sellerId: string) => getSellerHighlights(supabase, sellerId),
    createHighlight: (input: CreateHighlightInput) => createHighlight(supabase, input),
    addStoryToHighlight: (input: AddToHighlightInput) => addStoryToHighlight(supabase, input)
  };
}

export type WebStoriesRepository = ReturnType<typeof getWebStoriesRepository>;
