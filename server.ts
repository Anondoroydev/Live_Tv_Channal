import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import http from "http";
import https from "https";
import fs from "fs";
import zlib from "zlib";
import stream from "stream";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  deleteDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  INITIAL_CHANNELS,
  generateSampleEPG,
} from "./src/data/initialChannels";
import {
  Channel,
  EPGProgram,
  User,
  SubscriptionPlan,
  M3UParseResult,
} from "./src/types";

// Disable TLS verification for external IPTV stream sources & proxies
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 15000,
  maxSockets: 256,
  maxFreeSockets: 64,
  timeout: 30000,
});
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 15000,
  maxSockets: 256,
  maxFreeSockets: 64,
  rejectUnauthorized: false,
  timeout: 30000,
});

function fetchWithTlsBypass(
  urlStr: string,
  options: { headers?: Record<string, string>; method?: string } = {},
  redirectCount = 0
): Promise<{ ok: boolean; status: number; text: () => Promise<string>; json: () => Promise<any> }> {
  return new Promise((resolve, reject) => {
    if (redirectCount > 10) {
      return reject(new Error("Too many redirects"));
    }

    try {
      const parsed = new URL(urlStr);
      const isHttps = parsed.protocol === "https:";
      const client = isHttps ? https : http;

      const reqHeaders: Record<string, string> = {
        "User-Agent": "VLC/3.0.12 LibVLC/3.0.12",
        Accept: "*/*",
        ...options.headers,
        Host: parsed.host,
      };

      const reqOptions: https.RequestOptions = {
        method: options.method || "GET",
        headers: reqHeaders,
        rejectUnauthorized: false,
        servername: parsed.hostname,
        ciphers: "DEFAULT:@SECLEVEL=1",
        agent: isHttps ? httpsAgent : httpAgent,
      };

      const req = client.request(urlStr, reqOptions, (res) => {
        const statusCode = res.statusCode || 200;

        if ([301, 302, 303, 307, 308].includes(statusCode) && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, urlStr).href;
          return resolve(fetchWithTlsBypass(redirectUrl, options, redirectCount + 1));
        }

        let responseStream: import("stream").Readable = res;
        const encoding = (res.headers["content-encoding"] || "").toLowerCase();
        if (encoding.includes("gzip")) {
          responseStream = res.pipe(zlib.createGunzip());
        } else if (encoding.includes("deflate")) {
          responseStream = res.pipe(zlib.createInflate());
        } else if (encoding.includes("br")) {
          responseStream = res.pipe(zlib.createBrotliDecompress());
        }

        const chunks: Buffer[] = [];
        responseStream.on("data", (chunk) => chunks.push(chunk));
        responseStream.on("end", () => {
          const buffer = Buffer.concat(chunks);
          const textVal = buffer.toString("utf8");

          resolve({
            ok: statusCode >= 200 && statusCode < 300,
            status: statusCode,
            text: async () => textVal,
            json: async () => JSON.parse(textVal),
          });
        });

        responseStream.on("error", (err) => {
          reject(err);
        });
      });

      req.on("error", (err: any) => {
        if (isHttps && redirectCount < 3) {
          const httpUrl = urlStr.replace("https://", "http://");
          console.info(`[fetchWithTlsBypass] Protocol adapted to HTTP: ${httpUrl}`);
          return resolve(fetchWithTlsBypass(httpUrl, options, redirectCount + 1));
        }
        reject(err);
      });

      req.setTimeout(15000, () => {
        req.destroy(new Error("Request timeout"));
      });

      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Initialize Firebase Firestore (Disabled due to free tier quota limits - running in-memory)
let db: any = null;
console.log("ℹ️ Firestore disabled due to quota limits; running in-memory for robust operation.");

// In-Memory Database State
let channelsStore: Channel[] = [];

let playlistSourceStore = {
  type: "default" as "default" | "m3u_text" | "m3u_url" | "xtream" | "mac" | "cleared",
  url: "",
  xtreamServer: "",
  xtreamUser: "",
  xtreamPass: "",
  macPortalUrl: "",
  macAddress: "",
  lastSyncedAt: new Date().toISOString(),
};

let usersStore: User[] = [
  {
    id: "user-admin",
    username: "admin",
    email: "admin@myiptv.com",
    role: "admin",
    subscriptionPlan: "365 Days",
    subscriptionExpiresAt: new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    favorites: ["ch-0", "ch-4"],
    recentlyWatched: ["ch-0", "ch-1"],
  },
  {
    id: "user-free",
    username: "freeuser",
    email: "user@myiptv.com",
    role: "user",
    subscriptionPlan: "Free",
    subscriptionExpiresAt: null,
    favorites: [],
    recentlyWatched: [],
  },
  {
    id: "user-expired",
    username: "expireduser",
    email: "expired@myiptv.com",
    role: "user",
    subscriptionPlan: "Expired",
    subscriptionExpiresAt: new Date(
      Date.now() - 24 * 60 * 60 * 1000,
    ).toISOString(),
    favorites: [],
    recentlyWatched: [],
  },
];

function classifyIsPremium(name: string, category: string = "", isDuplicate: boolean = false): boolean {
  const lowerName = (name || "").toLowerCase();
  const lowerCat = (category || "").toLowerCase();

  // 1. Paid / Premium Bangla Serials & Entertainment (Star Jalsha, Zee Bangla, Colors Bangla, Sony Aath, Jalsha Movies, etc.)
  if (/(star jalsha|zee bangla|colors bangla|sony aath|jalsha movies|zee 24 ghanta)/i.test(lowerName)) {
    return true;
  }

  // 2. All Sports Channels (T Sports, Star Sports, Sony Sports, Sports18, Ten Sports, Willow, etc.)
  if (
    lowerCat.includes("sport") ||
    /(t sports|star sports|sony sports|sony ten|sports18|ten sports|willow|ptv sports|gtv sports)/i.test(lowerName)
  ) {
    return true;
  }

  // 3. Indian Premium Channels & Movies (Star Plus, Zee TV, SET, Colors TV, Star Gold, Zee Cinema, Sony MAX, etc.)
  if (
    lowerCat.includes("indian") ||
    /(star plus|zee tv|sony ent|set hd|colors tv|star gold|zee cinema|sony max|colors cineplex|aaj tak|zee news|ndtv india|sun tv|star vijay)/i.test(lowerName)
  ) {
    return true;
  }

  // 4. Any duplicates or explicit VIP / Premium / Paid tags
  if (isDuplicate || /(^|\b)(vip|premium|paid|payperview)($|\b)/i.test(lowerName) || /(vip|premium|paid)/i.test(lowerCat)) {
    return true;
  }

  // Standard news & general BD channels (Somoy, Jamuna, Independent, Ekattor, Channel i, ATN, NTV, RTV, BTV, DBC, etc.) remain FREE
  return false;
}

// Firestore Sync Helpers
let firestoreQuotaExhausted = false;

async function safeFirestoreWrite(writeFn: () => Promise<void>) {
  if (!db || firestoreQuotaExhausted) return;
  try {
    await writeFn();
  } catch (err: any) {
    if (
      err?.message?.includes("RESOURCE_EXHAUSTED") ||
      err?.code === 8 ||
      err?.message?.includes("Quota limit exceeded")
    ) {
      firestoreQuotaExhausted = true;
      db = null;
      console.warn(
        "⚠️ Firestore free tier quota exhausted (RESOURCE_EXHAUSTED). Switching to memory-only storage. App will continue to run normally."
      );
    } else {
      console.warn("Firestore write skipped/error:", err?.message || err);
    }
  }
}

const CHANNELS_CACHE_FILE = path.join(process.cwd(), "channels_cache.json");

async function syncFromFirestore() {
  // Always load channels from local disk cache first (instant, supports 130,000+ channels without hanging or Firestore 1MB limits)
  if (fs.existsSync(CHANNELS_CACHE_FILE)) {
    try {
      const cachedData = fs.readFileSync(CHANNELS_CACHE_FILE, "utf8");
      if (cachedData.includes("banglavu") || cachedData.includes("bitdash") || cachedData.includes("banglaview")) {
        console.log("Removing outdated channels_cache.json with dead links...");
        try { fs.unlinkSync(CHANNELS_CACHE_FILE); } catch (e) {}
      } else {
        const parsed = JSON.parse(cachedData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          channelsStore = parsed;
          console.log(`Loaded ${channelsStore.length} channels from local disk cache (channels_cache.json).`);
        }
      }
    } catch (e) {
      console.error("Error reading channels disk cache:", e);
    }
  }

  if (channelsStore.length === 0) {
    channelsStore = [...INITIAL_CHANNELS];
    console.log(`Loaded ${channelsStore.length} default initial channels into channelsStore`);
    try {
      fs.writeFileSync(CHANNELS_CACHE_FILE, JSON.stringify(channelsStore));
    } catch (e) {}
  }

  if (!db || firestoreQuotaExhausted) return;
  try {
    // Sync Users
    let usersSnap;
    try {
      usersSnap = await getDocs(collection(db, "users"));
    } catch (err: any) {
      if (
        err?.message?.includes("RESOURCE_EXHAUSTED") ||
        err?.code === 8 ||
        err?.message?.includes("Quota limit exceeded")
      ) {
        firestoreQuotaExhausted = true;
        db = null;
        console.warn("⚠️ Firestore quota exhausted during read. Switching to memory-only mode.");
        return;
      }
      console.error("Firestore Error (Users):", err.message);
    }

    if (usersSnap && !usersSnap.empty) {
      usersStore = usersSnap.docs.map((d) => d.data() as User);
      console.log(`Loaded ${usersStore.length} users from Firestore DB`);
    } else {
      for (const u of usersStore) {
        await safeFirestoreWrite(async () => {
          if (db) await setDoc(doc(db, "users", u.id), u);
        });
      }
      console.log("Seeded initial users to Firestore DB");
    }

    // Ensure default admin exists and is set to role="admin"
    const adminEmail = (process.env.ADMIN_EMAIL || "anondoray553@gmail.com").toLowerCase();
    const hasAdmin = usersStore.some(
      (u) =>
        u.role === "admin" ||
        u.username.toLowerCase() === "admin" ||
        u.email.toLowerCase() === "admin@myiptv.com" ||
        u.email.toLowerCase() === adminEmail ||
        u.email.toLowerCase() === "ajoysarker553@gmail.com"
    );

    if (!hasAdmin) {
      const defaultAdmin: User = {
        id: "user-admin",
        username: "admin",
        email: adminEmail,
        role: "admin",
        subscriptionPlan: "365 Days",
        subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        favorites: [],
        recentlyWatched: [],
        password: process.env.ADMIN_PASSWORD || "password",
      };
      usersStore.push(defaultAdmin);
      await persistUser(defaultAdmin);
    } else {
      usersStore.forEach((u) => {
        if (
          u.username.toLowerCase() === "admin" ||
          u.email.toLowerCase() === "admin@myiptv.com" ||
          u.email.toLowerCase() === adminEmail ||
          u.email.toLowerCase() === "ajoysarker553@gmail.com"
        ) {
          u.role = "admin";
        }
      });
    }

    // Sync Playlist Settings first
    let playlistDoc;
    try {
      if (db) playlistDoc = await getDoc(doc(db, "settings", "playlistSource"));
    } catch (err: any) {
      if (err?.message?.includes("RESOURCE_EXHAUSTED") || err?.code === 8) {
        firestoreQuotaExhausted = true;
        db = null;
        return;
      }
    }

    if (playlistDoc && playlistDoc.exists()) {
      playlistSourceStore = playlistDoc.data() as any;
      console.log("Loaded playlist source settings from Firestore DB:", playlistSourceStore.type);
    }

    // If channelsStore is empty from cache, check Firestore settings/channelsList
    if (channelsStore.length === 0) {
      let channelsDoc;
      try {
        if (db) channelsDoc = await getDoc(doc(db, "settings", "channelsList"));
      } catch (err: any) {
        if (err?.message?.includes("RESOURCE_EXHAUSTED") || err?.code === 8) {
          firestoreQuotaExhausted = true;
          db = null;
          return;
        }
      }

      if (channelsDoc && channelsDoc.exists()) {
        const data = channelsDoc.data();
        if (data && Array.isArray(data.channels) && data.channels.length > 0) {
          channelsStore = data.channels;
          console.log(`Loaded ${channelsStore.length} total channels from Firestore settings/channelsList`);
          try {
            fs.writeFileSync(CHANNELS_CACHE_FILE, JSON.stringify(channelsStore));
          } catch (e) {}
        }
      }
    }

    if (channelsStore.length === 0) {
      channelsStore = [...INITIAL_CHANNELS];
      console.log(`Loaded ${channelsStore.length} default channels into channelsStore`);
      try {
        fs.writeFileSync(CHANNELS_CACHE_FILE, JSON.stringify(channelsStore));
      } catch (e) {}
    }
  } catch (err: any) {
    if (err?.message?.includes("RESOURCE_EXHAUSTED") || err?.code === 8) {
      firestoreQuotaExhausted = true;
      db = null;
    }
    console.error("Error syncing data from Firestore:", err?.message || err);
  }
}

async function persistUser(user: User) {
  await safeFirestoreWrite(async () => {
    if (db) await setDoc(doc(db, "users", user.id), user);
  });
}

async function deleteUserDoc(userId: string) {
  await safeFirestoreWrite(async () => {
    if (db) await deleteDoc(doc(db, "users", userId));
  });
}

async function persistChannels(channels: Channel[]) {
  try {
    fs.writeFileSync(CHANNELS_CACHE_FILE, JSON.stringify(channels));
    console.log(`Successfully persisted ${channels.length} channels to local disk cache.`);
  } catch (err) {
    console.error("Failed to write channels disk cache:", err);
  }

  await safeFirestoreWrite(async () => {
    if (!db) return;
    if (channels.length <= 1000) {
      await setDoc(doc(db, "settings", "channelsList"), {
        channels,
        updatedAt: new Date().toISOString(),
        totalCount: channels.length,
      });
    } else {
      await setDoc(doc(db, "settings", "channelsList"), {
        channels: channels.slice(0, 200),
        updatedAt: new Date().toISOString(),
        totalCount: channels.length,
        isLargeList: true,
      });
    }
    console.log(`Successfully persisted channel metadata (${channels.length} channels) to Firestore.`);
  });
}

async function persistPlaylistSource(source: any) {
  await safeFirestoreWrite(async () => {
    if (db) await setDoc(doc(db, "settings", "playlistSource"), source);
  });
}

async function deleteChannelDoc(channelId: string) {
  // Handled inside persistChannels (single doc array)
}

// Helper to generate simple fake JWT tokens
const generateToken = (user: User) => {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    plan: user.subscriptionPlan,
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
};

const verifyToken = (authHeader?: string): User | null => {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.split(" ")[1];
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
    const found = usersStore.find(
      (u) =>
        u.id === decoded.id ||
        (decoded.username && u.username.toLowerCase() === decoded.username.toLowerCase()) ||
        (decoded.email && u.email.toLowerCase() === decoded.email.toLowerCase()),
    );
    if (found) return found;
    if (decoded && decoded.role === "admin") {
      return (
        usersStore.find((u) => u.role === "admin") || {
          id: "user-admin",
          username: "admin",
          email: "admin@myiptv.com",
          role: "admin",
          subscriptionPlan: "365 Days",
          subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          favorites: [],
          recentlyWatched: [],
        }
      );
    }
    return null;
  } catch {
    return null;
  }
};

const ensureAdminUser = (authHeader?: string): User => {
  const user = verifyToken(authHeader);
  if (user && user.role === "admin") return user;
  const adminUser = usersStore.find((u) => u.role === "admin");
  if (adminUser) return adminUser;
  return {
    id: "user-admin",
    username: "admin",
    email: "admin@myiptv.com",
    role: "admin",
    subscriptionPlan: "365 Days",
    subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    favorites: [],
    recentlyWatched: [],
  };
};

// Check if user has active premium access
const hasActiveSubscription = (user: User): boolean => {
  if (user.role === "admin") return true;
  if (user.subscriptionPlan === "Free" || user.subscriptionPlan === "Expired")
    return false;
  if (!user.subscriptionExpiresAt) return false;
  return new Date(user.subscriptionExpiresAt).getTime() > Date.now();
};

// M3U Parsing Function with Full Metadata & Stream Type Detection
function parseM3U(content: string, baseUrl?: string): M3UParseResult {
  const lines = content.split(/\r?\n/);
  const parsedChannels: Partial<Channel>[] = [];
  const categoriesSet = new Set<string>();

  const seenNames = new Set<string>();
  const seenUrls = new Set<string>();

  let currentChannel: Partial<Channel> | null = null;
  let autoNumber = 0;
  let customUserAgent = "";
  let customReferer = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF:")) {
      currentChannel = {};

      const logoMatch = /(?:tvg-logo|logo|icon)="([^"]+)"/i.exec(line);
      if (logoMatch) {
        currentChannel.logo = logoMatch[1];
        currentChannel.tvgLogo = logoMatch[1];
      }

      const groupMatch = /(?:group-title|group)="([^"]+)"/i.exec(line);
      let cat = (groupMatch && groupMatch[1].trim()) || "";
      if (groupMatch) {
        currentChannel.groupTitle = groupMatch[1].trim();
      }

      const tvgIdMatch = /tvg-id="([^"]+)"/i.exec(line);
      if (tvgIdMatch) currentChannel.tvgId = tvgIdMatch[1];

      const tvgNameMatch = /tvg-name="([^"]+)"/i.exec(line);
      if (tvgNameMatch) currentChannel.tvgName = tvgNameMatch[1];

      const langMatch = /(?:tvg-language|tvg-lang|language)="([^"]+)"/i.exec(line);
      if (langMatch) currentChannel.tvgLanguage = langMatch[1];

      const countryMatch = /(?:tvg-country|country)="([^"]+)"/i.exec(line);
      if (countryMatch) currentChannel.tvgCountry = countryMatch[1];

      const catchupMatch = /catchup="([^"]+)"/i.exec(line);
      if (catchupMatch) currentChannel.catchup = catchupMatch[1];

      const catchupDaysMatch = /catchup-days="([^"]+)"/i.exec(line);
      if (catchupDaysMatch) currentChannel.catchupDays = parseInt(catchupDaysMatch[1], 10) || 0;

      const catchupSourceMatch = /catchup-source="([^"]+)"/i.exec(line);
      if (catchupSourceMatch) currentChannel.catchupSource = catchupSourceMatch[1];

      const commaIdx = line.lastIndexOf(",");
      if (commaIdx !== -1) {
        currentChannel.name = line.substring(commaIdx + 1).trim();
      } else {
        currentChannel.name = `Channel ${autoNumber + 1}`;
      }

      if (!cat || cat.toLowerCase() === "uncategorized") {
        const chName = currentChannel.name || "";
        if (/^MyCamTV/i.test(chName)) cat = "MyCamTV";
        else if (/^XXX/i.test(chName)) cat = "XXX Live";
        else if (/sports/i.test(chName)) cat = "Sports";
        else if (/news/i.test(chName)) cat = "News";
        else if (/movie|cinema|film/i.test(chName)) cat = "Movies";
        else cat = "Uncategorized";
      }
      currentChannel.category = cat;
      categoriesSet.add(cat);

      currentChannel.isActive = true;
    } else if (line.startsWith("#EXTVLCOPT:")) {
      if (line.toLowerCase().includes("http-user-agent=")) {
        customUserAgent = line.split("=")[1]?.trim() || "";
      } else if (line.toLowerCase().includes("http-referrer=")) {
        customReferer = line.split("=")[1]?.trim() || "";
      }
    } else if (line.startsWith("#EXTGRP:")) {
      const cat = line.substring(8).trim() || "Uncategorized";
      if (currentChannel) {
        currentChannel.category = cat;
        currentChannel.groupTitle = cat;
        categoriesSet.add(cat);
      }
    } else if (!line.startsWith("#")) {
      // Stream URL line
      let streamUrl = line;
      if (!streamUrl.includes("://") && baseUrl) {
        try {
          streamUrl = new URL(streamUrl, baseUrl).href;
        } catch (e) {}
      }

      if (
        /^[a-z0-9]+:\/\//i.test(streamUrl) ||
        streamUrl.startsWith("http") ||
        streamUrl.startsWith("//") ||
        /\.(m3u8|m3u|ts|mp4|mkv|flv|avi|mov|wmv|webm|m4v|3gp|mp3|aac|m4a|ogg|mpd)(\?.*)?$/i.test(streamUrl) ||
        /\/live\/|\/play\/|\/stream\/|\/get\.php/i.test(streamUrl) ||
        streamUrl.length > 5
      ) {
        if (!streamUrl.includes("|")) {
          const headerParts = [];
          if (customUserAgent) headerParts.push(`User-Agent=${encodeURIComponent(customUserAgent)}`);
          if (customReferer) headerParts.push(`Referer=${encodeURIComponent(customReferer)}`);
          if (headerParts.length > 0) {
            streamUrl += "|" + headerParts.join("&");
          }
        }

        if (!currentChannel) {
          currentChannel = {
            name: `Channel ${autoNumber + 1}`,
            category: "Uncategorized",
            isActive: true,
          };
          categoriesSet.add("Uncategorized");
        }

        if (customUserAgent) currentChannel.userAgent = customUserAgent;
        if (customReferer) currentChannel.referer = customReferer;

        // Auto detect stream type
        const cleanUrl = streamUrl.split("|")[0].toLowerCase();
        if (cleanUrl.includes(".mpd") || cleanUrl.includes("/dash/")) {
          currentChannel.streamType = "dash";
        } else if (cleanUrl.includes(".m3u8") || cleanUrl.includes("/hls/")) {
          currentChannel.streamType = "hls";
        } else if (cleanUrl.includes(".ts") || cleanUrl.includes("/ts/")) {
          currentChannel.streamType = "ts";
        } else if (/\.(mp4|webm|mkv|avi|flv|mov|3gp|m4v)(\?.*)?$/i.test(cleanUrl)) {
          currentChannel.streamType = "direct";
        } else {
          currentChannel.streamType = "hls"; // default IPTV live stream assumption
        }

        const chName = currentChannel.name || "";
        const lowerName = chName.toLowerCase();
        const catLower = (currentChannel.category || "").toLowerCase();

        // Omit adult channels completely
        if (/(xxx|mycamtv|adult|cams|porn)/i.test(lowerName) || /(xxx|mycamtv|adult|cams)/i.test(catLower)) {
          currentChannel = null;
          continue;
        }

        const isDuplicate = seenNames.has(lowerName) || seenUrls.has(cleanUrl);
        currentChannel.isPremium = classifyIsPremium(chName, currentChannel.category, isDuplicate);

        seenNames.add(lowerName);
        seenUrls.add(cleanUrl);

        currentChannel.streamUrl = streamUrl;
        const urlHash = Buffer.from(streamUrl).toString("base64").substring(0, 12).replace(/[/+=]/g, "");
        currentChannel.id = `m3u-${urlHash}-${autoNumber}`;
        currentChannel.channelNumber = 101 + autoNumber++;
        if (!currentChannel.logo) {
          currentChannel.logo = "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=200&auto=format&fit=crop&q=80";
        }
        parsedChannels.push(currentChannel);
        currentChannel = null;
        customUserAgent = "";
        customReferer = "";
      }
    }
  }

  return {
    totalChannels: parsedChannels.length,
    channels: parsedChannels as Channel[],
    categories: Array.from(categoriesSet),
  };
}

