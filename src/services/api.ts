import {
  Channel,
  EPGProgram,
  User,
  SubscriptionPlan,
  SettingsConfig,
} from "../types";
import { INITIAL_CHANNELS } from "../data/initialChannels";
import {
  parseM3UClient,
  saveChannelsDirect,
  getStoredChannelsDirect,
  deleteChannelDirect,
  clearAllChannelsDirect,
  restoreDefaultChannelsDirect,
} from "../utils/m3uClientParser";
import {
  getStoredPaymentsDirect,
  savePaymentRecordDirect,
  approvePaymentDirect,
  rejectPaymentDirect,
  deletePaymentDirect,
} from "../utils/paymentStorage";

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
 */
export const getApiUrl = (path: string): string => {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  
  const isNative = typeof window !== "undefined" && 
    (window.location.protocol === "capacitor:" || window.location.protocol === "file:");
  
  const base = isNative ? "http://localhost:3000" : "";
  return `${base}${path}`;
};

const getStoredChannelsFallback = (): Channel[] => {
  return getStoredChannelsDirect();
};

export const apiService = {
  // Auth API
  async login(
    email: string,
    password?: string,
  ): Promise<{ token: string; user: User }> {
    try {
      const res = await fetch(getApiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (res.ok && data.token && data.user) {
        setStoredToken(data.token);
        try {
          localStorage.setItem("myiptv_user_data", JSON.stringify(data.user));
        } catch (e) {}
        return data;
      } else {
        throw new Error(data.error || `Authentication failed: ${res.status}`);
      }
    } catch (err: any) {
      console.error("Login request failed:", err);
      throw err;
    }
  },

  async register(
    username: string,
    email: string,
    password?: string,
  ): Promise<{ token: string; user: User; message: string }> {
    try {
      const res = await fetch(getApiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (res.ok && data.token && data.user) {
        setStoredToken(data.token);
        try {
          localStorage.setItem("myiptv_user_data", JSON.stringify(data.user));
        } catch (e) {}
        return data;
      } else {
        throw new Error(data.error || `Registration failed: ${res.status}`);
      }
    } catch (err: any) {
      console.error("Registration request failed:", err);
      throw err;
    }
  },

  async getCurrentUser(): Promise<User | null> {
    const token = getStoredToken();
    if (!token) return null;
    try {
      const res = await fetch(getApiUrl("/api/auth/me"), { headers: getHeaders() });
      if (res.ok) {
        const data = await handleResponse<{ user: User }>(res);
        if (data.user) {
          try {
            localStorage.setItem("myiptv_user_data", JSON.stringify(data.user));
          } catch (e) {}
          return data.user;
        }
      }
    } catch {}

    try {
      const localData = localStorage.getItem("myiptv_user_data");
      if (localData) {
        return JSON.parse(localData);
      }
      const decoded = JSON.parse(atob(token));
      if (decoded && decoded.id) {
        return {
          id: decoded.id,
          username: decoded.username || "User",
          email: decoded.email || "user@myiptv.com",
          role: decoded.role || "user",
          subscriptionPlan: decoded.role === "admin" ? "365 Days" : (decoded.plan || "Free"),
          subscriptionExpiresAt: decoded.role === "admin" ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : null,
          favorites: [],
          recentlyWatched: [],
          isApprovedByAdmin: decoded.role === "admin",
        };
      }
    } catch {}
    return null;
  },

  logout() {
    setStoredToken(null);
    channelsCache = null;
    try {
      localStorage.removeItem("myiptv_user_data");
    } catch (e) {}
  },

  async updateSubscription(
    plan: SubscriptionPlan,
    transactionId?: string,
    senderNumber?: string,
    paymentMethod?: string,
    amount?: string,
  ): Promise<User> {
    channelsCache = null;
    try {
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
      if (res.ok) {
        const data = await handleResponse<{ user: User }>(res);
        if (data.user) {
          try {
            localStorage.setItem("myiptv_user_data", JSON.stringify(data.user));
          } catch (e) {}
          return data.user;
        }
      }
    } catch (err) {
      console.warn("Server subscription update failed, saving locally:", err);
    }

    // Direct Browser & Firestore Persistence Fallback
    const currentUser = await this.getCurrentUser();
    const userId = currentUser?.id || `user_${Date.now()}`;
    const userName = currentUser?.email || currentUser?.username || "Subscriber";

    const paymentRecord = {
      id: `trx_${transactionId || Date.now()}`,
      userId: userId,
      userName: userName,
      amount: amount || (plan.includes("100") ? "৳100" : plan.includes("45") ? "৳45" : "৳10"),
      plan: plan,
      transactionId: transactionId || `TRX${Date.now()}`,
      senderNumber: senderNumber || "01700000000",
      paymentMethod: paymentMethod || "bKash",
      status: "Pending" as const,
      createdAt: new Date().toISOString(),
    };

    await savePaymentRecordDirect(paymentRecord);

    const updatedUser: User = {
      ...(currentUser || {
        id: userId,
        username: userName,
        email: userName,
        role: "user",
        favorites: [],
        recentlyWatched: [],
      }),
      subscriptionPlan: plan,
      isApprovedByAdmin: false,
      subscriptionStatus: "pending",
      paymentStatus: "Pending",
    };

    try {
      localStorage.setItem("myiptv_user_data", JSON.stringify(updatedUser));
    } catch (e) {}

    return updatedUser;
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
      console.warn("fetchChannels failed, using initial/cached channels fallback:", e);
      let list = getStoredChannelsFallback();
      if (category && category !== "All") {
        list = list.filter((c) => c.category === category);
      }
      if (search) {
        const q = search.toLowerCase();
        list = list.filter((c) => c.name.toLowerCase().includes(q));
      }
      return list;
    }
  },

  async fetchCategories(): Promise<string[]> {
    try {
      const res = await fetch(getApiUrl("/api/categories"), {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await handleResponse<any>(res);
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.categories)) return data.categories;
      }
    } catch (e) {
      console.warn("Failed to fetch categories, falling back to dynamic channel list:", e);
    }

    const all = getStoredChannelsFallback();
    const cats = Array.from(new Set(all.map((c) => c.category).filter(Boolean)));
    if (cats.length === 0) {
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
    return ["All", ...cats.filter((c) => c !== "All")];
  },

  async getStreamInfo(channelId: string): Promise<{
    channelId: string;
    name: string;
    category: string;
    channelNumber: number;
    streamUrl: string;
    isPremium: boolean;
  }> {
    try {
      const res = await fetch(getApiUrl(`/api/stream/${channelId}`), {
        headers: getHeaders(),
      });
      if (res.ok) {
        return await handleResponse(res);
      }
    } catch (e) {
      console.warn("getStreamInfo server error, fallback to initial channel:", e);
    }

    const found = (channelsCache || INITIAL_CHANNELS || []).find((c) => c.id === channelId);
    if (found) {
      return {
        channelId: found.id,
        name: found.name,
        category: found.category,
        channelNumber: found.channelNumber,
        streamUrl: found.streamUrl,
        isPremium: found.isPremium,
      };
    }
    throw new Error("Channel stream not found");
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

  // ADMIN API with Direct Client-Side Fallback
  async uploadM3U(
    m3uContent: string,
    overwrite: boolean = true,
  ): Promise<{ message: string; addedCount: number; totalChannels: number }> {
    channelsCache = null;
    lastFetched = 0;
    try {
      const res = await fetch(getApiUrl("/api/admin/m3u/upload"), {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ m3uContent, overwrite }),
      });
      if (res.ok) {
        return await handleResponse(res);
      }
    } catch (e) {
      console.warn("Server uploadM3U failed, executing in-browser parser:", e);
    }

    // Direct Browser Parser Fallback
    const result = parseM3UClient(m3uContent);
    if (result.channels.length === 0) {
      throw new Error("No valid #EXTINF stream channels found in the M3U content.");
    }

    let updatedChannels: Channel[] = [];
    if (overwrite) {
      updatedChannels = result.channels;
    } else {
      const existing = getStoredChannelsFallback();
      const existingUrls = new Set(existing.map((c) => c.streamUrl));
      const newItems = result.channels.filter((c) => !existingUrls.has(c.streamUrl));
      updatedChannels = [...existing, ...newItems];
    }

    // Re-index channel numbers
    updatedChannels.forEach((c, idx) => {
      c.channelNumber = idx;
    });

    await saveChannelsDirect(updatedChannels, "m3u_text");
    return {
      message: `Successfully loaded & saved ${result.totalParsed} channels via M3U parser!`,
      addedCount: result.totalParsed,
      totalChannels: updatedChannels.length,
    };
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
    try {
      const res = await fetch(getApiUrl("/api/admin/m3u/url"), {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ url, overwrite }),
      });
      if (res.ok) {
        return await handleResponse(res);
      }
    } catch (e) {
      console.warn("Server importM3uUrl failed, trying direct browser fetch:", e);
    }

    // Fetch URL from browser (with CORS proxy if needed)
    let content = "";
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        content = await resp.text();
      } else {
        throw new Error("Direct fetch failed");
      }
    } catch {
      try {
        const proxyResp = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
        if (proxyResp.ok) {
          content = await proxyResp.text();
        }
      } catch (err) {
        throw new Error("Failed to fetch playlist URL. Check CORS or URL availability.");
      }
    }

    if (!content) {
      throw new Error("Empty response received from playlist URL.");
    }

    const result = parseM3UClient(content, url);
    if (result.channels.length === 0) {
      throw new Error("No channels could be parsed from the provided M3U link.");
    }

    let updatedChannels: Channel[] = [];
    if (overwrite) {
      updatedChannels = result.channels;
    } else {
      const existing = getStoredChannelsFallback();
      const existingUrls = new Set(existing.map((c) => c.streamUrl));
      const newItems = result.channels.filter((c) => !existingUrls.has(c.streamUrl));
      updatedChannels = [...existing, ...newItems];
    }

    updatedChannels.forEach((c, idx) => {
      c.channelNumber = idx;
    });

    await saveChannelsDirect(updatedChannels, "m3u_url", url);
    return {
      message: `Successfully imported ${result.totalParsed} channels from M3U URL!`,
      addedCount: result.totalParsed,
      totalChannels: updatedChannels.length,
      sourceUrl: url,
    };
  },

  async importXtreamCodes(
    serverUrl: string,
    username: string,
    password: string,
    overwrite: boolean = true,
  ): Promise<{ message: string; addedCount: number; totalChannels: number }> {
    channelsCache = null;
    lastFetched = 0;
    try {
      const res = await fetch(getApiUrl("/api/admin/xtream/connect"), {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ serverUrl, username, password, overwrite }),
      });
      if (res.ok) {
        return await handleResponse(res);
      }
    } catch (e) {
      console.warn("Server Xtream connect failed, fetching M3U via player_api:", e);
    }

    // Xtream M3U URL format
    const cleanServer = serverUrl.replace(/\/+$/, "");
    const xtreamM3uUrl = `${cleanServer}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus&output=m3u8`;

    return await this.importM3uUrl(xtreamM3uUrl, overwrite);
  },

  async getPlaylistSource(): Promise<{
    type: "default" | "m3u_text" | "m3u_url" | "xtream";
    url: string;
    xtreamServer: string;
    xtreamUser: string;
    lastSyncedAt: string;
    totalChannels: number;
  }> {
    try {
      const res = await fetch(getApiUrl("/api/admin/playlist-source"), {
        headers: getHeaders(),
      });
      if (res.ok) {
        return await handleResponse(res);
      }
    } catch (e) {}

    try {
      const local = localStorage.getItem("myiptv_playlist_source");
      if (local) return JSON.parse(local);
    } catch (e) {}

    const channels = getStoredChannelsFallback();
    return {
      type: "default",
      url: "",
      xtreamServer: "",
      xtreamUser: "",
      lastSyncedAt: new Date().toISOString(),
      totalChannels: channels.length,
    };
  },

  async adminFetchChannels(search?: string, limit: number = 500, offset: number = 0): Promise<{ channels: Channel[]; total: number }> {
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      params.append("limit", limit.toString());
      params.append("offset", offset.toString());

      const res = await fetch(getApiUrl(`/api/admin/channels?${params.toString()}`), { headers: getHeaders() });
      if (res.ok) {
        const data = await handleResponse<any>(res);
        if (Array.isArray(data)) {
          return { channels: data, total: data.length };
        }
        if (data && Array.isArray(data.channels)) {
          return data;
        }
      }
    } catch (e) {
      console.warn("adminFetchChannels server error, using fallback channels:", e);
    }

    const all = getStoredChannelsFallback();
    let filtered = all;
    if (search) {
      const q = search.toLowerCase();
      filtered = all.filter((c) => (c.name || "").toLowerCase().includes(q) || (c.category || "").toLowerCase().includes(q));
    }
    return {
      channels: filtered.slice(offset, offset + limit),
      total: filtered.length,
    };
  },

  async adminUpdateChannel(
    id: string,
    updates: Partial<Channel>,
  ): Promise<Channel> {
    channelsCache = null;
    lastFetched = 0;
    try {
      const res = await fetch(getApiUrl(`/api/admin/channels/${id}`), {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        return await handleResponse(res);
      }
    } catch (e) {}

    const channels = getStoredChannelsFallback();
    const idx = channels.findIndex((c) => c.id === id);
    if (idx !== -1) {
      channels[idx] = { ...channels[idx], ...updates };
      await saveChannelsDirect(channels);
      return channels[idx];
    }
    throw new Error("Channel not found");
  },

  async adminDeleteChannel(id: string): Promise<void> {
    channelsCache = null;
    lastFetched = 0;
    try {
      const res = await fetch(getApiUrl(`/api/admin/channels/${id}`), {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (res.ok) {
        await handleResponse(res);
      }
    } catch (e) {}

    await deleteChannelDirect(id);
  },

  async adminClearChannels(): Promise<{ message: string }> {
    channelsCache = null;
    lastFetched = 0;
    try {
      const res = await fetch(getApiUrl("/api/admin/channels/clear"), {
        method: "POST",
        headers: getHeaders(),
      });
      if (res.ok) {
        return await handleResponse(res);
      }
    } catch (e) {}

    await clearAllChannelsDirect();
    return { message: "All channels cleared successfully!" };
  },

  async adminResetDefaultChannels(): Promise<{ message: string; totalChannels: number; channels: Channel[] }> {
    channelsCache = null;
    lastFetched = 0;
    try {
      const res = await fetch(getApiUrl("/api/admin/channels/reset-default"), {
        method: "POST",
        headers: getHeaders(),
      });
      if (res.ok) {
        return await handleResponse(res);
      }
    } catch (e) {}

    const channels = await restoreDefaultChannelsDirect();
    return {
      message: "Reset channels to default successfully!",
      totalChannels: channels.length,
      channels: channels,
    };
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
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch (e) {}
    return getStoredPaymentsDirect();
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
    return getStoredPaymentsDirect();
  },

  async adminApprovePayment(paymentId: string, userId?: string, plan?: string): Promise<{ message: string }> {
    try {
      const idToUse = paymentId || userId || "default";
      const res = await fetch(getApiUrl(`/api/admin/payments/${encodeURIComponent(idToUse)}/approve`), {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ userId, plan })
      });
      if (res.ok) {
        return await handleResponse(res);
      }
    } catch (e) {}

    await approvePaymentDirect(paymentId, userId, plan);
    return { message: "Payment approved successfully!" };
  },

  async adminRejectPayment(paymentId: string, userId?: string): Promise<{ message: string }> {
    try {
      const idToUse = paymentId || userId || "default";
      const res = await fetch(getApiUrl(`/api/admin/payments/${encodeURIComponent(idToUse)}/reject`), {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ userId })
      });
      if (res.ok) {
        return await handleResponse(res);
      }
    } catch (e) {}

    await rejectPaymentDirect(paymentId, userId);
    return { message: "Payment marked as rejected" };
  },

  async adminDeletePayment(paymentId: string, details?: { userId?: string; userName?: string; transactionId?: string }): Promise<{ message: string }> {
    try {
      const safeId = encodeURIComponent(paymentId || "default");
      const res = await fetch(getApiUrl(`/api/admin/payments/${safeId}`), {
        method: "DELETE",
        headers: getHeaders(),
        body: JSON.stringify(details || {})
      });
      if (res.ok) {
        return await handleResponse(res);
      }
    } catch (e) {}

    await deletePaymentDirect(paymentId);
    return { message: "Payment deleted successfully" };
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

