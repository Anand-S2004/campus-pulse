-- ============================================================
-- ONE-TIME APPLY FOR PROJECT zmjkkasiihycuutikims
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- This applies all fixes that were split across previous migrations.
-- ============================================================

-- 1. Fix the email domain CHECK constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS college_email_only;
ALTER TABLE public.profiles ADD CONSTRAINT college_email_only
  CHECK (email ~* '@hyderabad\.bits-pilani\.ac\.in$');

-- 2. Auto-create profile + assign student role when a new auth user signs up.
--    Works for ANY signup method (JS client, admin API, OAuth, etc.).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Allow authenticated users to insert their own location events
GRANT INSERT ON public.location_events TO authenticated;

DROP POLICY IF EXISTS "location self insert" ON public.location_events;
CREATE POLICY "location self insert" ON public.location_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 4. Allow admins to read ALL location events (for zone occupancy view)
DROP POLICY IF EXISTS "location admin read" ON public.location_events;
CREATE POLICY "location admin read" ON public.location_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Remove the weekly post limit
DROP TRIGGER IF EXISTS posts_weekly_limit ON public.posts;
DROP FUNCTION IF EXISTS public.enforce_weekly_post_limit();