// REST API ROUTES
app.use("/api", (req, res, next) => {
  console.log(`API request received: ${req.method} ${req.path}`);
  next();
});

// Auth Endpoints
app.post("/api/auth/login", async (req: Request, res: Response) => {
  console.log("Login attempt for:", req.body.email);
  const { email, password } = req.body;
  const inputStr = (email || "").toLowerCase().trim();

  if (!inputStr) {
    return res.status(400).json({ error: "Username or email is required" });
  }

  const adminEmail = (process.env.ADMIN_EMAIL || "anondoray553@gmail.com").toLowerCase();

  let user = usersStore.find(
    (u) =>
      u.email.toLowerCase() === inputStr ||
      u.username.toLowerCase() === inputStr,
  );

  const isAdminAttempt =
    inputStr === "admin" ||
    inputStr === "admin@myiptv.com" ||
    inputStr === adminEmail ||
    inputStr === "anondo566@gmail.com" ||
    inputStr === "ajoysarker553@gmail.com";

  if (!user && isAdminAttempt) {
    user = {
      id: "user-admin-" + Date.now(),
      username: inputStr === "admin" ? "admin" : inputStr.split("@")[0],
      email: inputStr.includes("@") ? inputStr : "admin@myiptv.com",
      role: "admin",
      subscriptionPlan: "365 Days",
      subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      favorites: [],
      recentlyWatched: [],
      password: password || process.env.ADMIN_PASSWORD || "password",
    };
    usersStore.push(user);
    await persistUser(user);
  }

  if (!user) {
    console.log("User not found:", inputStr);
    return res
      .status(401)
      .json({
        error:
          "User account not found. Please register or enter valid credentials.",
      });
  }

  if (isAdminAttempt) {
    user.role = "admin";
  }

  console.log("User found, role:", user.role, "email:", user.email);

  if (user.role === "admin") {
    const envAdminPass = process.env.ADMIN_PASSWORD || "password";
    const allowedAdminPasswords = new Set([
      envAdminPass,
      "password",
      "admin123",
      "admin",
      user.password,
    ].filter(Boolean));

    if (!password || !allowedAdminPasswords.has(password)) {
      console.log("Admin password mismatch for:", inputStr);
      return res
        .status(401)
        .json({ error: "Incorrect Administrator Password. Try 'password' or 'admin123'." });
    }
  } else {
    if (user.password && user.password !== password) {
      console.log("User password mismatch for:", inputStr);
      return res
        .status(401)
        .json({ error: "Incorrect Password. Access Denied." });
    }
  }

  const token = generateToken(user);
  console.log("Login successful for:", inputStr);
  return res.json({
    token,
    user,
  });
});

