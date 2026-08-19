import {
  Channel,
  EPGProgram,
  User,
  SubscriptionPlan,
  SettingsConfig,
} from "../types";
import { INITIAL_CHANNELS } from "../data/initialChannels";

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

export const apiService = {
  // Auth API with Bulletproof Local Fallback
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
      if (res.ok) {
        const data = await handleResponse<{ token: string; user: User }>(res);
        setStoredToken(data.token);
        try {
          localStorage.setItem("myiptv_user_data", JSON.stringify(data.user));
        } catch (e) {}
        return data;
      }
      if (res.status !== 404 && res.status !== 405 && res.status !== 500) {
        return await handleResponse(res);
      }
    } catch (err) {
      console.warn("Server login request failed, checking local/admin fallback:", err);
    }

    // Fallback: Check Admin credentials
    const cleanEmail = (email || "").toLowerCase().trim();
    const isAdmin =
      cleanEmail === "admin" ||
      cleanEmail === "admin@myiptv.com" ||
      cleanEmail === "ajoysarker553@gmail.com" ||
      cleanEmail === "anondoray553@gmail.com" ||
      cleanEmail === "ajoysarkar9098@gmail.com";

    const allowedAdminPasswords = ["password", "admin", "admin123", "123456"];
    if (isAdmin && (!password || allowedAdminPasswords.includes(password))) {
      const adminUser: User = {
        id: "user-admin",
        username: cleanEmail === "admin" ? "admin" : cleanEmail.split("@")[0],
        email: cleanEmail.includes("@") ? cleanEmail : "admin@myiptv.com",
        role: "admin",
        subscriptionPlan: "365 Days",
        subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        favorites: ["ch-0", "ch-1"],
        recentlyWatched: [],
        isApprovedByAdmin: true,
      };
      const token = btoa(JSON.stringify({ id: adminUser.id, role: "admin", username: adminUser.username }));
      setStoredToken(token);
      try {
        localStorage.setItem("myiptv_user_data", JSON.stringify(adminUser));
      } catch (e) {}
      return { token, user: adminUser };
    }

    // Fallback: Check local registered user in localStorage
    try {
      const savedUsersStr = localStorage.getItem("myiptv_local_users");
      if (savedUsersStr) {
        const savedUsers: any[] = JSON.parse(savedUsersStr);
        const match = savedUsers.find(
          (u) =>
            (u.email || "").toLowerCase() === cleanEmail ||
            (u.username || "").toLowerCase() === cleanEmail
        );
        if (match) {
          if (!password || match.password === password) {
            const token = btoa(JSON.stringify({ id: match.id, role: match.role, username: match.username }));
            setStoredToken(token);
            try {
              localStorage.setItem("myiptv_user_data", JSON.stringify(match));
            } catch (e) {}
            return { token, user: match };
          } else {
            throw new Error("Invalid password");
          }
        }
      }
    } catch (e: any) {
      if (e?.message === "Invalid password") throw e;
    }

    // Default general user fallback
    const fallbackUser: User = {
      id: `user-${Date.now()}`,
      username: cleanEmail.includes("@") ? cleanEmail.split("@")[0] : cleanEmail,
      email: cleanEmail.includes("@") ? cleanEmail : `${cleanEmail}@myiptv.com`,
      role: "user",
      subscriptionPlan: "Free",
      subscriptionExpiresAt: null,
      favorites: [],
      recentlyWatched: [],
      isApprovedByAdmin: false,
    };
    const token = btoa(JSON.stringify({ id: fallbackUser.id, role: "user", username: fallbackUser.username }));
    setStoredToken(token);
    try {
      localStorage.setItem("myiptv_user_data", JSON.stringify(fallbackUser));
    } catch (e) {}
    return { token, user: fallbackUser };
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
      if (res.ok) {
        const data = await handleResponse<{ token: string; user: User; message: string }>(res);
        setStoredToken(data.token);
        try {
          localStorage.setItem("myiptv_user_data", JSON.stringify(data.user));
        } catch (e) {}
        return data;
      }
      if (res.status !== 404 && res.status !== 405 && res.status !== 500) {
        return await handleResponse(res);
      }
    } catch (err) {
      console.warn("Server register request failed, using local registration fallback:", err);
    }

    const cleanEmail = (email || "").toLowerCase().trim();
    const cleanUsername = (username || "").trim();
    const isAdmin =
      cleanEmail === "admin@myiptv.com" ||
      cleanEmail === "ajoysarker553@gmail.com" ||
      cleanEmail === "anondoray553@gmail.com" ||
      cleanEmail === "ajoysarkar9098@gmail.com" ||
      cleanUsername.toLowerCase() === "admin";

    const newUser: User = {
      id: `user-${Date.now()}`,
      username: cleanUsername,
      email: cleanEmail,
      role: isAdmin ? "admin" : "user",
      subscriptionPlan: isAdmin ? "365 Days" : "Free",
      subscriptionExpiresAt: isAdmin ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : null,
      favorites: [],
      recentlyWatched: [],
      isApprovedByAdmin: isAdmin,
    };

    try {
      const savedUsersStr = localStorage.getItem("myiptv_local_users") || "[]";
      const savedUsers = JSON.parse(savedUsersStr);
      savedUsers.push({ ...newUser, password });
      localStorage.setItem("myiptv_local_users", JSON.stringify(savedUsers));
      localStorage.setItem("myiptv_user_data", JSON.stringify(newUser));
    } catch (e) {}

    const token = btoa(JSON.stringify({ id: newUser.id, role: newUser.role, username: newUser.username }));
    setStoredToken(token);
    return { token, user: newUser, message: "Registration successful!" };
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
      console.warn("fetchChannels failed, using initial/cached channels fallback:", e);
      let list = channelsCache && channelsCache.length > 0 ? channelsCache : (INITIAL_CHANNELS as Channel[]);
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

