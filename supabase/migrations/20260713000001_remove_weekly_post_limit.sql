-- Remove the 2-posts-per-week cap so users can share as many positive moments as they want.
-- The original limit was enforced by a BEFORE INSERT trigger on public.posts; this drops
-- the trigger and the helper function it used. The application-side check in
-- src/routes/api/public/create-post.ts was also removed in the same commit.

DROP TRIGGER IF EXISTS posts_weekly_limit ON public.posts;
DROP FUNCTION IF EXISTS public.enforce_weekly_post_limit();