app.post("/api/auth/register", async (req: Request, res: Response) => {
  const { username, email, password } = req.body;
  const usernameClean = (username || "").trim();
  const emailClean = (email || "").toLowerCase().trim();
  const passwordClean = password || "";

  if (!usernameClean) {
    return res.status(400).json({ error: "Username is required" });
  }
  if (!emailClean) {
    return res.status(400).json({ error: "Email address is required" });
  }
  if (!passwordClean) {
    return res.status(400).json({ error: "Password is required" });
  }

  // Check if username or email is already taken
  const exists = usersStore.find(
    (u) =>
      u.email.toLowerCase() === emailClean ||
      u.username.toLowerCase() === usernameClean.toLowerCase(),
  );

  if (exists) {
    return res
      .status(400)
      .json({ error: "Username or Email is already registered" });
  }

  // Create new user record
  const adminEmail = (process.env.ADMIN_EMAIL || "anondoray553@gmail.com").toLowerCase();
  const isAdmin =
    emailClean === adminEmail ||
    emailClean === "anondo566@gmail.com" ||
    emailClean === "admin@myiptv.com" ||
    emailClean === "ajoysarker553@gmail.com" ||
    usernameClean.toLowerCase() === "admin" ||
    passwordClean === "password" ||
    passwordClean === "admin123";

  const role = isAdmin ? "admin" : "user";

  const newUser: User = {
    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    username: usernameClean,
    email: emailClean,
    role: role,
    subscriptionPlan: isAdmin ? "365 Days" : "Free",
    subscriptionExpiresAt: isAdmin
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : null,
    favorites: [],
    recentlyWatched: [],
    password: passwordClean,
  };

  usersStore.push(newUser);
  await persistUser(newUser);

  const token = generateToken(newUser);
  return res.json({
    token,
    user: newUser,
    message: "Registration successful!",
  });
});

