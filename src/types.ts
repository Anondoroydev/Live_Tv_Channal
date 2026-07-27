export type CategoryName =
  | 'All'
  | 'Sports'
  | 'Bangla'
  | 'India'
  | 'Entertainment'
  | 'Kids'
  | 'News'
  | 'Movies'
  | 'Music'
  | 'Religious'
  | 'International'
  | 'Favorites'
  | 'Recently Watched';

export interface Channel {
  id: string;
  channelNumber: number;
  name: string;
  logo: string;
  category: CategoryName | string;
  streamUrl: string;
  isPremium: boolean;
  isActive: boolean;
  groupTitle?: string;
  tvgId?: string;
}

export interface EPGProgram {
  id: string;
  channelId: string;
  title: string;
  description: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  category?: string;
}

export type SubscriptionPlan = 
  | 'Free' 
  | '1 Day Pass (৳10)' 
  | '1 Month Standard (৳45)' 
  | '1 Month Premium (৳100)' 
  | '7 Days' 
  | '30 Days' 
  | '365 Days' 
  | 'Expired';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  subscriptionPlan: SubscriptionPlan;
  subscriptionExpiresAt: string | null; // ISO string or null for free/unlimited
  favorites: string[]; // array of channelIds
  recentlyWatched: string[]; // array of channelIds
  password?: string;
}

export interface M3UParseResult {
  totalChannels: number;
  channels: Partial<Channel>[];
  categories: string[];
}

export interface SettingsConfig {
  language: 'en' | 'bn' | 'hi' | 'es';
  theme: 'dark' | 'midnight' | 'oled';
  autoPlay: boolean;
  autoReconnect: boolean;
  bufferSize: number; // in seconds, e.g. 10, 30, 60
  streamQuality: 'auto' | '1080p' | '720p' | '480p';
}

export type ViewMode = 'livetv' | 'movies' | 'series' | 'guide' | 'favorites' | 'recent' | 'search' | 'settings' | 'admin';

export type ThemeId = 'gold' | 'red' | 'cyberpunk' | 'emerald' | 'purple';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  subtitle: string;
  badge: string;
  bgGradient: string;
  accentBg: string;
  accentGradient: string;
  accentText: string;
  accentBorder: string;
  accentGlow: string;
  secondaryText: string;
  previewColor: string;
}

