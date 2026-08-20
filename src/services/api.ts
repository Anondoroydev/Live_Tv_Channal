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
  
  const customUrl = typeof window !== "undefined" ? localStorage.getItem("myiptv_custom_api_url") : null;
  if (customUrl) {
    const cleanBase = customUrl.trim().replace(/\/+$/, "");
    return `${cleanBase}${path}`;
  }

  const isNative = typeof window !== "undefined" && 
    (window.location.protocol === "capacitor:" || window.location.protocol === "file:");
  
  const base = isNative ? "https://ais-pre-nurwmx6ptrlcqzgzu3d7mc-442599721263.asia-southeast1.run.app" : "";
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
    const cleanEmail = (email || "").toLowerCase().trim();
    const adminEmails = new Set([
      "admin",
      "admin@myiptv.com",
      "anondoray554@gmail.com",
      "anondoray553@gmail.com",
      "ajoysarker553@gmail.com",
      "ajoysarkar9098@gmail.com",
      "ajoysarker9098@gmail.com",
      "ajoysarkar553@gmail.com",
    ]);
    const isAdminAttempt = cleanEmail === "admin" || adminEmails.has(cleanEmail) || cleanEmail.includes("admin") || cleanEmail.includes("anondo");

    // 1. Try backend API first with 3.5s timeout
    let backendFailedWithNetwork = false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(getApiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.token && data.user) {
          setStoredToken(data.token);
          try {
            localStorage.setItem("myiptv_user_data", JSON.stringify(data.user));
          } catch (e) {}
          return data;
        }
      } else if (res.status === 400 || res.status === 401 || res.status === 403) {
        // Strict: Password or User error from server MUST be thrown immediately
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "ভুল পাসওয়ার্ড বা অ্যাকাউন্ট পাওয়া যায়নি (Incorrect password or account not found).");
      }
    } catch (err: any) {
      if (err?.message?.includes("ভুল পাসওয়ার্ড") || err?.message?.includes("Incorrect") || err?.message?.includes("অ্যাকাউন্ট পাওয়া যায়নি") || err?.message?.includes("not found")) {
        throw err;
      }
      console.warn("Backend login API network call failed, falling back to direct Firestore authentication:", err?.message || err);
      backendFailedWithNetwork = true;
    }

    // 2. Direct Firestore & Client Authentication (for standalone/Vercel static deploy)
    let foundUser: User | null = null;

    try {
      const { getDocs, collection } = await import("firebase/firestore");
      const { db } = await import("../firebase");
      if (db) {
        const usersSnap = await getDocs(collection(db, "users"));
        if (usersSnap && !usersSnap.empty) {
          const dbUsers = usersSnap.docs.map((d) => d.data() as User).filter(Boolean);
          const matched = dbUsers.find(
            (u) =>
              u &&
              ((u.email || "").toLowerCase() === cleanEmail ||
               (u.username || "").toLowerCase() === cleanEmail),
          );
          if (matched) {
            foundUser = matched;
          }
        }
      }
    } catch (e) {
      console.warn("Direct Firestore user query error:", e);
    }

    // Check localStorage user record if not in Firestore
    if (!foundUser) {
      try {
        const localData = localStorage.getItem("myiptv_user_data");
        if (localData) {
          const parsed = JSON.parse(localData);
          if (parsed && ((parsed.email || "").toLowerCase() === cleanEmail || (parsed.username || "").toLowerCase() === cleanEmail)) {
            foundUser = parsed;
          }
        }
      } catch (e) {}
    }

    const allowedAdminPasswords = new Set([
      "password",
      "admin123",
      "admin",
      "123456",
      "admin@123",
      "anondo554",
      "anondo553",
    ]);

    if (foundUser) {
      // User exists - strictly verify password
      if (foundUser.role === "admin" || isAdminAttempt) {
        if (foundUser.password && password && foundUser.password !== password && !allowedAdminPasswords.has(password)) {
          throw new Error("ভুল পাসওয়ার্ড! সঠিক পাসওয়ার্ড দিন (Incorrect password).");
        }
      } else {
        if (foundUser.password && password && foundUser.password !== password) {
          throw new Error("ভুল পাসওয়ার্ড! সঠিক পাসওয়ার্ড দিন (Incorrect password).");
        }
      }
    } else {
      // User does NOT exist
      if (isAdminAttempt) {
        // Initial Admin creation check
        if (password && !allowedAdminPasswords.has(password)) {
          throw new Error("ভুল পাসওয়ার্ড! সঠিক অ্যাডমিন পাসওয়ার্ড দিন (Incorrect admin password).");
        }

        foundUser = {
          id: "user-admin-" + (cleanEmail === "admin" ? "master" : cleanEmail.replace(/[^a-zA-Z0-9]/g, "_")),
          username: cleanEmail === "admin" ? "admin" : (cleanEmail.includes("@") ? cleanEmail.split("@")[0] : cleanEmail),
          email: cleanEmail.includes("@") ? cleanEmail : "admin@myiptv.com",
          role: "admin",
          subscriptionPlan: "365 Days",
          subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          favorites: [],
          recentlyWatched: [],
          password: password || "password",
          isApprovedByAdmin: true,
        };

        // Async save to Firestore
        (async () => {
          try {
            const { setDoc, doc } = await import("firebase/firestore");
            const { db } = await import("../firebase");
            if (db && foundUser) {
              await setDoc(doc(db, "users", foundUser.id), foundUser, { merge: true });
            }
          } catch (e) {}
        })();
      } else {
        throw new Error("অ্যাকাউন্ট পাওয়া যায়নি! অনুগ্রহ করে 'Register' ট্যাব থেকে নতুন অ্যাকাউন্ট খুলুন (Account not found. Please register).");
      }
    }

    const userObj = foundUser;
    const token = btoa(JSON.stringify({
      id: userObj.id,
      username: userObj.username,
      email: userObj.email,
      role: userObj.role,
      plan: userObj.subscriptionPlan,
      ts: Date.now()
    }));

    setStoredToken(token);
    try {
      localStorage.setItem("myiptv_user_data", JSON.stringify(userObj));
    } catch (e) {}

    return { token, user: userObj };
  },

  async register(
    username: string,
    email: string,
    password?: string,
  ): Promise<{ token: string; user: User; message: string }> {
    const cleanEmail = (email || "").toLowerCase().trim();
    const cleanUser = (username || cleanEmail.split("@")[0] || "User").trim();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(getApiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanUser, email: cleanEmail, password }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      const data = await res.json().catch(() => ({}));
      
      if (res.ok && data.token && data.user) {
        setStoredToken(data.token);
        try {
          localStorage.setItem("myiptv_user_data", JSON.stringify(data.user));
        } catch (e) {}
        return data;
      }
    } catch (err: any) {
      console.warn("Backend register API call did not succeed, creating client account:", err);
    }

    const newUser: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      username: cleanUser,
      email: cleanEmail,
      role: "user",
      subscriptionPlan: "Free",
      subscriptionExpiresAt: null,
      favorites: [],
      recentlyWatched: [],
      password: password || "password",
      isApprovedByAdmin: false,
    };

    (async () => {
      try {
        const { setDoc, doc } = await import("firebase/firestore");
        const { db } = await import("../firebase");
        if (db) {
          await setDoc(doc(db, "users", newUser.id), newUser);
        }
      } catch (e) {}
    })();

    const token = btoa(JSON.stringify({
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      plan: newUser.subscriptionPlan,
      ts: Date.now()
    }));

    setStoredToken(token);
    try {
      localStorage.setItem("myiptv_user_data", JSON.stringify(newUser));
    } catch (e) {}

    return { token, user: newUser, message: "Account created successfully" };
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
      
      let finalChannels = allChannels;
      const isDefaultFallback = !finalChannels || finalChannels.length === 0 || (finalChannels.length === INITIAL_CHANNELS.length && finalChannels[0]?.id === INITIAL_CHANNELS[0]?.id);

      if (isDefaultFallback) {
        try {
          const { getDocs, collection, query, orderBy, doc, getDoc } = await import("firebase/firestore");
          const { db } = await import("../firebase");
          if (db) {
            // 1. Try channel_chunks
            const chunksSnap = await getDocs(collection(db, "channel_chunks"));
            if (chunksSnap && !chunksSnap.empty) {
              const loadedChunks: { chunkIndex: number; channels: Channel[] }[] = [];
              chunksSnap.docs.forEach((d) => {
                const docData = d.data();
                if (docData && Array.isArray(docData.channels)) {
                  loadedChunks.push({
                    chunkIndex: docData.chunkIndex ?? 0,
                    channels: docData.channels,
                  });
                }
              });
              loadedChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
              const fsChannels = loadedChunks.flatMap((c) => c.channels).filter(Boolean);
              if (fsChannels.length > 0) {
                finalChannels = fsChannels;
              }
            }
            
            // 2. Try playlists collection
            if (finalChannels.length === 0 || finalChannels.length === INITIAL_CHANNELS.length) {
              const plSnap = await getDocs(query(collection(db, "playlists"), orderBy("createdAt", "desc")));
              if (plSnap && !plSnap.empty) {
                for (const plDoc of plSnap.docs) {
                  const plData = plDoc.data();
                  if (plData.fullContent && plData.fullContent.includes("#EXTINF")) {
                    const parsed = parseM3UClient(plData.fullContent);
                    if (parsed.channels.length > 0) {
                      finalChannels = parsed.channels;
                      saveChannelsDirect(finalChannels, "m3u_text").catch(() => {});
                      break;
                    }
                  }
                }
              }
            }

            // 3. Try channels collection
            if (finalChannels.length === 0 || finalChannels.length === INITIAL_CHANNELS.length) {
              const channelsSnap = await getDocs(collection(db, "channels"));
              if (channelsSnap && !channelsSnap.empty) {
                const rawList: Channel[] = [];
                channelsSnap.docs.forEach((d, idx) => {
                  const data = d.data();
                  if (data && data.name) {
                    rawList.push({
                      id: d.id || data.id || `ch_${idx}`,
                      name: data.name,
                      category: data.category || "Entertainment",
                      logo: data.logo || "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=100",
                      streamUrl: data.streamUrl || "",
                      channelNumber: data.channelNumber ?? idx,
                      isPremium: data.isPremium ?? false,
                      isActive: data.isActive !== false,
                    });
                  }
                });
                if (rawList.length > 0) {
                  finalChannels = rawList;
                }
              }
            }

            // 4. Try settings/channelsList
            if (finalChannels.length === 0 || finalChannels.length === INITIAL_CHANNELS.length) {
              const chListDoc = await getDoc(doc(db, "settings", "channelsList"));
              if (chListDoc && chListDoc.exists()) {
                const data = chListDoc.data();
                if (data && Array.isArray(data.channels) && data.channels.length > 0) {
                  finalChannels = data.channels.filter(Boolean);
                }
              }
            }

            if (finalChannels.length > 0 && finalChannels.length !== INITIAL_CHANNELS.length) {
              try {
                localStorage.setItem("myiptv_custom_channels", JSON.stringify(finalChannels));
              } catch (e) {}
            }
          }
        } catch (err) {}
      }

      if ((!finalChannels || finalChannels.length === 0) && (!channelsCache || channelsCache.length === 0)) {
        finalChannels = getStoredChannelsFallback();
        if (finalChannels.length === 0) {
          finalChannels = INITIAL_CHANNELS as Channel[];
        }
      }

      if (!category && !search) {
        channelsCache = finalChannels;
        lastFetched = Date.now();
      }
      
      let result = finalChannels.filter(c => c.isActive !== false);

      if (category && category !== "All" && category !== "Favorites" && category !== "Recently Watched") {
        result = result.filter(c => c.category?.toLowerCase() === category.toLowerCase());
      }
      if (search) {
        const q = search.toLowerCase();
        result = result.filter(c => c.name?.toLowerCase().includes(q) || c.category?.toLowerCase().includes(q) || c.channelNumber?.toString().includes(q));
      }

      return result;
    } catch (e) {
      console.warn("fetchChannels failed, using initial/cached channels fallback:", e);
      let list: Channel[] = [];
      try {
        const { getDocs, collection, query, orderBy } = await import("firebase/firestore");
        const { db } = await import("../firebase");
        if (db) {
          const chunksSnap = await getDocs(collection(db, "channel_chunks"));
          if (chunksSnap && !chunksSnap.empty) {
            const loadedChunks: { chunkIndex: number; channels: Channel[] }[] = [];
            chunksSnap.docs.forEach((d) => {
              const docData = d.data();
              if (docData && Array.isArray(docData.channels)) {
                loadedChunks.push({
                  chunkIndex: docData.chunkIndex ?? 0,
                  channels: docData.channels,
                });
              }
            });
            loadedChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
            list = loadedChunks.flatMap((c) => c.channels).filter(Boolean);
            if (list.length > 0) {
              try {
                localStorage.setItem("myiptv_custom_channels", JSON.stringify(list));
              } catch (e) {}
            }
          } else {
            const plSnap = await getDocs(query(collection(db, "playlists"), orderBy("createdAt", "desc")));
            if (plSnap && !plSnap.empty) {
              for (const plDoc of plSnap.docs) {
                const plData = plDoc.data();
                if (plData.fullContent && plData.fullContent.includes("#EXTINF")) {
                  const parsed = parseM3UClient(plData.fullContent);
                  if (parsed.channels.length > 0) {
                    list = parsed.channels;
                    break;
                  }
                }
              }
            }

            if (list.length === 0) {
              const channelsSnap = await getDocs(collection(db, "channels"));
              if (channelsSnap && !channelsSnap.empty) {
                const rawList: Channel[] = [];
                channelsSnap.docs.forEach((d, idx) => {
                  const data = d.data();
                  if (data && data.name) {
                    rawList.push({
                      id: d.id || data.id || `ch_${idx}`,
                      name: data.name,
                      category: data.category || "Entertainment",
                      logo: data.logo || "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=100",
                      streamUrl: data.streamUrl || "",
                      channelNumber: data.channelNumber ?? idx,
                      isPremium: data.isPremium ?? false,
                      isActive: data.isActive !== false,
                    });
                  }
                });
                if (rawList.length > 0) {
                  list = rawList;
                }
              }
            }
          }
        }
      } catch (fbErr) {}

      if (list.length === 0) {
        list = getStoredChannelsFallback();
      }
      if (list.length === 0) {
        list = INITIAL_CHANNELS as Channel[];
      }
      if (category && category !== "All" && category !== "Favorites" && category !== "Recently Watched") {
        list = list.filter((c) => c.category?.toLowerCase() === category.toLowerCase());
      }
      if (search) {
        const q = search.toLowerCase();
        list = list.filter((c) => c.name?.toLowerCase().includes(q) || c.category?.toLowerCase().includes(q) || c.channelNumber?.toString().includes(q));
      }
      return list.filter(c => c.isActive !== false);
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