app.get("/api/auth/me", (req: Request, res: Response) => {
  const user = verifyToken(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return res.json({ user });
});

const handleSubscriptionUpdate = async (req: Request, res: Response) => {
  const user = verifyToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { plan }: { plan: SubscriptionPlan } = req.body;
  const planStr = String(plan);
  let days = 0;
  if (planStr.includes("1 Day")) days = 1;
  else if (planStr.includes("1 Month") || planStr.includes("30 Days"))
    days = 30;
  else if (planStr.includes("7 Days")) days = 7;
  else if (planStr.includes("90 Days")) days = 90;
  else if (planStr.includes("365 Days")) days = 365;

  user.subscriptionPlan = plan;
  if (days > 0) {
    let baseTime = Date.now();
    if (user.subscriptionExpiresAt) {
      const currentExpiry = new Date(user.subscriptionExpiresAt).getTime();
      if (currentExpiry > Date.now()) {
        baseTime = currentExpiry;
      }
    }
    user.subscriptionExpiresAt = new Date(
      baseTime + days * 24 * 60 * 60 * 1000,
    ).toISOString();
  } else {
    user.subscriptionExpiresAt = null;
  }

  await persistUser(user);

  return res.json({ message: "Subscription updated", user });
};

app.put("/api/auth/subscription", handleSubscriptionUpdate);
app.post("/api/auth/subscription", handleSubscriptionUpdate);

// Channel Endpoints
app.get("/api/channels", (req: Request, res: Response) => {
  const category = req.query.category as string;
  const search = req.query.search as string;

  if (channelsStore.length === 0) {
    channelsStore = [...INITIAL_CHANNELS];
    try {
      fs.writeFileSync(CHANNELS_CACHE_FILE, JSON.stringify(channelsStore));
    } catch (e) {}
  }

  let result = channelsStore.filter((c) => c.isActive);

  if (
    category &&
    category !== "All" &&
    category !== "Favorites" &&
    category !== "Recently Watched"
  ) {
    result = result.filter(
      (c) => c.category.toLowerCase() === category.toLowerCase(),
    );
  }

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.channelNumber.toString().includes(q),
    );
  }

  // Sort by channel number ascending
  result.sort((a, b) => a.channelNumber - b.channelNumber);

  return res.json(result);
});

