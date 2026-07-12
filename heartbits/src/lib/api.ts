import { BACKEND_URL } from './config';
import { supabase } from './supabase';
import type { FeedPage, PostCategory, PostItem, PulseCardItem, WeeklyRecapItem } from '../types';

async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (session) {
    headers.authorization = `Bearer ${session.access_token}`;
  }

  return headers;
}

async function getReactionSummary(postId: string) {
  const { count, error } = await supabase.from('reactions').select('*', { count: 'exact', head: true }).eq('post_id', postId);
  if (error) {
    throw error;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: ownReaction, error: ownError } = await supabase
    .from('reactions')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', user?.id ?? '00000000-0000-0000-0000-000000000000')
    .maybeSingle();

  if (ownError) {
    throw ownError;
  }

  return {
    reactionCount: count ?? 0,
    userReacted: Boolean(ownReaction),
  };
}

export async function fetchFeedPage(page = 0, limit = 10): Promise<FeedPage> {
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, category, location_label, description, created_at, user_id')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .range(page * limit, page * limit + limit - 1);

  if (error) {
    throw error;
  }

  const items = await Promise.all(
    (posts ?? []).map(async (row) => {
      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', row.user_id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const { reactionCount, userReacted } = await getReactionSummary(row.id);

      return {
        id: row.id,
        category: row.category as PostCategory,
        location_label: row.location_label,
        description: row.description ?? '',
        created_at: row.created_at,
        user_id: row.user_id,
        authorName: profileRow?.display_name ?? 'Campus friend',
        reactionCount,
        userReacted,
      } satisfies PostItem;
    }),
  );

  const { data: pulseRows, error: pulseError } = await supabase
    .from('pulse_cards')
    .select('id, body, kind, generated_for')
    .order('generated_for', { ascending: false })
    .limit(3);

  if (pulseError) {
    throw pulseError;
  }

  return {
    items,
    pulseCards: (pulseRows ?? []) as PulseCardItem[],
    hasMore: items.length === limit,
  };
}

export async function createPost(input: { description: string; locationLabel: string; category: PostCategory }) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Please sign in before sharing a positive moment.');
  }

  // Posts must be inserted as 'pending' — the RLS policy on public.posts
  // ("posts self insert") only allows self-inserts with status = 'pending'.
  // A moderator/admin approves posts afterwards (see the web admin's Moderate page).
  const { error } = await supabase.from('posts').insert({
    user_id: user.id,
    description: input.description,
    location_label: input.locationLabel || 'Campus community',
    category: input.category,
    status: 'pending',
  });

  if (error) {
    throw error;
  }
}

export async function resetMyFeed() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Please sign in before clearing the feed.');
  }

  const { error } = await supabase.from('posts').delete().eq('user_id', user.id);
  if (error) {
    throw error;
  }
}

export async function togglePostReaction(postId: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Please sign in before reacting.');
  }

  const { data: existing, error: fetchError } = await supabase
    .from('reactions')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (existing) {
    const { error } = await supabase.from('reactions').delete().eq('post_id', postId).eq('user_id', user.id);
    if (error) {
      throw error;
    }
    return false;
  }

  const { error } = await supabase.from('reactions').insert({ post_id: postId, user_id: user.id });
  if (error) {
    throw error;
  }
  return true;
}

export async function fetchWeeklyRecap(): Promise<WeeklyRecapItem | null> {
  // NOTE: weekly_recaps has no `headline`/`body` columns -- those were never
  // part of the schema (see `narrative` + the per-metric columns below).
  // Selecting non-existent columns made this query 400 on every call, which
  // is why the recap screen never showed anything. Select the real columns
  // and build headline/body client-side instead.
  const { data, error } = await supabase
    .from('weekly_recaps')
    .select('id, week_start, narrative, top_zone, zones_visited, positive_moments, nearby_moments, crossed_paths')
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    week_start: data.week_start,
    headline: data.top_zone ? `Your week around ${data.top_zone}` : 'Your week in review',
    body: data.narrative ?? '',
  };
}

export async function registerPushToken(token: string, platform: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/api/public/register-push-token`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ token, platform }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || 'Unable to register notifications right now.');
  }
}

export async function ingestLocation(lat: number, lon: number) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/api/public/ingest-location`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ lat, lon }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || 'Location update could not be sent.');
  }
}

export async function checkBackendHealth() {
  const started = Date.now();
  const response = await fetch(BACKEND_URL, { method: 'GET' });
  const latency = Date.now() - started;
  const reachable = response.status < 500;
  return { reachable, latency };
}
