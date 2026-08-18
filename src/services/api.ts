import {
  Channel,
  EPGProgram,
  User,
  SubscriptionPlan,
  SettingsConfig,
} from "../types";

const TOKEN_KEY = "myiptv_jwt_token";
let channelsCache: Channel[] | null = null;
let lastFetched: number = 0;

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
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

async function handleResponse<T = any>(res: Response): Promise<T> {
  const cloned = res.clone();
  if (!res.ok) {
    let errorMessage = `Request failed with status ${res.status}`;
    try {
      const err = await cloned.json();
      errorMessage = err.error || errorMessage;
    } catch (e) {
      try {
        const text = await cloned.text();
        if (text) {
          errorMessage = text.substring(0, 200); 
        }
      } catch (ex) {}
    }
    throw new Error(errorMessage);
  }
  
  try {
    return await res.json();
  } catch (e) {
    return {} as T;
  }
}

/**
 * Dynamic Base URL Resolver for Web and Native Android Capacitor environments.
 * When running inside a native webview (protocol is capacitor: or file:), relative paths
 * like /api/... won't work, so we prefix them with the secure deployed web server URL.
 */
export const getApiUrl = (path: string): string => {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  
  const isNative = typeof window !== "undefined" && 
    (window.location.protocol === "capacitor:" || window.location.protocol === "file:");
  
  const base = isNative ? "http://localhost:3000" : "";
  return `${base}${path}`;
};

