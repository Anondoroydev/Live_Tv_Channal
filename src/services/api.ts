import { Channel, EPGProgram, User, SubscriptionPlan, SettingsConfig } from '../types';

const TOKEN_KEY = 'myiptv_jwt_token';

export const getStoredToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (e) {
    return null;
  }
};

export const setStoredToken = (token: string | null) => {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (e) {}
};

const getHeaders = () => {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

export const apiService = {
  // Auth API
  async login(email: string, password?: string): Promise<{ token: string; user: User }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    setStoredToken(data.token);
    return data;
  },

  async register(username: string, email: string, password?: string): Promise<{ token: string; user: User; message: string }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Registration failed');
    }
    const data = await res.json();
    setStoredToken(data.token);
    return data;
  },

  async getCurrentUser(): Promise<User | null> {
    const token = getStoredToken();
    if (!token) return null;
    try {
      const res = await fetch('/api/auth/me', { headers: getHeaders() });
      if (!res.ok) return null;
      const data = await res.json();
      return data.user;
    } catch {
      return null;
    }
  },

  logout() {
    setStoredToken(null);
  },

  async updateSubscription(plan: SubscriptionPlan): Promise<User> {
    const res = await fetch('/api/auth/subscription', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ plan })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update subscription');
    }
    const data = await res.json();
    return data.user;
  },

  // Channels API
  async fetchChannels(category?: string, search?: string): Promise<Channel[]> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);

    const res = await fetch(`/api/channels?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch channels');
    return res.json();
  },

  async fetchCategories(): Promise<string[]> {
    try {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    } catch (e) {
      console.warn('Failed to fetch categories, falling back to default:', e);
      return ['All', 'Sports', 'Bangla', 'India', 'Entertainment', 'Kids', 'News', 'Movies', 'Music', 'Religious', 'International'];
    }
  },

  async getStreamInfo(channelId: string): Promise<{
    channelId: string;
    name: string;
    category: string;
    channelNumber: number;
    streamUrl: string;
    isPremium: boolean;
  }> {
    const res = await fetch(`/api/stream/${channelId}`, {
      headers: getHeaders()
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to load channel stream');
    }
    return res.json();
  },

  async fetchEPG(channelId?: string): Promise<EPGProgram[] | Record<string, EPGProgram[]>> {
    const url = channelId ? `/api/epg?channelId=${channelId}` : '/api/epg';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch EPG guide');
    return res.json();
  },

  async toggleFavorite(channelId: string): Promise<string[]> {
    const res = await fetch('/api/favorites/toggle', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ channelId })
    });
    if (!res.ok) throw new Error('Failed to toggle favorite');
    const data = await res.json();
    return data.favorites;
  },

  // ADMIN API
  async uploadM3U(m3uContent: string, overwrite: boolean = false): Promise<{ message: string; addedCount: number; totalChannels: number }> {
    const res = await fetch('/api/admin/m3u/upload', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ m3uContent, overwrite })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to upload M3U playlist');
    }
    return res.json();
  },

  async importM3uUrl(url: string, overwrite: boolean = true): Promise<{ message: string; addedCount: number; totalChannels: number; sourceUrl: string }> {
    const res = await fetch('/api/admin/m3u/url', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ url, overwrite })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to download M3U URL');
    }
    return res.json();
  },

  async importXtreamCodes(serverUrl: string, username: string, password: string, overwrite: boolean = true): Promise<{ message: string; addedCount: number; totalChannels: number }> {
    const res = await fetch('/api/admin/xtream/connect', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ serverUrl, username, password, overwrite })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to connect Xtream Codes account');
    }
    return res.json();
  },

  async getPlaylistSource(): Promise<{
    type: 'default' | 'm3u_text' | 'm3u_url' | 'xtream';
    url: string;
    xtreamServer: string;
    xtreamUser: string;
    lastSyncedAt: string;
    totalChannels: number;
  }> {
    const res = await fetch('/api/admin/playlist-source', { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to get playlist source info');
    return res.json();
  },

  async adminFetchChannels(): Promise<Channel[]> {
    const res = await fetch('/api/admin/channels', { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch admin channels');
    return res.json();
  },

  async adminUpdateChannel(id: string, updates: Partial<Channel>): Promise<Channel> {
    const res = await fetch(`/api/admin/channels/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update channel');
    return res.json();
  },

  async adminDeleteChannel(id: string): Promise<void> {
    const res = await fetch(`/api/admin/channels/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete channel');
  },

  async adminAssignNumbers(startFrom: number = 101): Promise<void> {
    const res = await fetch('/api/admin/channels/assign-numbers', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ startFrom })
    });
    if (!res.ok) throw new Error('Failed to reassign channel numbers');
  },

  async adminFetchUsers(): Promise<User[]> {
    const res = await fetch('/api/admin/users', { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },

  async adminCreateUser(userData: { username: string; email?: string; role?: 'admin' | 'user'; subscriptionPlan?: SubscriptionPlan }): Promise<User> {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(userData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create user');
    }
    const data = await res.json();
    return data.user;
  },

  async adminDeleteUser(userId: string): Promise<void> {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete user');
  },

  async adminUpdateUserSubscription(userId: string, plan: SubscriptionPlan): Promise<User> {
    const res = await fetch(`/api/admin/users/${userId}/subscription`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ plan })
    });
    if (!res.ok) throw new Error('Failed to update user subscription');
    return res.json();
  },

  async adminFetchStats(): Promise<{
    totalChannels: number;
    activeChannels: number;
    premiumChannels: number;
    totalUsers: number;
    activeSubscriptions: number;
  }> {
    const res = await fetch('/api/admin/stats', { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch admin stats');
    return res.json();
  }
};
