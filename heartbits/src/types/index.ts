export type PostCategory = 'sports' | 'kindness' | 'academic' | 'food' | 'music' | 'social' | 'other';

export interface ProfileSummary {
  display_name: string | null;
}

export interface PostItem {
  id: string;
  category: PostCategory;
  location_label: string;
  description: string | null;
  photo_url: string | null;
  created_at: string;
  user_id: string;
  authorName: string;
  reactionCount: number;
  userReacted: boolean;
}

export interface PulseCardItem {
  id: string;
  body: string;
  kind: string;
  generated_for: string;
}

export interface WeeklyRecapItem {
  id: string;
  week_start: string;
  body: string;
  headline: string;
}

export interface FeedPage {
  items: PostItem[];
  pulseCards: PulseCardItem[];
  hasMore: boolean;
}

export type Role = 'admin' | 'moderator' | 'student' | null;

export interface PendingPost {
  id: string;
  category: PostCategory;
  location_label: string;
  description: string | null;
  created_at: string;
  user_id: string;
  profiles: { display_name: string | null; email: string | null } | null;
}

export interface CampusZone {
  id: string;
  name: string;
  short_code: string | null;
  center_lat: number;
  center_lon: number;
  radius_m: number;
}