export const apiService = {
  // Auth API
  async login(
    email: string,
    password?: string,
  ): Promise<{ token: string; user: User }> {
    const res = await fetch(getApiUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse<{ token: string; user: User }>(res);
    setStoredToken(data.token);
    return data;
  },

  async register(
    username: string,
    email: string,
    password?: string,
  ): Promise<{ token: string; user: User; message: string }> {
    const res = await fetch(getApiUrl("/api/auth/register"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await handleResponse<{ token: string; user: User; message: string }>(res);
    setStoredToken(data.token);
    return data;
  },

  async getCurrentUser(): Promise<User | null> {
    const token = getStoredToken();
    if (!token) return null;
    try {
      const res = await fetch(getApiUrl("/api/auth/me"), { headers: getHeaders() });
      const data = await handleResponse<{ user: User }>(res);
      return data.user;
    } catch {
      return null;
    }
  },

  logout() {
    setStoredToken(null);
    channelsCache = null;
  },

  async updateSubscription(
    plan: SubscriptionPlan,
    transactionId?: string,
    senderNumber?: string,
    paymentMethod?: string,
    amount?: string,
  ): Promise<User> {
    const res = await fetch(getApiUrl("/api/auth/subscription"), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        plan,
        transactionId,
        senderNumber,
        paymentMethod,
        amount,
      }),
    });
    const data = await handleResponse<{ user: User }>(res);
    channelsCache = null;
    return data.user;
  },

  // Channels API
  async fetchChannels(category?: string, search?: string): Promise<Channel[]> {
    const params = new URLSearchParams();
    if (category) params.append("category", category);
    if (search) params.append("search", search);

    try {
      const res = await fetch(getApiUrl(`/api/channels?${params.toString()}`), {
        headers: getHeaders(),
      });
      
      if (!res.ok) {
        if (channelsCache && channelsCache.length > 0) return channelsCache;
        if (res.status === 429 || res.status >= 500) {
          await new Promise((r) => setTimeout(r, 1000));
          const retryRes = await fetch(getApiUrl(`/api/channels?${params.toString()}`), {
            headers: getHeaders(),
          });
          if (retryRes.ok) {
             const data: Channel[] = await handleResponse<Channel[]>(retryRes);
             if (!category && !search) {
               channelsCache = data;
               lastFetched = Date.now();
             }
             return data.filter((c) => c.isActive !== false);
          }
        }
        throw new Error("Failed to fetch channels");
      }
      
      const allChannels: Channel[] = await handleResponse<Channel[]>(res);
      
      if (!category && !search) {
        channelsCache = allChannels;
        lastFetched = Date.now();
      }
      
      // Filter out inactive channels (those that couldn't be validated)
      return allChannels.filter(c => c.isActive !== false);
    } catch (e) {
      console.warn("fetchChannels failed, using cached channels if available:", e);
      if (channelsCache && channelsCache.length > 0) {
        return channelsCache;
      }
      throw e;
    }
  },

  async fetchCategories(): Promise<string[]> {
    try {
      const res = await fetch(getApiUrl("/api/categories"), {
        headers: getHeaders(),
      });
      const data = await handleResponse<any>(res);
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.categories)) return data.categories;
      return [
        "All",
        "Sports",
        "Bangla",
        "India",
        "Entertainment",
        "Kids",
        "News",
        "Series / VOD",
        "Music",
        "Religious",
        "International",
      ];
    } catch (e) {
      console.warn("Failed to fetch categories, falling back to default:", e);
      return [
        "All",
        "Sports",
        "Bangla",
        "India",
        "Entertainment",
        "Kids",
        "News",
        "Series / VOD",
        "Music",
        "Religious",
        "International",
      ];
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
    const res = await fetch(getApiUrl(`/api/stream/${channelId}`), {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async fetchEPG(
    channelId?: string,
  ): Promise<EPGProgram[] | Record<string, EPGProgram[]>> {
    const url = channelId ? `/api/epg?channelId=${channelId}` : "/api/epg";
    const res = await fetch(getApiUrl(url));
    return handleResponse(res);
  },

  async toggleFavorite(channelId: string): Promise<string[]> {
    const res = await fetch(getApiUrl("/api/favorites/toggle"), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ channelId }),
    });
    const data = await handleResponse<{ favorites: string[] }>(res);
    return data.favorites;
  },

  // ADMIN API
  async uploadM3U(
    m3uContent: string,
    overwrite: boolean = true,
  ): Promise<{ message: string; addedCount: number; totalChannels: number }> {
    channelsCache = null;
    lastFetched = 0;
    const res = await fetch(getApiUrl("/api/admin/m3u/upload"), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ m3uContent, overwrite }),
    });
    return handleResponse(res);
  },

  async importM3uUrl(
    url: string,
    overwrite: boolean = true,
  ): Promise<{
    message: string;
    addedCount: number;
    totalChannels: number;
    sourceUrl: string;
  }> {
    channelsCache = null;
    lastFetched = 0;
    const res = await fetch(getApiUrl("/api/admin/m3u/url"), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ url, overwrite }),
    });
    return handleResponse(res);
  },

  async importXtreamCodes(
    serverUrl: string,
    username: string,
    password: string,
    overwrite: boolean = true,
  ): Promise<{ message: string; addedCount: number; totalChannels: number }> {
    channelsCache = null;
    lastFetched = 0;
    const res = await fetch(getApiUrl("/api/admin/xtream/connect"), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ serverUrl, username, password, overwrite }),
    });
    return handleResponse(res);
  },

  async getPlaylistSource(): Promise<{
    type: "default" | "m3u_text" | "m3u_url" | "xtream";
    url: string;
    xtreamServer: string;
    xtreamUser: string;
    lastSyncedAt: string;
    totalChannels: number;
  }> {
    const res = await fetch(getApiUrl("/api/admin/playlist-source"), {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async adminFetchChannels(search?: string, limit: number = 500, offset: number = 0): Promise<{ channels: Channel[]; total: number }> {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    const res = await fetch(getApiUrl(`/api/admin/channels?${params.toString()}`), { headers: getHeaders() });
    const data = await handleResponse<any>(res);
    if (Array.isArray(data)) {
      return { channels: data, total: data.length };
    }
    return data;
  },

  async adminUpdateChannel(
    id: string,
    updates: Partial<Channel>,
  ): Promise<Channel> {
    channelsCache = null;
    lastFetched = 0;
    const res = await fetch(getApiUrl(`/api/admin/channels/${id}`), {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(res);
  },

  async adminDeleteChannel(id: string): Promise<void> {
    channelsCache = null;
    lastFetched = 0;
    const res = await fetch(getApiUrl(`/api/admin/channels/${id}`), {
      method: "DELETE",
      headers: getHeaders(),
    });
    await handleResponse(res);
  },

  async adminClearChannels(): Promise<{ message: string }> {
    channelsCache = null;
    lastFetched = 0;
    const res = await fetch(getApiUrl("/api/admin/channels/clear"), {
      method: "POST",
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async adminResetDefaultChannels(): Promise<{ message: string; totalChannels: number; channels: Channel[] }> {
    channelsCache = null;
    lastFetched = 0;
    const res = await fetch(getApiUrl("/api/admin/channels/reset-default"), {
      method: "POST",
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async adminAssignNumbers(startFrom: number = 0): Promise<void> {
    channelsCache = null;
    lastFetched = 0;
    const res = await fetch(getApiUrl("/api/admin/channels/assign-numbers"), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ startFrom }),
    });
    await handleResponse(res);
  },

  async resetDatabase(): Promise<void> {
    channelsCache = null;
    lastFetched = 0;
    const res = await fetch(getApiUrl("/api/admin/reset-database"), {
      method: "POST",
      headers: getHeaders(),
    });
    await handleResponse(res);
  },

  async adminFetchUsers(): Promise<User[]> {
    const res = await fetch(getApiUrl("/api/admin/users"), { headers: getHeaders() });
    return handleResponse(res);
  },

  async adminCreateUser(userData: {
    username: string;
    email?: string;
    role?: "admin" | "user";
    subscriptionPlan?: SubscriptionPlan;
  }): Promise<User> {
    const res = await fetch(getApiUrl("/api/admin/users"), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(userData),
    });
    const data = await handleResponse<{ user: User }>(res);
    return data.user;
  },

  async adminDeleteUser(userId: string): Promise<void> {
    const res = await fetch(getApiUrl(`/api/admin/users/${userId}`), {
      method: "DELETE",
      headers: getHeaders(),
    });
    await handleResponse(res);
  },

  async adminUpdateUserSubscription(
    userId: string,
    plan: SubscriptionPlan,
  ): Promise<User> {
    const res = await fetch(getApiUrl(`/api/admin/users/${userId}/subscription`), {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify({ plan }),
    });
    return handleResponse(res);
  },

  async adminUpdateUserAdultAccess(
    userId: string,
    hasAdultAccess: boolean,
  ): Promise<User> {
    const res = await fetch(getApiUrl(`/api/admin/users/${userId}/adult-access`), {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify({ hasAdultAccess }),
    });
    return handleResponse(res);
  },

  async adminApproveUser(userId: string): Promise<{ message: string }> {
    const res = await fetch(getApiUrl(`/api/admin/users/${userId}/approve`), {
      method: "POST",
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async adminFetchPayments(): Promise<any[]> {
    try {
      const res = await fetch(getApiUrl("/api/admin/payments"), { headers: getHeaders() });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return [];
  },

  async adminAddSamplePayments(): Promise<any[]> {
    try {
      const res = await fetch(getApiUrl("/api/admin/payments/sample"), {
        method: "POST",
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        return data.payments || [];
      }
    } catch (e) {}
    return [];
  },

  async adminApprovePayment(paymentId: string, userId?: string, plan?: string): Promise<{ message: string }> {
    const idToUse = paymentId || userId || "default";
    const res = await fetch(getApiUrl(`/api/admin/payments/${encodeURIComponent(idToUse)}/approve`), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ userId, plan })
    });
    return handleResponse(res);
  },

  async adminRejectPayment(paymentId: string, userId?: string): Promise<{ message: string }> {
    const idToUse = paymentId || userId || "default";
    const res = await fetch(getApiUrl(`/api/admin/payments/${encodeURIComponent(idToUse)}/reject`), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ userId })
    });
    return handleResponse(res);
  },

  async adminDeletePayment(paymentId: string, details?: { userId?: string; userName?: string; transactionId?: string }): Promise<{ message: string }> {
    const safeId = encodeURIComponent(paymentId || "default");
    const res = await fetch(getApiUrl(`/api/admin/payments/${safeId}`), {
      method: "DELETE",
      headers: getHeaders(),
      body: JSON.stringify(details || {})
    });
    return handleResponse(res);
  },

  async adminFetchStats(): Promise<{
    totalChannels: number;
    activeChannels: number;
    premiumChannels: number;
    totalUsers: number;
    activeSubscriptions: number;
  }> {
    const res = await fetch(getApiUrl("/api/admin/stats"), { headers: getHeaders() });
    return handleResponse(res);
  },
};