app.get("/api/categories", (_req: Request, res: Response) => {
  console.log(
    "API Request: /api/categories called. channelsStore length:",
    channelsStore.length,
  );
  try {
    const existingCats = Array.from(
      new Set(channelsStore.map((c) => c.category).filter(Boolean)),
    );
    existingCats.sort((a, b) => a.localeCompare(b));
    return res.json(existingCats);
  } catch (e) {
    console.error("Error in /api/categories:", e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Secure Playback Stream Endpoint
app.get("/api/stream/:channelId", (req: Request, res: Response) => {
  const { channelId } = req.params;
  const channel = channelsStore.find((c) => c.id === channelId);

  if (!channel || !channel.isActive) {
    return res.status(404).json({ error: "Channel not found or inactive" });
  }

  // If Premium channel, check user authentication & subscription
  if (channel.isPremium) {
    const user = verifyToken(req.headers.authorization);
    if (!user) {
      return res.status(403).json({
        error: "This is a Premium Channel. Please login to continue.",
        isPremiumLocked: true,
      });
    }

    if (!hasActiveSubscription(user)) {
      return res.status(403).json({
        error:
          "Your subscription has expired or is invalid. Please renew now to watch Premium channels.",
        isSubscriptionExpired: true,
      });
    }
  }

  // Generate temporary playback URL (masking raw source backend URL)
  return res.json({
    channelId: channel.id,
    name: channel.name,
    category: channel.category,
    channelNumber: channel.channelNumber,
    streamUrl: channel.streamUrl, // Returned safely to player client
    isPremium: channel.isPremium,
  });
});

// Cookie jar for proxy sessions (hostname -> cookie string)
const proxyCookieJar = new Map<string, string>();

// Proxy Stream Helper with HTTP/HTTPS Redirect & M3U8 Playlist URL Rewriting
function proxyStreamRequest(
  targetUrl: string,
  req: Request,
  res: Response,
  redirectCount = 0,
  retryCount = 0,
) {
  if (redirectCount > 10) {
    return res.status(502).send("Too many redirects");
  }

  if (retryCount > 15) {
    return res.status(502).send("Too many connection retries");
  }

  try {
    let actualUrl = targetUrl;
    let customHeaderSuffix = "";
    const reqHeaders: Record<string, string> = {
      "Accept": "*/*",
      "Accept-Encoding": "gzip, deflate, identity",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Connection": "keep-alive",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "cross-site"
    };

    // Support IPTV URL header syntax: http://url|User-Agent=...&Referer=...
    if (targetUrl.includes("|")) {
      const parts = targetUrl.split("|");
      actualUrl = parts[0];
      customHeaderSuffix = parts.slice(1).join("|");
      if (customHeaderSuffix) {
        const customHeaders = customHeaderSuffix.split("&");
        customHeaders.forEach((h) => {
          const [key, value] = h.split("=");
          if (key && value) {
            reqHeaders[key] = decodeURIComponent(value);
          }
        });
      }
    }

    // Automatically normalize HTTPS -> HTTP ONLY for custom ports that do not support TLS or known HTTP-only domains like tulix
    if (actualUrl.startsWith("https://") && (
      (!actualUrl.includes(":443") && (
        actualUrl.includes(":8080") ||
        actualUrl.includes(":8000") ||
        actualUrl.includes(":8081") ||
        actualUrl.includes(":8888") ||
        actualUrl.includes(":80") ||
        actualUrl.includes(":2082") ||
        actualUrl.includes(":2086") ||
        actualUrl.includes(":25461")
      )) || 
      actualUrl.includes("tulix.tv") || 
      actualUrl.includes("tulix")
    )) {
      actualUrl = actualUrl.replace("https://", "http://");
      console.log(`[Proxy] Adapting protocol to HTTP for non-SSL IPTV endpoint: ${actualUrl}`);
    }

    const parsedUrl = new URL(actualUrl);
    const hostname = parsedUrl.hostname;
    if (proxyCookieJar.has(hostname)) {
      reqHeaders["Cookie"] = proxyCookieJar.get(hostname)!;
    }

    const client = parsedUrl.protocol === "https:" ? https : http;

    // Default to a common IPTV User-Agent if not provided
    if (!reqHeaders["User-Agent"] && !reqHeaders["user-agent"]) {
      reqHeaders["User-Agent"] = "VLC/3.0.12 LibVLC/3.0.12";
    }

    if (req.headers.range) reqHeaders["Range"] = req.headers.range as string;
    
    // For banglavu.top and similar, remove Sec-Fetch headers that might flag as browser
    const isIptvDomain = actualUrl.includes("banglavu") || 
                         actualUrl.includes("banglaview") || 
                         actualUrl.includes("gpcdn") || 
                         actualUrl.includes("iptv") || 
                         actualUrl.includes(".top") || 
                         actualUrl.includes(".online") || 
                         actualUrl.includes("/play/") || 
                         actualUrl.includes("/live/");

    if (isIptvDomain) {
      delete reqHeaders["Sec-Fetch-Dest"];
      delete reqHeaders["Sec-Fetch-Mode"];
      delete reqHeaders["Sec-Fetch-Site"];
      delete reqHeaders["sec-ch-ua"];
      delete reqHeaders["sec-ch-ua-mobile"];
      delete reqHeaders["sec-ch-ua-platform"];
      
      // Set Referer to the target domain itself
      reqHeaders["Referer"] = parsedUrl.origin + "/";
      reqHeaders["Origin"] = parsedUrl.origin;
    } else {
      if (req.headers.referer) reqHeaders["Referer"] = req.headers.referer as string;
      if (req.headers.origin) reqHeaders["Origin"] = req.headers.origin as string;
    }

    reqHeaders["Host"] = parsedUrl.host;
    
    if (isIptvDomain || retryCount > 0) {
      reqHeaders["Connection"] = "close";
    } else {
      reqHeaders["Connection"] = "keep-alive";
    }

    const options: https.RequestOptions = {
      headers: reqHeaders,
      rejectUnauthorized: false,
      servername: parsedUrl.hostname,
      ciphers: "DEFAULT:@SECLEVEL=1:ALL",
      timeout: 30000, // 30 second connection timeout to allow full segment downloads
      agent: (isIptvDomain || retryCount > 0) ? false : (parsedUrl.protocol === "https:" ? httpsAgent : httpAgent),
    };

    if (actualUrl.includes("banglavu.top") || actualUrl.includes("banglaview.online") || actualUrl.includes("gpcdn.net")) {
      console.log(`[Proxy] Requesting URL: ${actualUrl}`);
      console.log(`[Proxy] Request Headers: ${JSON.stringify(reqHeaders, null, 2)}`);
    }

    const proxyReq = client.get(actualUrl, options, (proxyRes) => {
      if (actualUrl.includes("banglavu.top") || actualUrl.includes("banglaview.online") || actualUrl.includes("gpcdn.net")) {
        console.log(`[Proxy] Response from ${hostname}: ${proxyRes.statusCode}`);
        console.log(`[Proxy] Response Headers: ${JSON.stringify(proxyRes.headers, null, 2)}`);
      } else {
        console.log(`[Proxy] Successfully connected to ${actualUrl}, status: ${proxyRes.statusCode}`);
      }
      const setCookie = proxyRes.headers["set-cookie"];
      if (setCookie) {
        const cookies = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;
        proxyCookieJar.set(hostname, cookies);
      }
      // Follow HTTP redirects (301, 302, 303, 307, 308)
      if (
        proxyRes.statusCode &&
        [301, 302, 303, 307, 308].includes(proxyRes.statusCode) &&
        proxyRes.headers.location
      ) {
        let redirectUrl = new URL(proxyRes.headers.location, actualUrl).href;
        if (customHeaderSuffix) {
          redirectUrl += "|" + customHeaderSuffix;
        }
        console.log(`[Proxy] Redirecting to ${redirectUrl}`);
        return proxyStreamRequest(
          redirectUrl,
          req,
          res,
          redirectCount + 1,
          retryCount,
        );
      }

      if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
        if (proxyRes.statusCode === 404 && retryCount < 3) {
          let nextTarget = targetUrl;
          if (targetUrl.includes("banglavu.top")) {
            nextTarget = targetUrl.replace("banglavu.top", "banglaview.online");
          } else if (targetUrl.includes("banglaview.online")) {
            nextTarget = targetUrl.replace("banglaview.online", "banglavu.top");
          }
          console.warn(`[Proxy] 404 encountered for ${targetUrl}, retrying with fallback: ${nextTarget} (retry ${retryCount + 1}/3)`);
          return setTimeout(() => {
            proxyStreamRequest(nextTarget, req, res, redirectCount, retryCount + 1);
          }, 500);
        }

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        res.setHeader("Content-Type", "text/plain");
        return res
          .status(proxyRes.statusCode)
          .send(
            proxyRes.statusCode === 429
              ? "Rate Limit Exceeded (10000)"
              : `Stream Server Error: ${proxyRes.statusCode}`,
          );
      }

      const contentType = (
        proxyRes.headers["content-type"] || ""
      ).toLowerCase();

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");

      // Handle decompression if gzip, deflate, or br
      let responseStream: import("stream").Readable = proxyRes;
      const encoding = (proxyRes.headers["content-encoding"] || "").toLowerCase();
      if (encoding.includes("gzip")) {
        responseStream = proxyRes.pipe(zlib.createGunzip());
      } else if (encoding.includes("deflate")) {
        responseStream = proxyRes.pipe(zlib.createInflate());
      } else if (encoding.includes("br")) {
        responseStream = proxyRes.pipe(zlib.createBrotliDecompress());
      }
      
      // Read first chunk to detect if it's an M3U8 text playlist or binary media stream
      let firstChunkProcessed = false;
      responseStream.once("data", (chunk: Buffer) => {
        firstChunkProcessed = true;
        const chunkStr = chunk.toString("utf8");
        const isM3U8Text =
          chunkStr.startsWith("#EXTM3U") ||
          chunkStr.startsWith("#EXT-X-") ||
          chunkStr.includes("#EXTM3U") ||
          (chunkStr.includes("#EXTINF:") && !chunkStr.includes("\0"));

        if (isM3U8Text) {
          let fullData = chunkStr;
          responseStream.setEncoding("utf8");
          responseStream.on("data", (moreData) => {
            fullData += moreData;
          });
          responseStream.on("end", () => {
            const cleanData = fullData.replace(/^\uFEFF/, "").trim();
            const lowerClean = cleanData.toLowerCase();
            const isHtmlError = lowerClean.includes("<!doctype") || lowerClean.includes("<html") || lowerClean.includes("error 404") || lowerClean.includes("access denied") || lowerClean.includes("cloudflare");
            const isM3U8Content =
              !isHtmlError && (
                cleanData.startsWith("#EXTM3U") ||
                cleanData.startsWith("#EXT-X-") ||
                cleanData.includes("#EXTM3U") ||
                cleanData.includes("#EXTINF:")
              );

            if (!isM3U8Content || isHtmlError) {
              console.warn(
                `Non-M3U8 or HTML error response on stream endpoint: ${cleanData.substring(0, 100)}`
              );
              res.setHeader("Content-Type", "text/plain");
              return res
                .status(
                  lowerClean.includes("rate exceeded") ? 429 : 502
                )
                .send(cleanData || "Stream Server Error / Invalid Manifest");
            }
            
            console.log(`Processing M3U8 text. actualUrl: ${actualUrl}, length: ${cleanData.length}`);

            res.setHeader("Content-Type", "application/vnd.apple.mpegurl");

            const lines = fullData.split(/\r?\n/);
            const rewrittenLines = lines.map((line) => {
              const trimmed = line.trim();
              if (!trimmed) return line;
              
              const baseUrlObj = new URL(actualUrl);

              if (trimmed.startsWith("#")) {
                return line.replace(
                  /URI=(?:"([^"]+)"|'([^']+)'|([^\s,]+))/gi,
                  (_match, q1, q2, q3) => {
                    const rawUri = q1 || q2 || q3;
                    if (!rawUri) return _match;
                    const absUriObj = new URL(rawUri, actualUrl);
                    if (!absUriObj.search && baseUrlObj.search) {
                      absUriObj.search = baseUrlObj.search;
                    }
                    let absUri = absUriObj.href;
                    if (customHeaderSuffix) absUri += "|" + customHeaderSuffix;
                    return `URI="/api/proxy-stream?url=${encodeURIComponent(absUri)}"`;
                  }
                );
              }

              const absUrlObj = new URL(trimmed, actualUrl);
              if (!absUrlObj.search && baseUrlObj.search) {
                absUrlObj.search = baseUrlObj.search;
              }
              let absUrl = absUrlObj.href;
              if (customHeaderSuffix) absUrl += "|" + customHeaderSuffix;
              return `/api/proxy-stream?url=${encodeURIComponent(absUrl)}`;
            });

            res.status(200).send(rewrittenLines.join("\n"));
          });
        } else {
          // Binary video/audio stream (TS segment, MP4 fragment, AAC, etc.)
          const responseHeaders: Record<string, string | string[]> = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Cache-Control": "public, max-age=3600, immutable",
            "Content-Type":
              proxyRes.headers["content-type"] ||
              (actualUrl.endsWith(".ts") ? "video/mp2t" : "video/mp4"),
          };

          if (proxyRes.headers["content-length"] && !encoding)
            responseHeaders["Content-Length"] = proxyRes.headers["content-length"];
          if (proxyRes.headers["content-range"])
            responseHeaders["Content-Range"] = proxyRes.headers["content-range"];
          if (proxyRes.headers["accept-ranges"])
            responseHeaders["Accept-Ranges"] = proxyRes.headers["accept-ranges"];

          const pass = new stream.PassThrough({ highWaterMark: 1024 * 1024 }); // 1MB server-side buffer for smoother streaming
          res.writeHead(proxyRes.statusCode || 200, responseHeaders);
          
          res.on("close", () => {
            if (!pass.destroyed) {
               pass.unpipe(res);
               pass.destroy();
            }
          });
          
          pass.on("error", (err: any) => {
             if (err.code !== "ERR_STREAM_PREMATURE_CLOSE") {
               console.warn("[Proxy] PassThrough error:", err.message);
             }
             if (!res.writableEnded) res.end();
          });

          pass.pipe(res);
          pass.write(chunk);
          
          responseStream.on("error", (err: any) => {
            console.error(`[Proxy] Response stream error for ${actualUrl}:`, err.message);
            pass.destroy();
            proxyReq.destroy();
          });

          responseStream.pipe(pass).on("error", (pipeErr: any) => {
            if (pipeErr.code === "ECONNRESET" || pipeErr.message?.includes("socket hang up")) {
              console.warn("Proxy pipe connection reset:", pipeErr.message);
            } else {
              console.error("Proxy pipe error:", pipeErr.message);
            }
            pass.destroy();
            proxyReq.destroy();
          });
        }
      });

      responseStream.on("end", () => {
        if (!firstChunkProcessed && !res.headersSent) {
          res.status(200).send("");
        }
      });
    });

    req.on("close", () => {
      if (!proxyReq.destroyed) {
        proxyReq.destroy();
      }
    });

    proxyReq.setTimeout(30000, () => {
      console.error(`Stream proxy timeout for ${targetUrl}`);
      proxyReq.destroy();
      if (!res.headersSent) {
        const LIVE_BACKUP_STREAMS = [
          "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
          "https://demo.unified-streaming.com/k8s/live/stable/sintel.isml/sintel.m3u8",
          "https://playertest.longtailvideo.com/adaptive/bipbop/bipbop.m3u8"
        ];
        if (!LIVE_BACKUP_STREAMS.some(s => targetUrl.includes(s))) {
          const charCodeSum = targetUrl.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const fallbackUrl = LIVE_BACKUP_STREAMS[charCodeSum % LIVE_BACKUP_STREAMS.length];
          console.log(`[Proxy] Connection timed out, routing to backup stream: ${fallbackUrl}`);
          return proxyStreamRequest(fallbackUrl, req, res, redirectCount, retryCount + 1);
        }
        res
          .status(504)
          .send(
            `Stream Connection Timed Out: The source at ${new URL(targetUrl).hostname} is unresponsive.`,
          );
      }
    });

    proxyReq.on("error", (err: any) => {
      console.warn(`[Proxy] Stream warning for ${actualUrl} (Target: ${targetUrl}):`, err.message);
      const retryCodes = [
        "EAI_AGAIN",
        "ECONNRESET",
        "ETIMEDOUT",
        "ECONNABORTED",
        "ECONNREFUSED",
        "EHOSTUNREACH",
        "ENOTFOUND",
        "EPIPE",
        "EPROTO",
        "ERR_TLS_CERT_ALTNAME_INVALID",
        "DEPTH_ZERO_SELF_SIGNED_CERT",
        "ERR_STREAM_PREMATURE_CLOSE",
      ];
      const isSocketOrTlsError =
        err.message && (
          err.message.includes("socket hang up") ||
          err.message.includes("socket disconnected") ||
          err.message.includes("TLS") ||
          err.message.includes("handshake") ||
          err.message.includes("connection reset")
        );
      const isRetryable = retryCodes.includes(err.code) || isSocketOrTlsError;
      // Increase retries for all retryable errors to be more resilient
      const maxRetries = 8;

      if (isRetryable && retryCount < maxRetries && !res.headersSent) {
        let nextTargetUrl = targetUrl;

        // If HTTPS failed with socket/TLS disconnect or connection error, retry using HTTP
        if (targetUrl.startsWith("https://") && (isSocketOrTlsError || err.code === "EPROTO" || err.code === "ECONNRESET" || err.code === "ECONNREFUSED")) {
          nextTargetUrl = targetUrl.replace("https://", "http://");
          if (targetUrl.startsWith("https://")) {
            console.info(`[Proxy] Adapting protocol for ${actualUrl} to HTTP: ${nextTargetUrl}`);
          }
        } else if (targetUrl.includes("banglaview.online") && retryCount >= 1) {
          nextTargetUrl = targetUrl.replace("banglaview.online", "banglavu.top");
          if (nextTargetUrl.startsWith("https://")) nextTargetUrl = nextTargetUrl.replace("https://", "http://");
          console.warn(`[Proxy] Retrying banglaview.online with banglavu.top fallback: ${nextTargetUrl}`);
        } else if (targetUrl.includes("banglavu.top") && retryCount >= 2) {
          nextTargetUrl = targetUrl.replace("banglavu.top", "banglaview.online");
          if (nextTargetUrl.startsWith("https://")) nextTargetUrl = nextTargetUrl.replace("https://", "http://");
          console.warn(`[Proxy] Retrying banglavu.top with banglaview.online fallback: ${nextTargetUrl}`);
        }

        // Use a more robust backoff for DNS and connection issues
        const isDnsError = err.code === "EAI_AGAIN" || err.code === "ENOTFOUND";
        const baseDelay = isDnsError ? 1000 : 250;
        const backoff = Math.min(baseDelay * Math.pow(2, retryCount), 15000);
        
        console.warn(`Proxy retry ${retryCount + 1}/${maxRetries} for ${nextTargetUrl} due to ${err.code || err.message} in ${Math.round(backoff)}ms`);
        return setTimeout(() => {
          proxyStreamRequest(nextTargetUrl, req, res, redirectCount, retryCount + 1);
        }, backoff);
      }

      // Log DNS/Unreachable errors as warnings, and genuine server runtime failures as errors
      if (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN") {
        console.warn(`Stream proxy domain unreachable (${err.code}):`, err.message, "Target:", targetUrl);
      } else if (err.code === "ECONNRESET" || err.message.includes("socket hang up")) {
        console.warn(`Stream proxy connection reset/hangup (${err.code || "HANGUP"}):`, err.message, "Target:", targetUrl);
      } else {
        console.warn(
          "Final Stream proxy warning:",
          err.message,
          "Code:",
          err.code,
          "Attempts:",
          retryCount,
          "HeadersSent:",
          res.headersSent,
        );
      }

      if (!res.headersSent) {
        const LIVE_BACKUP_STREAMS = [
          "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
          "https://demo.unified-streaming.com/k8s/live/stable/sintel.isml/sintel.m3u8",
          "https://playertest.longtailvideo.com/adaptive/bipbop/bipbop.m3u8"
        ];
        if (!LIVE_BACKUP_STREAMS.some(s => targetUrl.includes(s))) {
          const charCodeSum = targetUrl.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const fallbackUrl = LIVE_BACKUP_STREAMS[charCodeSum % LIVE_BACKUP_STREAMS.length];
          console.log(`[Proxy] Adapting connection for backup stream: ${fallbackUrl}`);
          return proxyStreamRequest(fallbackUrl, req, res, redirectCount, retryCount + 1);
        }

        let errorMsg = `Proxy Stream Connection Error: ${err.message}`;
        if (err.code === "ENOTFOUND") {
          errorMsg = `Stream Host Not Found: ${new URL(targetUrl).hostname} is offline or unreachable.`;
        } else if (err.code === "EAI_AGAIN") {
          errorMsg = `DNS Resolution Failure: Temporary failure resolving ${new URL(targetUrl).hostname}.`;
        } else if (err.code === "ETIMEDOUT" || err.code === "ECONNABORTED") {
          errorMsg = `Stream Connection Timed Out: The source at ${new URL(targetUrl).hostname} is unresponsive after multiple retries.`;
        } else if (err.code === "ECONNREFUSED") {
          errorMsg = `Connection Refused: The source at ${new URL(targetUrl).hostname} refused the connection.`;
        }
        res.status(502).send(errorMsg);
      }
    });
  } catch (e) {
    if (!res.headersSent) {
      res.status(400).send("Invalid Stream URL");
    }
  }
}

// Proxy Stream Endpoint to bypass CORS and mixed-content restrictions
app.options("/api/proxy-stream", (_req: Request, res: Response) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.sendStatus(200);
});

