-- Stories Feature Migration
-- Creates: stories, story_media, story_attached_listings, story_views,
--          story_highlights, story_highlight_items
-- All tables expose via Data API (public schema) with RLS enabled.

-- ─── stories ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  view_count  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read active (non-expired) stories
CREATE POLICY "stories_select" ON stories
  FOR SELECT TO authenticated
  USING (expires_at > now());

-- Sellers can insert their own stories
CREATE POLICY "stories_insert" ON stories
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = seller_id);

-- Sellers can delete their own stories
CREATE POLICY "stories_delete" ON stories
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = seller_id);

-- Grant access to anon/authenticated via Data API
GRANT SELECT ON stories TO anon, authenticated;
GRANT INSERT, DELETE ON stories TO authenticated;

-- ─── story_media ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS story_media (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id      uuid        NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  media_type    text        NOT NULL CHECK (media_type IN ('image', 'video', 'text')),
  media_url     text,
  text_content  text,
  caption       text,
  ordinal       int         NOT NULL DEFAULT 0,
  duration_ms   int         NOT NULL DEFAULT 5000,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT story_media_content_check CHECK (
    (media_type IN ('image', 'video') AND media_url IS NOT NULL) OR
    (media_type = 'text' AND text_content IS NOT NULL)
  )
);

ALTER TABLE story_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "story_media_select" ON story_media
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_media.story_id
        AND s.expires_at > now()
    )
  );

CREATE POLICY "story_media_insert" ON story_media
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_media.story_id
        AND s.seller_id = (select auth.uid())
    )
  );

CREATE POLICY "story_media_delete" ON story_media
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_media.story_id
        AND s.seller_id = (select auth.uid())
    )
  );

GRANT SELECT ON story_media TO anon, authenticated;
GRANT INSERT, DELETE ON story_media TO authenticated;

-- ─── story_attached_listings ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS story_attached_listings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id    uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  listing_id  uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  ordinal     int  NOT NULL DEFAULT 0,
  UNIQUE (story_id, listing_id)
);

ALTER TABLE story_attached_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "story_attached_listings_select" ON story_attached_listings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_attached_listings.story_id
        AND s.expires_at > now()
    )
  );

CREATE POLICY "story_attached_listings_insert" ON story_attached_listings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_attached_listings.story_id
        AND s.seller_id = (select auth.uid())
    )
  );

CREATE POLICY "story_attached_listings_delete" ON story_attached_listings
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_attached_listings.story_id
        AND s.seller_id = (select auth.uid())
    )
  );

GRANT SELECT ON story_attached_listings TO anon, authenticated;
GRANT INSERT, DELETE ON story_attached_listings TO authenticated;

-- ─── story_views ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS story_views (
  story_id   uuid        NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);

ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

-- Story owner can see who viewed their stories
CREATE POLICY "story_views_select_owner" ON story_views
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_views.story_id
        AND s.seller_id = (select auth.uid())
    )
  );

-- Viewer can see their own view records (to check if they've seen something)
CREATE POLICY "story_views_select_self" ON story_views
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = viewer_id);

CREATE POLICY "story_views_insert" ON story_views
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = viewer_id);

GRANT SELECT ON story_views TO authenticated;
GRANT INSERT ON story_views TO authenticated;

-- Function: increment view_count on stories when a view is recorded
CREATE OR REPLACE FUNCTION increment_story_view_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE stories SET view_count = view_count + 1 WHERE id = NEW.story_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_story_viewed
  AFTER INSERT ON story_views
  FOR EACH ROW
  EXECUTE FUNCTION increment_story_view_count();

-- ─── story_highlights ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS story_highlights (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title      text        NOT NULL,
  cover_url  text,
  ordinal    int         NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE story_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "story_highlights_select" ON story_highlights
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "story_highlights_insert" ON story_highlights
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = seller_id);

CREATE POLICY "story_highlights_update" ON story_highlights
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = seller_id)
  WITH CHECK ((select auth.uid()) = seller_id);

CREATE POLICY "story_highlights_delete" ON story_highlights
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = seller_id);

GRANT SELECT ON story_highlights TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON story_highlights TO authenticated;

-- ─── story_highlight_items ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS story_highlight_items (
  highlight_id  uuid        NOT NULL REFERENCES story_highlights(id) ON DELETE CASCADE,
  story_id      uuid        NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  added_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (highlight_id, story_id)
);

ALTER TABLE story_highlight_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "story_highlight_items_select" ON story_highlight_items
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "story_highlight_items_insert" ON story_highlight_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM story_highlights h
      WHERE h.id = story_highlight_items.highlight_id
        AND h.seller_id = (select auth.uid())
    )
  );

CREATE POLICY "story_highlight_items_delete" ON story_highlight_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM story_highlights h
      WHERE h.id = story_highlight_items.highlight_id
        AND h.seller_id = (select auth.uid())
    )
  );

GRANT SELECT ON story_highlight_items TO anon, authenticated;
GRANT INSERT, DELETE ON story_highlight_items TO authenticated;

-- Storage bucket for story media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'story-media',
  'story-media',
  true,
  52428800,  -- 50 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload, anyone can read
CREATE POLICY "story_media_storage_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'story-media');

CREATE POLICY "story_media_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'story-media'
    AND (select auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "story_media_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'story-media'
    AND (select auth.uid())::text = (storage.foldername(name))[1]
  );
