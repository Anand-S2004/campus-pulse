
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'student');
CREATE TYPE public.post_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.post_category AS ENUM ('sports', 'kindness', 'academic', 'food', 'music', 'social', 'other');

-- PROFILES — one row per auth user; college-email gate via CHECK regex.
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT college_email_only CHECK (email ~* '@ashoka\.edu\.in$')
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles read all auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles self insert"   ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles self update"   ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- USER ROLES — roles stored separately to avoid privilege escalation.
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- has_role: security-definer to avoid recursive RLS.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- CAMPUS ZONES
CREATE TABLE public.campus_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  short_code text,
  center_lat double precision NOT NULL,
  center_lon double precision NOT NULL,
  radius_m integer NOT NULL DEFAULT 80,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.campus_zones TO authenticated, anon;
GRANT ALL ON public.campus_zones TO service_role;
ALTER TABLE public.campus_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zones public read" ON public.campus_zones FOR SELECT USING (true);
CREATE POLICY "zones admin write" ON public.campus_zones FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- POSTS — moderated community moments.
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category public.post_category NOT NULL,
  location_label text NOT NULL,
  zone_id uuid REFERENCES public.campus_zones(id),
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 280),
  status public.post_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  reject_reason text
);
ALTER TABLE public.posts
ADD COLUMN approval_notification_sent_at timestamptz;
ALTER TABLE public.posts
ALTER COLUMN description DROP NOT NULL;
CREATE INDEX posts_approval_notify_idx
ON public.posts (
    status,
    approval_notification_sent_at,
    approved_at
);
ALTER TABLE public.posts
DROP CONSTRAINT posts_description_check;

ALTER TABLE public.posts
ADD CONSTRAINT posts_description_check
CHECK (
  description IS NULL
  OR char_length(description) BETWEEN 1 AND 280
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts feed read" ON public.posts FOR SELECT TO authenticated
  USING (status = 'approved' OR user_id = auth.uid()
         OR public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "posts self insert" ON public.posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "posts mod update" ON public.posts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX posts_status_created_idx ON public.posts (status, created_at DESC);
CREATE INDEX posts_user_created_idx ON public.posts (user_id, created_at DESC);

-- 2 posts per ISO-week per user
CREATE OR REPLACE FUNCTION public.enforce_weekly_post_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c integer;
BEGIN
  SELECT count(*) INTO c FROM public.posts
   WHERE user_id = NEW.user_id
     AND date_trunc('week', created_at) = date_trunc('week', now());
  IF c >= 2 THEN RAISE EXCEPTION 'Weekly post limit reached (2 per week)'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER posts_weekly_limit BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_weekly_post_limit();

-- REACTIONS — single ❤️ per (post,user)
CREATE TABLE public.reactions (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.reactions TO authenticated;
GRANT ALL ON public.reactions TO service_role;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions read"        ON public.reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "reactions self insert" ON public.reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions self delete" ON public.reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- LOCATION EVENTS — zone+timestamp ONLY (raw coords never stored).
CREATE TABLE public.location_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  zone_id uuid NOT NULL REFERENCES public.campus_zones(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX location_user_zone_time_idx
ON public.location_events (
    user_id,
    zone_id,
    occurred_at DESC
);
GRANT SELECT ON public.location_events TO authenticated;
GRANT ALL ON public.location_events TO service_role;
ALTER TABLE public.location_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "location self read" ON public.location_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX location_user_time_idx ON public.location_events (user_id, occurred_at DESC);
CREATE INDEX location_zone_time_idx ON public.location_events (zone_id, occurred_at DESC);

-- PULSE CARDS (auto-generated)
CREATE TABLE public.pulse_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body text NOT NULL,
  kind text NOT NULL,
  generated_for date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pulse_cards TO authenticated;
GRANT ALL ON public.pulse_cards TO service_role;
ALTER TABLE public.pulse_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pulse read all" ON public.pulse_cards FOR SELECT TO authenticated USING (true);
CREATE INDEX pulse_generated_idx ON public.pulse_cards (generated_for DESC);
CREATE UNIQUE INDEX pulse_kind_day_unique
ON public.pulse_cards(kind, generated_for);
-- WEEKLY RECAPS (per user)
CREATE TABLE public.weekly_recaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  positive_moments integer NOT NULL DEFAULT 0,
  nearby_moments integer NOT NULL DEFAULT 0,
  zones_visited integer NOT NULL DEFAULT 0,
  crossed_paths integer NOT NULL DEFAULT 0,
  top_zone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
ALTER TABLE public.weekly_recaps
ADD COLUMN recap_notification_sent_at timestamptz,
ADD COLUMN shared_routine_score integer NOT NULL DEFAULT 0,
ADD COLUMN shared_space_count integer NOT NULL DEFAULT 0,
ADD COLUMN common_path_count integer NOT NULL DEFAULT 0,
ADD COLUMN repeat_community_count integer NOT NULL DEFAULT 0,
ADD COLUMN narrative text;
GRANT SELECT ON public.weekly_recaps TO authenticated;
GRANT ALL ON public.weekly_recaps TO service_role;
ALTER TABLE public.weekly_recaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recap self read" ON public.weekly_recaps FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX weekly_recap_user_week_idx
ON public.weekly_recaps (
    user_id,
    week_start DESC
);
CREATE INDEX weekly_recap_notification_idx
ON public.weekly_recaps(
  week_start,
  recap_notification_sent_at
);
-- PUSH TOKENS (Expo)
CREATE TABLE public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_token text NOT NULL UNIQUE,
  platform text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
GRANT ALL ON public.push_tokens TO service_role;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push self all" ON public.push_tokens FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX push_tokens_user_idx
ON public.push_tokens(user_id);
-- Seed example zones (edit from the admin UI)
INSERT INTO public.campus_zones (name, short_code, center_lat, center_lon, radius_m) VALUES
  ('SAC','SAC',28.4595,77.5826,80),
  ('Library','LIB',28.4598,77.5832,60),
  ('OFG','OFG',28.4602,77.5820,70),
  ('Academic Block','AB',28.4590,77.5828,100),
  ('Hostels','HST',28.4612,77.5838,150),
  ('BB Court','BBC',28.4587,77.5824,40),
  ('Dining Hall','DH',28.4600,77.5818,60);