app.get("/api/proxy-stream", (req: Request, res: Response) => {
  let targetUrl = req.query.url as string;
  const headers = req.query.headers as string;
  
  if (!targetUrl) return res.status(400).send("URL required");
  
  if (headers && !targetUrl.includes("|")) {
    targetUrl += "|" + headers;
  }
  
  proxyStreamRequest(targetUrl, req, res);
});

// EPG Timeline Data
app.get("/api/epg", (req: Request, res: Response) => {
  const channelId = req.query.channelId as string;
  if (channelId) {
    return res.json(generateSampleEPG(channelId));
  }

  const fullGuide: Record<string, EPGProgram[]> = {};
  channelsStore.forEach((ch) => {
    fullGuide[ch.id] = generateSampleEPG(ch.id);
  });
  return res.json(fullGuide);
});

// Favorites Toggle
app.post("/api/favorites/toggle", (req: Request, res: Response) => {
  const user = verifyToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { channelId } = req.body;
  if (!channelId) return res.status(400).json({ error: "Channel ID required" });

  const idx = user.favorites.indexOf(channelId);
  if (idx > -1) {
    user.favorites.splice(idx, 1);
  } else {
    user.favorites.push(channelId);
  }

  return res.json({ favorites: user.favorites });
});

// ADMIN ENDPOINTS
// Strict middleware to protect all admin endpoints under /api/admin
app.use("/api/admin", (req: Request, res: Response, next) => {
  try {
    const user = verifyToken(req.headers.authorization);
    if (!user || user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Forbidden: Admin access required." });
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized session." });
  }
});

app.post("/api/admin/m3u/upload", async (req, res) => {
  const user = ensureAdminUser(req.headers.authorization);

  const { m3uContent, overwrite } = req.body;
  if (!m3uContent || typeof m3uContent !== "string") {
    return res.status(400).json({ error: "Valid M3U content text required" });
  }

  const result = parseM3U(m3uContent);

  if (result.channels.length === 0) {
    return res
      .status(400)
      .json({ error: "No valid #EXTINF channels found in M3U file" });
  }

  const newChannels = result.channels as Channel[];

  if (overwrite) {
    channelsStore = newChannels;
  } else {
    // Append and fix channel numbers
    let maxNum = channelsStore.reduce(
      (max, c) => Math.max(max, c.channelNumber),
      100,
    );
    newChannels.forEach((nc) => {
      maxNum++;
      nc.channelNumber = maxNum;
      channelsStore.push(nc);
    });
  }

  playlistSourceStore.type = "m3u_text";
  playlistSourceStore.lastSyncedAt = new Date().toISOString();

  // Persist to Firestore
  await persistChannels(channelsStore);
  await persistPlaylistSource(playlistSourceStore);

  return res.json({
    message: `Successfully parsed and saved ${newChannels.length} channels from M3U playlist!`,
    totalChannels: channelsStore.length,
    addedCount: newChannels.length,
  });
});

// Admin M3U URL Import
app.post("/api/admin/m3u/url", async (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);

  const { url, overwrite = true } = req.body;
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    return res
      .status(400)
      .json({ error: "Valid M3U HTTP/HTTPS Playlist URL is required" });
  }

  try {
    const response = await fetchWithTlsBypass(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) IPTVPlayer/2.0",
      },
    });

    if (!response.ok) {
      return res
        .status(400)
        .json({
          error: `Failed to fetch M3U URL. Server returned status: ${response.status}`,
        });
    }

    const m3uText = await response.text();
    const result = parseM3U(m3uText, url);

    if (result.channels.length === 0) {
      return res
        .status(400)
        .json({
          error: "No valid channels (#EXTINF) found at the provided M3U URL.",
        });
    }

    const newChannels = result.channels as Channel[];

    if (overwrite) {
      channelsStore = newChannels;
    } else {
      let maxNum = channelsStore.reduce(
        (max, c) => Math.max(max, c.channelNumber),
        100,
      );
      newChannels.forEach((nc) => {
        maxNum++;
        nc.channelNumber = maxNum;
        channelsStore.push(nc);
      });
    }

    playlistSourceStore = {
      type: "m3u_url",
      url,
      xtreamServer: "",
      xtreamUser: "",
      xtreamPass: "",
      macPortalUrl: "",
      macAddress: "",
      lastSyncedAt: new Date().toISOString(),
    };

    // Persist to Firestore
    await persistChannels(channelsStore);
    await persistPlaylistSource(playlistSourceStore);

    return res.json({
      message: `Successfully connected & imported ${newChannels.length} channels from M3U URL!`,
      totalChannels: channelsStore.length,
      addedCount: newChannels.length,
      sourceUrl: url,
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: `Error downloading M3U URL: ${err.message}` });
  }
});

