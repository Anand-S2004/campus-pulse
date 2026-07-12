-- Fix: users could not clear/reset their own posts. There was no DELETE
-- policy on public.posts, so DELETE requests from authenticated users
-- (mobile "reset my feed" and the web admin reset button) silently
-- affected 0 rows -- no error was returned, but nothing was deleted.
-- This mirrors the existing "reactions self delete" policy pattern.

CREATE POLICY "posts self delete"
ON public.posts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
