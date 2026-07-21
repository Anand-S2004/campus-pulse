-- ============================================================
-- MIGRATION: Remove the weekly post limit
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Drop the weekly-limit trigger and function.
DROP TRIGGER IF EXISTS posts_weekly_limit ON public.posts;
DROP FUNCTION IF EXISTS public.enforce_weekly_post_limit();

-- Also re-lock the now-removed function (not needed, but keep in case the
-- second migration still references it).
-- No-op: function is already dropped.