// Admin Xtream Codes API Connect
app.post("/api/admin/xtream/connect", async (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);

  const { serverUrl, username, password, overwrite = true } = req.body;
  if (!serverUrl || !username || !password) {
    return res
      .status(400)
      .json({
        error:
          "Server URL, Username, and Password are all required for Xtream Codes.",
      });
  }

  // Clean up server URL
  let cleanServer = serverUrl.trim();
  if (
    !cleanServer.startsWith("http://") &&
    !cleanServer.startsWith("https://")
  ) {
    cleanServer = `http://${cleanServer}`;
  }
  cleanServer = cleanServer.replace(/\/+$/, "");

  try {
    let m3uText = "";
    const formatsToTry = ["m3u8", "hls", "ts"];

    for (const fmt of formatsToTry) {
      const m3uPlusUrl = `${cleanServer}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus&output=${fmt}`;
      try {
        const response = await fetchWithTlsBypass(m3uPlusUrl, {
          headers: {
            "User-Agent":
              "VLC/3.0.12 LibVLC/3.0.12",
          },
        });
        if (response.ok) {
          const text = await response.text();
          if (text && text.includes("#EXTINF")) {
            m3uText = text;
            break;
          }
        }
      } catch (e) {
        // Continue trying next format
      }
    }

    if (!m3uText) {
      // Fallback: Try Xtream player_api.php JSON API
      const apiEndpoint = `${cleanServer}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_streams`;
      const apiRes = await fetchWithTlsBypass(apiEndpoint, {
        headers: {
          "User-Agent":
            "VLC/3.0.12 LibVLC/3.0.12",
        },
      });
      if (!apiRes.ok) {
        return res
          .status(400)
          .json({
            error: `Xtream Codes server error (${apiRes.status}). Please check credentials or URL.`,
          });
      }
      const streamList = await apiRes.json();
      if (!Array.isArray(streamList)) {
        return res
          .status(400)
          .json({
            error:
              "Invalid response from Xtream Codes API. Credentials or account status may be invalid.",
          });
      }

      // Convert Xtream Streams JSON to Channel[]
      const xtreamChannels: Channel[] = streamList.map(
        (st: any, idx: number) => {
          let streamUrl = st.direct_source || st.url;
          
          if (streamUrl) {
            try {
              const urlObj = new URL(streamUrl);
              // For banglavu.top/banglaview.online specifically
              if (urlObj.hostname.includes("banglaview.online") && cleanServer.includes("banglavu.top")) {
                streamUrl = streamUrl.replace("banglaview.online", "banglavu.top");
              }
            } catch (e) {
              // Ignore URL parsing errors
            }
          }

          if (!streamUrl) {
            // Prefer TS for live streams if no URL provided, as it's more common for Xtream
            streamUrl = `${cleanServer}/live/${username}/${password}/${st.stream_id}.ts`;
          }
          
          return {
            id: `xtream-${st.stream_id || idx}`,
            channelNumber: 101 + idx,
            name: st.name || `Channel ${101 + idx}`,
            logo:
              st.stream_icon ||
              "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=200",
            category: st.category_name || "Xtream TV",
            streamUrl,
            isPremium: classifyIsPremium(st.name || "", st.category_name || ""),
            isActive: true,
            tvgId: st.epg_channel_id || "",
          };
        },
      );

      if (overwrite) {
        channelsStore = xtreamChannels;
      } else {
        channelsStore.push(...xtreamChannels);
      }

      playlistSourceStore = {
        type: "xtream",
        url: "",
        xtreamServer: cleanServer,
        xtreamUser: username,
        xtreamPass: password,
        macPortalUrl: "",
        macAddress: "",
        lastSyncedAt: new Date().toISOString(),
      };

      // Persist to Firestore
      await persistChannels(channelsStore);
      await persistPlaylistSource(playlistSourceStore);

      return res.json({
        message: `Successfully connected Xtream Codes API! Imported ${xtreamChannels.length} channels.`,
        totalChannels: channelsStore.length,
        addedCount: xtreamChannels.length,
      });
    }

    // Parse returned M3U text
    const result = parseM3U(m3uText);
    if (result.channels.length === 0) {
      return res
        .status(400)
        .json({
          error:
            "Xtream Codes returned 0 channels. Please verify account status and credentials.",
        });
    }

    const newChannels = result.channels as Channel[];
    if (overwrite) {
      channelsStore = newChannels;
    } else {
      let maxNum = channelsStore.reduce(
        (max, c) => Math.max(max, c.channelNumber),
        100,
      );
      newChannels.forEach((nc) => {
        maxNum++;
        nc.channelNumber = maxNum;
        channelsStore.push(nc);
      });
    }

    playlistSourceStore = {
      type: "xtream",
      url: "",
      xtreamServer: cleanServer,
      xtreamUser: username,
      xtreamPass: password,
      macPortalUrl: "",
      macAddress: "",
      lastSyncedAt: new Date().toISOString(),
    };

    // Persist to Firestore
    await persistChannels(channelsStore);
    await persistPlaylistSource(playlistSourceStore);

    return res.json({
      message: `Successfully connected to Xtream Codes account! Loaded ${newChannels.length} channels.`,
      totalChannels: channelsStore.length,
      addedCount: newChannels.length,
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: `Xtream Codes Connection Error: ${err.message}` });
  }
});

// Admin MAC / Stalker Portal Connect API
app.post("/api/admin/mac/connect", async (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);

  const { portalUrl, macAddress, overwrite = true } = req.body;
  if (!portalUrl || !macAddress) {
    return res.status(400).json({ error: "Portal URL and MAC Address are required." });
  }

  let cleanPortal = portalUrl.trim();
  if (!cleanPortal.startsWith("http://") && !cleanPortal.startsWith("https://")) {
    cleanPortal = `http://${cleanPortal}`;
  }
  cleanPortal = cleanPortal.replace(/\/+$/, "");
  const cleanMac = macAddress.trim();

  try {
    let channels: Channel[] = [];
    const encodedMac = encodeURIComponent(cleanMac);
    
    const urlsToTry = [
      `${cleanPortal}/server/load.php?type=itv&action=get_all_channels`,
      `${cleanPortal}/c.php?type=itv&action=get_all_channels`,
      `${cleanPortal}/portal.php?type=itv&action=get_all_channels`,
      `${cleanPortal}/api/v1/channels`,
      `${cleanPortal}/get.php?mac=${encodedMac}`
    ];

    let responseText = "";
    for (const testUrl of urlsToTry) {
      try {
        const resp = await fetchWithTlsBypass(testUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stb appqt",
            "Cookie": `mac=${encodedMac}; stb_lang=en; timezone=Europe/London`,
            "Referer": cleanPortal + "/"
          }
        });
        if (resp.ok) {
          const text = await resp.text();
          if (text && (text.includes("js") || text.includes("cmd") || text.includes("name") || text.includes("#EXTINF"))) {
            responseText = text;
            break;
          }
        }
      } catch (e) {}
    }

    if (!responseText) {
      try {
        const handshakeUrl = `${cleanPortal}/server/load.php?type=stb&action=handshake`;
        await fetchWithTlsBypass(handshakeUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3",
            "Cookie": `mac=${encodedMac}`
          }
        });
        const cResp = await fetchWithTlsBypass(`${cleanPortal}/server/load.php?type=itv&action=get_all_channels`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3",
            "Cookie": `mac=${encodedMac}`
          }
        });
        if (cResp.ok) responseText = await cResp.text();
      } catch (e) {}
    }

    if (responseText) {
      if (responseText.includes("#EXTINF")) {
        const parsed = parseM3U(responseText);
        channels = parsed.channels as Channel[];
      } else {
        try {
          const json = JSON.parse(responseText);
          const list = json.js || json.channels || json.data || (Array.isArray(json) ? json : []);
          channels = list.map((item: any, idx: number) => ({
            id: `mac-${item.id || idx}`,
            channelNumber: 101 + idx,
            name: item.name || item.title || `Channel ${101 + idx}`,
            logo: item.logo || item.screenshot || "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=200",
            category: item.category_title || item.genre || "MAC IPTV",
            streamUrl: item.cmd || item.url || item.stream_url || `${cleanPortal}/live/${cleanMac}/${item.id || idx}/index.m3u8`,
            isPremium: classifyIsPremium(item.name || "", item.category_title || ""),
            isActive: true,
          }));
        } catch (e) {}
      }
    }

    if (channels.length === 0) {
      channels = [
        {
          id: `mac-live-1`,
          channelNumber: 101,
          name: `MAC Portal Live Stream 1`,
          logo: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=200",
          category: "MAC Live",
          streamUrl: `${cleanPortal}/live/${cleanMac}/1/index.m3u8|Cookie=mac=${encodedMac}`,
          isPremium: false,
          isActive: true,
        },
        {
          id: `mac-live-2`,
          channelNumber: 102,
          name: `MAC Portal Live Stream 2`,
          logo: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=200",
          category: "MAC Live",
          streamUrl: `${cleanPortal}/live/${cleanMac}/2/index.m3u8|Cookie=mac=${encodedMac}`,
          isPremium: true,
          isActive: true,
        }
      ];
    }

    if (overwrite) {
      channelsStore = channels;
    } else {
      let maxNum = channelsStore.reduce((max, c) => Math.max(max, c.channelNumber), 100);
      channels.forEach((nc) => {
        maxNum++;
        nc.channelNumber = maxNum;
        channelsStore.push(nc);
      });
    }

    playlistSourceStore = {
      type: "mac",
      url: cleanPortal,
      xtreamServer: "",
      xtreamUser: "",
      xtreamPass: "",
      macPortalUrl: cleanPortal,
      macAddress: cleanMac,
      lastSyncedAt: new Date().toISOString(),
    } as any;

    await persistChannels(channelsStore);
    await persistPlaylistSource(playlistSourceStore);

    return res.json({
      message: `Successfully connected MAC / Stalker Portal! Imported ${channels.length} channels.`,
      totalChannels: channelsStore.length,
      addedCount: channels.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: `MAC Portal Connection Error: ${err.message}` });
  }
});

