-- ============================================================
-- MIGRATION: Fix email domain + add admin location read policy
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Fix the email domain CHECK constraint
--    (original migration used @ashoka.edu.in)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS college_email_only;
ALTER TABLE public.profiles ADD CONSTRAINT college_email_only
  CHECK (email ~* '@hyderabad\.bits-pilani\.ac\.in$');

-- 2. Allow admins to read ALL location events
--    (needed for the zone occupancy dashboard in /zones)
DROP POLICY IF EXISTS "location admin read" ON public.location_events;
CREATE POLICY "location admin read" ON public.location_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