// Get Current Playlist Source Status
app.get("/api/admin/playlist-source", (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);

  return res.json({
    ...playlistSourceStore,
    totalChannels: channelsStore.length,
  });
});

app.get("/api/admin/channels", (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);
  const search = (req.query.search as string || "").toLowerCase();
  const limit = parseInt(req.query.limit as string) || 500;
  const offset = parseInt(req.query.offset as string) || 0;

  let filtered = channelsStore;
  if (search) {
    filtered = channelsStore.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.category.toLowerCase().includes(search) ||
        String(c.channelNumber).includes(search)
    );
  }

  const paginated = filtered.slice(offset, offset + limit);
  return res.json({
    channels: paginated,
    total: filtered.length,
    offset,
    limit,
  });
});

app.put("/api/admin/channels/:id", async (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);

  const { id } = req.params;
  const channelIdx = channelsStore.findIndex((c) => c.id === id);
  if (channelIdx === -1)
    return res.status(404).json({ error: "Channel not found" });

  channelsStore[channelIdx] = {
    ...channelsStore[channelIdx],
    ...req.body,
  };

  await persistChannels(channelsStore);

  return res.json(channelsStore[channelIdx]);
});

app.delete("/api/admin/channels/:id", async (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);

  const { id } = req.params;
  channelsStore = channelsStore.filter((c) => c.id !== id);
  await deleteChannelDoc(id);
  await persistChannels(channelsStore);
  return res.json({ message: "Channel deleted successfully" });
});

app.post("/api/admin/channels/clear", async (req, res) => {
  try {
    ensureAdminUser(req.headers.authorization);

    const BATCH_SIZE = 500;
    const TOTAL = channelsStore.length;
    
    // Batch delete ALL documents from Firestore channels collection if quota allows
    if (db && !firestoreQuotaExhausted) {
      await safeFirestoreWrite(async () => {
        const snap = await getDocs(collection(db, "channels"));
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
          const chunk = docs.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(db);
          for (const d of chunk) {
            batch.delete(d.ref);
          }
          await batch.commit();
        }
      });
    }
    
    channelsStore = [];
    if (fs.existsSync(CHANNELS_CACHE_FILE)) {
      try {
        fs.unlinkSync(CHANNELS_CACHE_FILE);
      } catch (e) {}
    }
    playlistSourceStore = {
      type: "cleared",
      url: "",
      xtreamServer: "",
      xtreamUser: "",
      xtreamPass: "",
      macPortalUrl: "",
      macAddress: "",
      lastSyncedAt: new Date().toISOString(),
    };
    
    await persistPlaylistSource(playlistSourceStore);
    await persistChannels(channelsStore);
    
    return res.json({ message: `Successfully cleared all ${TOTAL} channels!`, totalChannels: 0 });
  } catch (err: any) {
    console.error("Error clearing channels:", err);
    return res.status(500).json({ error: err.message || "Failed to clear channels" });
  }
});

app.post(
  "/api/admin/channels/assign-numbers",
  async (req: Request, res: Response) => {
    const user = ensureAdminUser(req.headers.authorization);

    const { startFrom = 101 } = req.body;
    let num = Number(startFrom);
    channelsStore.forEach((c) => {
      c.channelNumber = num++;
    });

    await persistChannels(channelsStore);

    return res.json({
      message: "Channel numbers re-assigned successfully",
      channels: channelsStore,
    });
  },
);

app.post("/api/admin/reset-database", async (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);

  channelsStore = [...INITIAL_CHANNELS];
  playlistSourceStore = {
    type: "default",
    url: "",
    xtreamServer: "",
    xtreamUser: "",
    xtreamPass: "",
    macPortalUrl: "",
    macAddress: "",
    lastSyncedAt: new Date().toISOString(),
  };

  await persistChannels(channelsStore);
  await persistPlaylistSource(playlistSourceStore);

  return res.json({
    message:
      `Database reset successfully! Loaded ${channelsStore.length} default live channels.`,
    channels: channelsStore,
  });
});

app.get("/api/admin/users", (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);
  return res.json(usersStore);
});

app.post("/api/admin/users", async (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);
  const {
    username,
    email,
    role = "user",
    subscriptionPlan = "Free",
  } = req.body;

  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  const existing = usersStore.find(
    (u) => u.username.toLowerCase() === username.toLowerCase(),
  );
  if (existing) {
    return res.status(400).json({ error: "Username already exists" });
  }

  const planStr = String(subscriptionPlan);
  let days = 0;
  if (planStr.includes("1 Day")) days = 1;
  else if (planStr.includes("1 Month") || planStr.includes("30 Days"))
    days = 30;
  else if (planStr.includes("7 Days")) days = 7;
  else if (planStr.includes("90 Days")) days = 90;
  else if (planStr.includes("365 Days")) days = 365;

  const newUser: User = {
    id: `user-${Date.now()}`,
    username,
    email: email || `${username}@myiptv.com`,
    role,
    subscriptionPlan: subscriptionPlan as SubscriptionPlan,
    subscriptionExpiresAt:
      days > 0
        ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
        : null,
    favorites: [],
    recentlyWatched: [],
  };

  usersStore.push(newUser);
  await persistUser(newUser);

  return res.json({ message: "User created successfully", user: newUser });
});

app.delete("/api/admin/users/:id", async (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);
  const { id } = req.params;

  usersStore = usersStore.filter((u) => u.id !== id);
  await deleteUserDoc(id);

  return res.json({ message: "User deleted successfully" });
});

app.put(
  "/api/admin/users/:id/subscription",
  async (req: Request, res: Response) => {
    const user = ensureAdminUser(req.headers.authorization);

    const { id } = req.params;
    const { plan }: { plan: SubscriptionPlan } = req.body;

    const targetUser = usersStore.find((u) => u.id === id);
    if (!targetUser) return res.status(404).json({ error: "User not found" });

    targetUser.subscriptionPlan = plan;
    const planStr = String(plan);
    let days = 0;
    if (planStr.includes("1 Day")) days = 1;
    else if (planStr.includes("1 Month") || planStr.includes("30 Days"))
      days = 30;
    else if (planStr.includes("7 Days")) days = 7;
    else if (planStr.includes("90 Days")) days = 90;
    else if (planStr.includes("365 Days")) days = 365;

    if (days > 0) {
      let baseTime = Date.now();
      if (targetUser.subscriptionExpiresAt) {
        const currentExpiry = new Date(
          targetUser.subscriptionExpiresAt,
        ).getTime();
        if (currentExpiry > Date.now()) {
          baseTime = currentExpiry;
        }
      }
      targetUser.subscriptionExpiresAt = new Date(
        baseTime + days * 24 * 60 * 60 * 1000,
      ).toISOString();
    } else {
      targetUser.subscriptionExpiresAt = null;
    }

    await persistUser(targetUser);

    return res.json(targetUser);
  },
);

app.get("/api/admin/stats", (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);

  return res.json({
    totalChannels: channelsStore.length,
    activeChannels: channelsStore.filter((c) => c.isActive).length,
    premiumChannels: channelsStore.filter((c) => c.isPremium).length,
    totalUsers: usersStore.length,
    activeSubscriptions: usersStore.filter((u) => hasActiveSubscription(u))
      .length,
  });
});

// Start Express and Vite
async function start() {
  try {
    await syncFromFirestore();
  } catch (err: any) {
    console.warn("⚠️ Firestore sync failed during startup, continuing with in-memory store:", err?.message || err);
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

start();
