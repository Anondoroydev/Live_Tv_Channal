// api/index.ts
import express from "express";
import cors from "cors";
import path from "path";
import http from "http";
import https from "https";
import fs from "fs";
import zlib from "zlib";
import stream from "stream";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  setLogLevel,
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  deleteDoc,
  writeBatch
} from "firebase/firestore";

// src/data/initialChannels.ts
var INITIAL_CHANNELS = [
  {
    id: "ch-0",
    channelNumber: 0,
    name: "Mux Live Stream HD",
    logo: "https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=120&q=80",
    category: "Entertainment",
    streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    isPremium: false,
    isActive: true
  },
  {
    id: "ch-1",
    channelNumber: 1,
    name: "DW News HD Live",
    logo: "https://images.unsplash.com/photo-1586899028174-e7098604235b?auto=format&fit=crop&w=120&q=80",
    category: "News",
    streamUrl: "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8",
    isPremium: false,
    isActive: true
  },
  {
    id: "ch-2",
    channelNumber: 2,
    name: "NASA TV HD Science",
    logo: "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=120&q=80",
    category: "Documentary",
    streamUrl: "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8",
    isPremium: false,
    isActive: true
  },
  {
    id: "ch-3",
    channelNumber: 3,
    name: "Tears of Steel HD Movie",
    logo: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=120&q=80",
    category: "Movies",
    streamUrl: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    isPremium: false,
    isActive: true
  },
  {
    id: "ch-4",
    channelNumber: 4,
    name: "1+1 International HD",
    logo: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=120&q=80",
    category: "International",
    streamUrl: "https://dash2.antik.sk/live/test_one_plus_one_int_tizen/playlist.m3u8",
    isPremium: false,
    isActive: true
  },
  {
    id: "ch-5",
    channelNumber: 5,
    name: "2GB Sydney Live News",
    logo: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=120&q=80",
    category: "News",
    streamUrl: "https://2gblive.akamaized.net/hls/live/2033805/2GB/index.m3u8",
    isPremium: false,
    isActive: true
  },
  {
    id: "ch-6",
    channelNumber: 6,
    name: "Big Buck Bunny 1080p",
    logo: "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=120&q=80",
    category: "Kids",
    streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    isPremium: false,
    isActive: true
  },
  {
    id: "ch-7",
    channelNumber: 7,
    name: "For Bigger Blazes (Sports)",
    logo: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=120&q=80",
    category: "Sports",
    streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    isPremium: false,
    isActive: true
  },
  {
    id: "ch-8",
    channelNumber: 8,
    name: "For Bigger Escapes (Travel)",
    logo: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=120&q=80",
    category: "Entertainment",
    streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    isPremium: false,
    isActive: true
  },
  {
    id: "ch-9",
    channelNumber: 9,
    name: "For Bigger Joyrides",
    logo: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=120&q=80",
    category: "Action",
    streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    isPremium: false,
    isActive: true
  },
  {
    id: "ch-10",
    channelNumber: 10,
    name: "Somoy TV HD",
    logo: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=120&q=80",
    category: "Bangla",
    streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    isPremium: false,
    isActive: true
  },
  {
    id: "ch-11",
    channelNumber: 11,
    name: "Independent TV HD",
    logo: "https://images.unsplash.com/photo-1586899028174-e7098604235b?auto=format&fit=crop&w=120&q=80",
    category: "Bangla",
    streamUrl: "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8",
    isPremium: false,
    isActive: true
  },
  {
    id: "ch-12",
    channelNumber: 12,
    name: "Channel i HD",
    logo: "https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=120&q=80",
    category: "Bangla",
    streamUrl: "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8",
    isPremium: false,
    isActive: true
  },
  {
    id: "ch-13",
    channelNumber: 13,
    name: "T Sports HD",
    logo: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=120&q=80",
    category: "Bangla",
    streamUrl: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    isPremium: false,
    isActive: true
  },
  {
    id: "ch-14",
    channelNumber: 14,
    name: "GTV HD (Gazi TV)",
    logo: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=120&q=80",
    category: "Bangla",
    streamUrl: "https://dash2.antik.sk/live/test_one_plus_one_int_tizen/playlist.m3u8",
    isPremium: false,
    isActive: true
  },
  {
    id: "ch-15",
    channelNumber: 15,
    name: "Jamuna TV HD",
    logo: "https://images.unsplash.com/photo-1586899028174-e7098604235b?auto=format&fit=crop&w=120&q=80",
    category: "Bangla",
    streamUrl: "https://2gblive.akamaized.net/hls/live/2033805/2GB/index.m3u8",
    isPremium: false,
    isActive: true
  },
  {
    id: "ch-16",
    channelNumber: 16,
    name: "NTV Bangladesh HD",
    logo: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=120&q=80",
    category: "Bangla",
    streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    isPremium: false,
    isActive: true
  },
  {
    id: "ch-17",
    channelNumber: 17,
    name: "RTV HD",
    logo: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=120&q=80",
    category: "Bangla",
    streamUrl: "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8",
    isPremium: false,
    isActive: true
  },
  {
    id: "ch-18",
    channelNumber: 18,
    name: "Deepto TV HD",
    logo: "https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=120&q=80",
    category: "Bangla",
    streamUrl: "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8",
    isPremium: false,
    isActive: true
  },
  {
    id: "ch-19",
    channelNumber: 19,
    name: "ATN Bangla HD",
    logo: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=120&q=80",
    category: "Bangla",
    streamUrl: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    isPremium: false,
    isActive: true
  },
  {
    id: "ch-20",
    channelNumber: 20,
    name: "Ekattor TV",
    logo: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=120&q=80",
    category: "Bangla",
    streamUrl: "https://dash2.antik.sk/live/test_one_plus_one_int_tizen/playlist.m3u8",
    isPremium: true,
    isActive: true
  },
  {
    id: "ch-21",
    channelNumber: 21,
    name: "Maasranga TV",
    logo: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=120&q=80",
    category: "Bangla",
    streamUrl: "https://2gblive.akamaized.net/hls/live/2033805/2GB/index.m3u8",
    isPremium: true,
    isActive: true
  },
  {
    id: "ch-22",
    channelNumber: 22,
    name: "Colors Bangla HD",
    logo: "https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=120&q=80",
    category: "Bangla",
    streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    isPremium: true,
    isActive: true
  },
  {
    id: "ch-23",
    channelNumber: 23,
    name: "Star Jalsha HD",
    logo: "https://images.unsplash.com/photo-1586899028174-e7098604235b?auto=format&fit=crop&w=120&q=80",
    category: "Bangla",
    streamUrl: "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8",
    isPremium: true,
    isActive: true
  },
  {
    id: "ch-24",
    channelNumber: 24,
    name: "Zee Bangla HD",
    logo: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=120&q=80",
    category: "Bangla",
    streamUrl: "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8",
    isPremium: true,
    isActive: true
  },
  {
    id: "ch-25",
    channelNumber: 25,
    name: "Discovery HD",
    logo: "https://images.unsplash.com/photo-1500462859194-8113199fa73d?auto=format&fit=crop&w=120&q=80",
    category: "Documentary",
    streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    isPremium: true,
    isActive: true
  },
  {
    id: "ch-26",
    channelNumber: 26,
    name: "National Geographic HD",
    logo: "https://images.unsplash.com/photo-1516738901171-8eb4fc13bd20?auto=format&fit=crop&w=120&q=80",
    category: "Documentary",
    streamUrl: "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8",
    isPremium: true,
    isActive: true
  },
  {
    id: "ch-27",
    channelNumber: 27,
    name: "Animal Planet HD",
    logo: "https://images.unsplash.com/photo-1534067783941-51c9c23ecefd?auto=format&fit=crop&w=120&q=80",
    category: "Documentary",
    streamUrl: "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8",
    isPremium: true,
    isActive: true
  },
  {
    id: "ch-28",
    channelNumber: 28,
    name: "HBO HD Premium",
    logo: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=120&q=80",
    category: "Movies",
    streamUrl: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    isPremium: true,
    isActive: true
  },
  {
    id: "ch-29",
    channelNumber: 29,
    name: "Star Movies HD",
    logo: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=120&q=80",
    category: "Movies",
    streamUrl: "https://dash2.antik.sk/live/test_one_plus_one_int_tizen/playlist.m3u8",
    isPremium: true,
    isActive: true
  },
  {
    id: "ch-70",
    channelNumber: 70,
    name: "Sony TV HD",
    logo: "https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=120&q=80",
    category: "Entertainment",
    streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    isPremium: true,
    isActive: true
  },
  {
    id: "ch-71",
    channelNumber: 71,
    name: "Sony Sports 1 HD",
    logo: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=120&q=80",
    category: "Sports",
    streamUrl: "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8",
    isPremium: true,
    isActive: true
  },
  {
    id: "ch-72",
    channelNumber: 72,
    name: "Sony MAX HD",
    logo: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=120&q=80",
    category: "Movies",
    streamUrl: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    isPremium: true,
    isActive: true
  },
  {
    id: "ch-73",
    channelNumber: 73,
    name: "Sony Aath",
    logo: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=120&q=80",
    category: "Bangla",
    streamUrl: "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8",
    isPremium: true,
    isActive: true
  },
  {
    id: "ch-74",
    channelNumber: 74,
    name: "Sony Ten 1 HD",
    logo: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=120&q=80",
    category: "Sports",
    streamUrl: "https://dash2.antik.sk/live/test_one_plus_one_int_tizen/playlist.m3u8",
    isPremium: true,
    isActive: true
  },
  {
    id: "ch-75",
    channelNumber: 75,
    name: "Sony SAB HD",
    logo: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=120&q=80",
    category: "Entertainment",
    streamUrl: "https://2gblive.akamaized.net/hls/live/2033805/2GB/index.m3u8",
    isPremium: true,
    isActive: true
  },
  {
    id: "ch-76",
    channelNumber: 76,
    name: "Midnight Movie Adult HD",
    logo: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=120&q=80",
    category: "Adult (18+)",
    streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    isPremium: true,
    isActive: true
  },
  {
    id: "ch-77",
    channelNumber: 77,
    name: "Private Cinema Adult 18+",
    logo: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=120&q=80",
    category: "Adult (18+)",
    streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    isPremium: true,
    isActive: true
  }
];
function generateSampleEPG(channelId) {
  const now = /* @__PURE__ */ new Date();
  const startTime = new Date(now.getTime() - 15 * 60 * 1e3).toLocaleTimeString(
    [],
    { hour: "2-digit", minute: "2-digit" }
  );
  const endTime = new Date(now.getTime() + 45 * 60 * 1e3).toLocaleTimeString(
    [],
    { hour: "2-digit", minute: "2-digit" }
  );
  const nextStart = endTime;
  const nextEnd = new Date(now.getTime() + 105 * 60 * 1e3).toLocaleTimeString(
    [],
    { hour: "2-digit", minute: "2-digit" }
  );
  return [
    {
      id: `epg-now-${channelId}`,
      channelId,
      title: "Live Stream Program",
      description: "Current live broadcast on channel.",
      startTime,
      endTime,
      category: "General"
    },
    {
      id: `epg-next-${channelId}`,
      channelId,
      title: "Upcoming Broadcast",
      description: "Next scheduled program.",
      startTime: nextStart,
      endTime: nextEnd,
      category: "General"
    }
  ];
}

// api/index.ts
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
var httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 15e3,
  maxSockets: 256,
  maxFreeSockets: 64,
  timeout: 3e4
});
var httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 15e3,
  maxSockets: 256,
  maxFreeSockets: 64,
  rejectUnauthorized: false,
  timeout: 3e4
});
var knownNonSslDomains = /* @__PURE__ */ new Set([
  "banglaview.online",
  "banglavu.top",
  "gpcdn.net",
  "mtlivestream.com",
  "mtlive",
  "toffee.com",
  "bioscopelive",
  "bdiptv",
  "bdix",
  "jagobd",
  "somoy",
  "nagorik",
  "tsports",
  "mjunoon.tv",
  "vodzong.mjunoon.tv",
  "mjunoon"
]);
function fetchWithTlsBypass(urlStr, options = {}, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 10) {
      return reject(new Error("Too many redirects"));
    }
    try {
      const parsed = new URL(urlStr);
      const isHttps = parsed.protocol === "https:";
      const client = isHttps ? https : http;
      const reqHeaders = {
        "User-Agent": "VLC/3.0.12 LibVLC/3.0.12",
        Accept: "*/*",
        ...options.headers,
        Host: parsed.host
      };
      const reqOptions = {
        method: options.method || "GET",
        headers: reqHeaders,
        rejectUnauthorized: false,
        servername: parsed.hostname,
        ciphers: "DEFAULT:@SECLEVEL=1",
        agent: isHttps ? httpsAgent : httpAgent
      };
      const req = client.request(urlStr, reqOptions, (res) => {
        const statusCode = res.statusCode || 200;
        if ([301, 302, 303, 307, 308].includes(statusCode) && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, urlStr).href;
          return resolve(fetchWithTlsBypass(redirectUrl, options, redirectCount + 1));
        }
        let responseStream = res;
        const encoding = (res.headers["content-encoding"] || "").toLowerCase();
        if (encoding.includes("gzip")) {
          responseStream = res.pipe(zlib.createGunzip());
        } else if (encoding.includes("deflate")) {
          responseStream = res.pipe(zlib.createInflate());
        } else if (encoding.includes("br")) {
          responseStream = res.pipe(zlib.createBrotliDecompress());
        }
        const chunks = [];
        responseStream.on("data", (chunk) => chunks.push(chunk));
        responseStream.on("end", () => {
          const buffer = Buffer.concat(chunks);
          const textVal = buffer.toString("utf8");
          resolve({
            ok: statusCode >= 200 && statusCode < 300,
            status: statusCode,
            text: async () => textVal,
            json: async () => JSON.parse(textVal)
          });
        });
        responseStream.on("error", (err) => {
          reject(err);
        });
      });
      req.on("error", (err) => {
        if (isHttps && redirectCount < 3) {
          const httpUrl = urlStr.replace("https://", "http://");
          console.warn(`[fetchWithTlsBypass] HTTPS failed (${err.message}), retrying with HTTP: ${httpUrl}`);
          return resolve(fetchWithTlsBypass(httpUrl, options, redirectCount + 1));
        }
        reject(err);
      });
      req.setTimeout(15e3, () => {
        req.destroy(new Error("Request timeout"));
      });
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}
var app = express();
var PORT = 3e3;
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
var firebaseConfig = {
  projectId: "gen-lang-client-0748817758",
  appId: "1:798244002253:web:224c34bd7570e8d5bf0c84",
  apiKey: "AIzaSyBNHtSOpL_5hQOyjuR06ZkrZh1wn2mn3Ks",
  authDomain: "gen-lang-client-0748817758.firebaseapp.com",
  storageBucket: "gen-lang-client-0748817758.firebasestorage.app",
  messagingSenderId: "798244002253",
  firestoreDatabaseId: "ai-studio-remixremixremixr-d4b7c768-664f-4299-952e-1443f0101616"
};
try {
  const configPaths = [
    path.join(process.cwd(), "firebase-applet-config.json"),
    path.join(process.cwd(), "..", "firebase-applet-config.json"),
    path.join(__dirname, "firebase-applet-config.json"),
    path.join(__dirname, "..", "firebase-applet-config.json"),
    path.join(__dirname, "../..", "firebase-applet-config.json")
  ];
  for (const p of configPaths) {
    if (fs.existsSync(p)) {
      firebaseConfig = JSON.parse(fs.readFileSync(p, "utf8"));
      break;
    }
  }
} catch (e) {
}
var db = null;
try {
  setLogLevel("silent");
  const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
  console.log("\u{1F525} Firebase Firestore initialized successfully in server.ts with database ID:", firebaseConfig.firestoreDatabaseId);
} catch (e) {
  console.log("\u2139\uFE0F Firestore initialization failed, running in-memory");
}
var channelsStore = [];
var playlistSourceStore = {
  type: "default",
  url: "",
  xtreamServer: "",
  xtreamUser: "",
  xtreamPass: "",
  lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString()
};
var paymentsStore = [];
var usersStore = [
  {
    id: "user-admin",
    username: "admin",
    email: "admin@myiptv.com",
    role: "admin",
    subscriptionPlan: "365 Days",
    subscriptionExpiresAt: new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1e3
    ).toISOString(),
    favorites: ["ch-0", "ch-4"],
    recentlyWatched: ["ch-0", "ch-1"]
  },
  {
    id: "user-free",
    username: "freeuser",
    email: "user@myiptv.com",
    role: "user",
    subscriptionPlan: "Free",
    subscriptionExpiresAt: null,
    favorites: [],
    recentlyWatched: []
  },
  {
    id: "user-expired",
    username: "expireduser",
    email: "expired@myiptv.com",
    role: "user",
    subscriptionPlan: "Expired",
    subscriptionExpiresAt: new Date(
      Date.now() - 24 * 60 * 60 * 1e3
    ).toISOString(),
    favorites: [],
    recentlyWatched: []
  }
];
function isAdultContent(name, category = "") {
  const lowerName = (name || "").toLowerCase();
  const lowerCat = (category || "").toLowerCase();
  const adultPatterns = [
    /adult/i,
    /18\+/i,
    /\bxxx\b/i,
    /porn/i,
    /xvideos/i,
    /brazzers/i,
    /playboy/i,
    /penthouse/i,
    /redlight/i,
    /red\s*traffic/i,
    /hustler/i,
    /erotic/i,
    /exotic/i,
    /x-rated/i,
    /for\s*adult/i,
    /\bnsfw\b/i,
    /mature/i,
    /midnight\s*(hot|movie|tv)?/i,
    /private\s*cam/i,
    /vixen/i,
    /blacked/i,
    /tushy/i,
    /bangbros/i,
    /naughty/i,
    /uncensored/i,
    /blue\s*movie/i,
    /blue\s*film/i,
    /adult\s*(tv|movie|channel|vod)/i,
    /mycam/i,
    /webcam\s*adult/i,
    /strip\s*club/i,
    /fetish/i,
    /\bbdsm\b/i,
    /orgy/i,
    /swinger/i,
    /bukkake/i,
    /creampie/i,
    /gangbang/i,
    /hot\s*movies?/i,
    /hot\s*videos?/i,
    /hot\s*tv/i,
    /sexy/i,
    /seduction/i,
    /desire/i,
    /passion/i,
    /girls?\s*cam/i
  ];
  return adultPatterns.some((pattern) => pattern.test(lowerName) || pattern.test(lowerCat));
}
function classifyIsPremium(name, category = "", isDuplicate = false) {
  const lowerCat = (category || "").toLowerCase();
  if (lowerCat.includes("adult") || lowerCat.includes("18+") || lowerCat.includes("xxx") || lowerCat.includes("porn")) {
    return true;
  }
  let hash = 0;
  const str = (name || "") + "vip_salt_70";
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 10 < 7;
}
var firestoreQuotaExhausted = false;
async function safeFirestoreWrite(writeFn) {
  if (!db || firestoreQuotaExhausted) return;
  try {
    await writeFn();
  } catch (err) {
    if (err?.message?.includes("RESOURCE_EXHAUSTED") || err?.code === 8 || err?.message?.includes("Quota limit exceeded")) {
      firestoreQuotaExhausted = true;
      db = null;
      console.warn(
        "\u26A0\uFE0F Firestore free tier quota exhausted (RESOURCE_EXHAUSTED). Switching to memory-only storage. App will continue to run normally."
      );
    } else {
      console.warn("Firestore write skipped/error:", err?.message || err);
    }
  }
}
var CHANNELS_CACHE_FILE = process.env.VERCEL ? path.join("/tmp", "channels_cache.json") : path.join(process.cwd(), "channels_cache.json");
var hasSynced = false;
var syncPromise = null;
async function ensureSynced() {
  if (hasSynced) return;
  if (!syncPromise) {
    syncPromise = syncFromFirestore().catch((err) => {
      console.warn("\u26A0\uFE0F Firestore sync failed, using in-memory store:", err?.message || err);
    }).finally(() => {
      hasSynced = true;
    });
  }
  return syncPromise;
}
app.use(async (req, res, next) => {
  try {
    await ensureSynced();
  } catch (e) {
    console.warn("ensureSynced error in middleware:", e);
  }
  next();
});
async function syncFromFirestore() {
  let loadedChannels = [];
  if (fs.existsSync(CHANNELS_CACHE_FILE)) {
    try {
      const cachedData = fs.readFileSync(CHANNELS_CACHE_FILE, "utf8");
      const parsed = JSON.parse(cachedData);
      if (Array.isArray(parsed) && parsed.length > 0) {
        loadedChannels = parsed.map((c) => ({
          ...c,
          isPremium: classifyIsPremium(c.name, c.category)
        }));
      }
    } catch (e) {
      console.error("Error reading channels disk cache:", e);
    }
  }
  if (loadedChannels.length === 0) {
    if (channelsStore && channelsStore.length > 0) {
      loadedChannels = channelsStore;
    } else {
      loadedChannels = (INITIAL_CHANNELS || []).map((c) => ({
        ...c,
        isPremium: classifyIsPremium(c.name, c.category)
      }));
    }
  }
  channelsStore = loadedChannels.map((c) => ({
    ...c,
    isPremium: classifyIsPremium(c.name, c.category)
  }));
  console.log(`Initialized ${channelsStore.length} channels.`);
  try {
    fs.writeFileSync(CHANNELS_CACHE_FILE, JSON.stringify(channelsStore));
  } catch (e) {
  }
  const isFakeVodList = channelsStore.some(
    (c) => (c?.name || "").toLowerCase().includes("xxx vod") || (c?.streamUrl || "").toLowerCase().includes("mycamtv") || (c?.streamUrl || "").toLowerCase().includes("redtraffic")
  );
  if (isFakeVodList) {
    channelsStore = channelsStore.filter(
      (c) => !(c?.name || "").toLowerCase().includes("xxx vod") && !(c?.streamUrl || "").toLowerCase().includes("mycamtv") && !(c?.streamUrl || "").toLowerCase().includes("redtraffic")
    );
    try {
      fs.writeFileSync(CHANNELS_CACHE_FILE, JSON.stringify(channelsStore));
    } catch (e) {
    }
  }
  if (!db || firestoreQuotaExhausted) return;
  try {
    let usersSnap;
    try {
      usersSnap = await getDocs(collection(db, "users"));
    } catch (err) {
      if (err?.message?.includes("RESOURCE_EXHAUSTED") || err?.code === 8 || err?.message?.includes("Quota limit exceeded")) {
        firestoreQuotaExhausted = true;
        db = null;
        console.warn("\u26A0\uFE0F Firestore quota exhausted during read. Switching to memory-only mode.");
        return;
      }
      console.error("Firestore Error (Users):", err.message);
    }
    if (usersSnap && !usersSnap.empty) {
      usersStore = usersSnap.docs.map((d) => d.data());
      console.log(`Loaded ${usersStore.length} users from Firestore DB`);
    } else {
      for (const u of usersStore) {
        await safeFirestoreWrite(async () => {
          if (db) await setDoc(doc(db, "users", u.id), u);
        });
      }
      console.log("Seeded initial users to Firestore DB");
    }
    try {
      let paymentsSnap = await getDocs(collection(db, "payments"));
      if (paymentsSnap && !paymentsSnap.empty) {
        const loadedPayments = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        paymentsStore = loadedPayments;
        console.log(`Loaded ${paymentsStore.length} payments from Firestore DB`);
      } else {
        for (const p of paymentsStore) {
          await safeFirestoreWrite(async () => {
            if (db) await setDoc(doc(db, "payments", p.id), p);
          });
        }
        console.log("Seeded initial sample payments to Firestore DB");
      }
    } catch (err) {
      console.warn("Firestore Error (Payments):", err?.message || err);
    }
    const adminEmail = (process.env.ADMIN_EMAIL || "anondoray553@gmail.com").toLowerCase();
    const hasAdmin = usersStore.some(
      (u) => u.role === "admin" || (u?.username || "").toLowerCase() === "admin" || (u?.email || "").toLowerCase() === "admin@myiptv.com" || (u?.email || "").toLowerCase() === adminEmail || (u?.email || "").toLowerCase() === "ajoysarker553@gmail.com"
    );
    if (!hasAdmin) {
      const defaultAdmin = {
        id: "user-admin",
        username: "admin",
        email: adminEmail,
        role: "admin",
        subscriptionPlan: "365 Days",
        subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3).toISOString(),
        favorites: [],
        recentlyWatched: [],
        password: process.env.ADMIN_PASSWORD || "password"
      };
      usersStore.push(defaultAdmin);
      await persistUser(defaultAdmin);
    } else {
      usersStore.forEach((u) => {
        if ((u?.username || "").toLowerCase() === "admin" || (u?.email || "").toLowerCase() === "admin@myiptv.com" || (u?.email || "").toLowerCase() === adminEmail || (u?.email || "").toLowerCase() === "ajoysarker553@gmail.com") {
          u.role = "admin";
        }
      });
    }
    const isFakeVodListSecond = channelsStore.some(
      (c) => (c?.name || "").toLowerCase().includes("xxx vod") || (c?.streamUrl || "").toLowerCase().includes("mycamtv") || (c?.streamUrl || "").toLowerCase().includes("redtraffic")
    );
    if (isFakeVodListSecond) {
      channelsStore = channelsStore.filter(
        (c) => !(c?.name || "").toLowerCase().includes("xxx vod") && !(c?.streamUrl || "").toLowerCase().includes("mycamtv") && !(c?.streamUrl || "").toLowerCase().includes("redtraffic")
      );
      try {
        fs.writeFileSync(CHANNELS_CACHE_FILE, JSON.stringify(channelsStore));
      } catch (e) {
      }
    }
    let playlistDoc;
    try {
      if (db) playlistDoc = await getDoc(doc(db, "settings", "playlistSource"));
    } catch (err) {
      if (err?.message?.includes("RESOURCE_EXHAUSTED") || err?.code === 8) {
        firestoreQuotaExhausted = true;
        db = null;
      }
    }
    if (playlistDoc && playlistDoc.exists()) {
      playlistSourceStore = playlistDoc.data();
      console.log("Loaded playlist source settings from Firestore DB:", playlistSourceStore.type);
    }
    if (playlistSourceStore.type === "cleared") {
      channelsStore = [];
      if (fs.existsSync(CHANNELS_CACHE_FILE)) {
        try {
          fs.unlinkSync(CHANNELS_CACHE_FILE);
        } catch (e) {
        }
      }
      return;
    }
    if (db && !firestoreQuotaExhausted) {
      try {
        const chunksSnap = await getDocs(collection(db, "channel_chunks"));
        if (chunksSnap && !chunksSnap.empty) {
          const loadedChunks = [];
          chunksSnap.docs.forEach((d) => {
            const data = d.data();
            if (data && Array.isArray(data.channels)) {
              loadedChunks.push({
                chunkIndex: data.chunkIndex ?? 0,
                channels: data.channels
              });
            }
          });
          loadedChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
          const fsChannels = loadedChunks.flatMap((c) => c.channels);
          if (fsChannels.length > 0) {
            channelsStore = fsChannels.map((c) => ({
              ...c,
              isPremium: classifyIsPremium(c.name, c.category)
            }));
            console.log(`Loaded ${channelsStore.length} total channels from Firestore channel_chunks`);
            try {
              fs.writeFileSync(CHANNELS_CACHE_FILE, JSON.stringify(channelsStore));
            } catch (e) {
            }
          }
        } else {
          let channelsDoc = await getDoc(doc(db, "settings", "channelsList"));
          if (channelsDoc && channelsDoc.exists()) {
            const data = channelsDoc.data();
            if (data && Array.isArray(data.channels) && data.channels.length > 0) {
              const fsChannels = data.channels;
              channelsStore = fsChannels.map((c) => ({
                ...c,
                isPremium: classifyIsPremium(c.name, c.category)
              }));
              console.log(`Loaded ${channelsStore.length} total channels from Firestore settings/channelsList`);
              try {
                fs.writeFileSync(CHANNELS_CACHE_FILE, JSON.stringify(channelsStore));
              } catch (e) {
              }
            }
          }
        }
      } catch (err) {
        if (err?.message?.includes("RESOURCE_EXHAUSTED") || err?.code === 8) {
          firestoreQuotaExhausted = true;
          db = null;
        }
        console.warn("Error loading channels from Firestore channel_chunks:", err?.message || err);
      }
    }
    if (channelsStore.length > 0 && channelsStore[0].channelNumber >= 101) {
      channelsStore.forEach((c, idx) => {
        c.channelNumber = idx;
      });
      console.log("Re-indexed existing channels to start from 0.");
      try {
        fs.writeFileSync(CHANNELS_CACHE_FILE, JSON.stringify(channelsStore));
      } catch (e) {
      }
    }
  } catch (err) {
    if (err?.message?.includes("RESOURCE_EXHAUSTED") || err?.code === 8) {
      firestoreQuotaExhausted = true;
      db = null;
    }
    console.error("Error syncing data from Firestore:", err?.message || err);
  }
}
async function persistUser(user) {
  await safeFirestoreWrite(async () => {
    if (db) await setDoc(doc(db, "users", user.id), user);
  });
}
async function deleteUserDoc(userId) {
  await safeFirestoreWrite(async () => {
    if (db) await deleteDoc(doc(db, "users", userId));
  });
}
async function persistChannels(channels) {
  try {
    channels.forEach((ch) => {
      ch.isPremium = classifyIsPremium(ch.name, ch.category);
    });
    fs.writeFileSync(CHANNELS_CACHE_FILE, JSON.stringify(channels));
    console.log(`Successfully persisted and classified ${channels.length} channels to local disk cache.`);
  } catch (err) {
    console.error("Failed to write channels disk cache:", err);
  }
  await safeFirestoreWrite(async () => {
    if (!db) return;
    const chunksColl = collection(db, "channel_chunks");
    const existingSnap = await getDocs(chunksColl);
    const batch = writeBatch(db);
    existingSnap.docs.forEach((doc2) => {
      batch.delete(doc2.ref);
    });
    try {
      batch.delete(doc(db, "settings", "channelsList"));
    } catch (e) {
    }
    await batch.commit();
    const chunkSize = 100;
    const totalChunks = Math.ceil(channels.length / chunkSize);
    for (let i = 0; i < totalChunks; i++) {
      const start2 = i * chunkSize;
      const end = start2 + chunkSize;
      const chunkChannels = channels.slice(start2, end);
      await setDoc(doc(db, "channel_chunks", `chunk_${i}`), {
        chunkIndex: i,
        channels: chunkChannels,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    console.log(`Successfully persisted channel metadata (${channels.length} channels in ${totalChunks} chunks) to Firestore.`);
  });
}
async function persistPlaylistSource(source) {
  await safeFirestoreWrite(async () => {
    if (db) await setDoc(doc(db, "settings", "playlistSource"), source);
  });
}
async function deleteChannelDoc(channelId) {
}
var generateToken = (user) => {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    plan: user.subscriptionPlan
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
};
var verifyToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.split(" ")[1];
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
    const found = usersStore.find(
      (u) => u.id === decoded.id || decoded.username && (u?.username || "").toLowerCase() === String(decoded.username).toLowerCase() || decoded.email && (u?.email || "").toLowerCase() === String(decoded.email).toLowerCase()
    );
    if (found) {
      if (found.role !== "admin" && found.subscriptionExpiresAt && new Date(found.subscriptionExpiresAt).getTime() <= Date.now()) {
        found.subscriptionPlan = "Expired";
        found.subscriptionStatus = "expired";
        found.isApprovedByAdmin = false;
        persistUser(found);
      }
      return found;
    }
    if (decoded && decoded.role === "admin") {
      return usersStore.find((u) => u.role === "admin") || {
        id: "user-admin",
        username: "admin",
        email: "admin@myiptv.com",
        role: "admin",
        subscriptionPlan: "365 Days",
        subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3).toISOString(),
        favorites: [],
        recentlyWatched: []
      };
    }
    return null;
  } catch {
    return null;
  }
};
var ensureAdminUser = (authHeader) => {
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
    subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3).toISOString(),
    favorites: [],
    recentlyWatched: []
  };
};
var hasActiveSubscription = (user) => {
  console.log(`Checking subscription for ${user.username}, role: ${user.role}, isApprovedByAdmin: ${user.isApprovedByAdmin}`);
  if (user.role === "admin") return true;
  if (!user.isApprovedByAdmin) {
    console.log(`User ${user.username} is NOT approved by admin.`);
    return false;
  }
  if (user.subscriptionPlan === "Free" || user.subscriptionPlan === "Expired") {
    console.log(`User ${user.username} has invalid plan: ${user.subscriptionPlan}`);
    return false;
  }
  if (!user.subscriptionExpiresAt) {
    console.log(`User ${user.username} has no expiry date.`);
    return false;
  }
  const active = new Date(user.subscriptionExpiresAt).getTime() > Date.now();
  if (!active) {
    user.subscriptionPlan = "Expired";
    user.subscriptionStatus = "expired";
    user.isApprovedByAdmin = false;
    persistUser(user);
  }
  console.log(`User ${user.username} active status: ${active}`);
  return active;
};
function parseM3U(content, baseUrl, forceFree = false) {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  const parsedChannels = [];
  const categoriesSet = /* @__PURE__ */ new Set();
  const seenNames = /* @__PURE__ */ new Set();
  const seenUrls = /* @__PURE__ */ new Set();
  let currentChannel = null;
  let autoNumber = 0;
  let customUserAgent = "";
  let customReferer = "";
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line || line.startsWith("#EXTM3U")) continue;
    if (line.startsWith("#EXTINF:")) {
      currentChannel = { isActive: true };
      let infContent = line.substring(8);
      const logoMatch = /(?:tvg-logo|logo|icon)=["']?([^"'\s>]+)["']?/i.exec(infContent);
      if (logoMatch) currentChannel.logo = logoMatch[1];
      const groupMatch = /(?:group-title|group)=["']?([^"']+)["']?/i.exec(infContent);
      let cat = groupMatch && groupMatch[1].trim() || "General";
      currentChannel.category = cat;
      categoriesSet.add(cat);
      const tvgIdMatch = /tvg-id=["']?([^"']+)["']?/i.exec(infContent);
      if (tvgIdMatch) currentChannel.tvgId = tvgIdMatch[1];
      let inDoubleQuotes = false;
      let inSingleQuotes = false;
      let commaIdx = -1;
      for (let j = 0; j < infContent.length; j++) {
        const char = infContent[j];
        if (char === '"' && !inSingleQuotes) inDoubleQuotes = !inDoubleQuotes;
        else if (char === "'" && !inDoubleQuotes) inSingleQuotes = !inSingleQuotes;
        else if (char === "," && !inDoubleQuotes && !inSingleQuotes) {
          commaIdx = j;
          break;
        }
      }
      if (commaIdx !== -1) {
        let nameAndUrl = infContent.substring(commaIdx + 1).trim();
        const urlMatch = /(https?:\/\/[^\s]+|rtmp:\/\/[^\s]+|rtsp:\/\/[^\s]+)/i.exec(nameAndUrl);
        if (urlMatch) {
          currentChannel.streamUrl = urlMatch[1];
          currentChannel.name = nameAndUrl.replace(urlMatch[1], "").trim() || `Channel ${autoNumber + 1}`;
        } else {
          currentChannel.name = nameAndUrl || `Channel ${autoNumber + 1}`;
        }
      } else {
        currentChannel.name = `Channel ${autoNumber + 1}`;
      }
      if (currentChannel.streamUrl) {
        processAndPushChannel(currentChannel);
        currentChannel = null;
        customUserAgent = "";
        customReferer = "";
      }
    } else if (line.startsWith("#EXTVLCOPT:")) {
      if (line.toLowerCase().includes("http-user-agent=")) {
        customUserAgent = line.split("=")[1]?.trim() || "";
      } else if (line.toLowerCase().includes("http-referrer=")) {
        customReferer = line.split("=")[1]?.trim() || "";
      }
    } else if (line.startsWith("#EXTGRP:")) {
      const cat = line.substring(8).trim() || "General";
      if (currentChannel) {
        currentChannel.category = cat;
        categoriesSet.add(cat);
      }
    } else if (!line.startsWith("#")) {
      let streamUrl = line;
      if (!streamUrl.includes("://") && baseUrl) {
        try {
          streamUrl = new URL(streamUrl, baseUrl).href;
        } catch (e) {
        }
      }
      if (/^[a-z0-9]+:\/\//i.test(streamUrl) || streamUrl.startsWith("http") || streamUrl.startsWith("//") || /\.(m3u8|m3u|ts|mp4|mkv|flv|avi|mov|wmv|webm|m4v|3gp|mp3|aac|m4a|ogg|mpd)(\?.*)?$/i.test(streamUrl) || /\/live\/|\/play\/|\/stream\/|\/get\.php/i.test(streamUrl) || streamUrl.length > 5) {
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
            category: "General",
            isActive: true
          };
          categoriesSet.add("General");
        }
        currentChannel.streamUrl = streamUrl;
        processAndPushChannel(currentChannel);
        currentChannel = null;
        customUserAgent = "";
        customReferer = "";
      }
    }
  }
  if (parsedChannels.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("http://") || line.startsWith("https://")) {
        autoNumber++;
        let name = `Channel ${autoNumber}`;
        try {
          const urlObj = new URL(line);
          const pathSegments = urlObj.pathname.split("/").filter(Boolean);
          if (pathSegments.length > 0) {
            const seg = pathSegments[pathSegments.length - 1];
            name = seg.replace(/\.(m3u8|ts|mp4|mkv)$/i, "").replace(/[-_]/g, " ");
          }
        } catch (e) {
        }
        parsedChannels.push({
          id: `m3u-fb-${autoNumber}-${Math.random().toString(36).substring(2, 7)}`,
          channelNumber: parsedChannels.length,
          name: name.charAt(0).toUpperCase() + name.slice(1),
          category: "General",
          streamUrl: line,
          logo: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=200&auto=format&fit=crop&q=80",
          isActive: true,
          isPremium: false
        });
        categoriesSet.add("General");
      }
    }
  }
  function processAndPushChannel(ch) {
    const chName = ch.name || `Channel ${autoNumber + 1}`;
    let category = ch.category || "General";
    const streamUrl = ch.streamUrl || "";
    if (!streamUrl) return;
    const lowerName = chName.toLowerCase();
    const cleanUrl = streamUrl.split("|")[0].toLowerCase();
    const isVodUrl = cleanUrl.match(/\.(mp4|mkv|avi|mov|webm)$/i) || cleanUrl.includes("/movie/") || cleanUrl.includes("/vod/") || cleanUrl.includes("/series/");
    if (isVodUrl && !category.toLowerCase().match(/(vod|movie|film|cinema|series|season|episode)/)) {
      category += " (VOD)";
      ch.category = category;
    }
    if (isAdultContent(chName, category)) {
      ch.category = "Adult (18+)";
      category = "Adult (18+)";
      categoriesSet.add("Adult (18+)");
    }
    const isDuplicate = seenNames.has(lowerName) || seenUrls.has(cleanUrl);
    seenNames.add(lowerName);
    seenUrls.add(cleanUrl);
    ch.isPremium = forceFree ? false : classifyIsPremium(chName, ch.category || category, isDuplicate);
    if (!ch.logo) {
      ch.logo = "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=200&auto=format&fit=crop&q=80";
    }
    ch.channelNumber = autoNumber++;
    ch.id = `m3u-${autoNumber}-${Buffer.from(streamUrl).toString("base64").slice(-10).replace(/[/+=]/g, "")}`;
    ch.isActive = true;
    parsedChannels.push(ch);
  }
  return {
    totalChannels: parsedChannels.length,
    channels: parsedChannels,
    categories: Array.from(categoriesSet)
  };
}
app.use("/api", (req, res, next) => {
  console.log(`API request received: ${req.method} ${req.path}`);
  next();
});
app.post("/api/auth/login", async (req, res) => {
  console.log("Login attempt for:", req.body.email);
  const { email, password } = req.body;
  const inputStr = (email || "").toLowerCase().trim();
  if (!inputStr) {
    return res.status(400).json({ error: "Username or email is required" });
  }
  const adminEmail = (process.env.ADMIN_EMAIL || "anondoray553@gmail.com").toLowerCase();
  let user = usersStore.find(
    (u) => (u?.email || "").toLowerCase() === inputStr || (u?.username || "").toLowerCase() === inputStr
  );
  const isAdminAttempt = inputStr === "admin" || inputStr === "admin@myiptv.com" || inputStr === adminEmail || inputStr === "ajoysarker553@gmail.com";
  if (!user && isAdminAttempt) {
    user = {
      id: "user-admin-" + Date.now(),
      username: inputStr === "admin" ? "admin" : inputStr.split("@")[0],
      email: inputStr.includes("@") ? inputStr : "admin@myiptv.com",
      role: "admin",
      subscriptionPlan: "365 Days",
      subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3).toISOString(),
      favorites: [],
      recentlyWatched: [],
      password: password || process.env.ADMIN_PASSWORD || "password"
    };
    usersStore.push(user);
    await persistUser(user);
  }
  if (!user) {
    console.log("User not found:", inputStr);
    return res.status(401).json({
      error: "User account not found. Please register or enter valid credentials."
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
      user.password
    ].filter(Boolean));
    if (!password || !allowedAdminPasswords.has(password)) {
      console.log("Admin password mismatch for:", inputStr);
      return res.status(401).json({ error: "Incorrect Administrator Password. Try 'password' or 'admin123'." });
    }
  } else {
    const userPassword = user.password || "password";
    if (userPassword !== password) {
      console.log("User password mismatch for:", inputStr);
      return res.status(401).json({ error: "Incorrect Password. Access Denied." });
    }
  }
  const token = generateToken(user);
  console.log("Login successful for:", inputStr);
  return res.json({
    token,
    user
  });
});
app.post("/api/auth/register", async (req, res) => {
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
  const exists = usersStore.find(
    (u) => (u?.email || "").toLowerCase() === emailClean || (u?.username || "").toLowerCase() === usernameClean.toLowerCase()
  );
  if (exists) {
    return res.status(400).json({ error: "Username or Email is already registered" });
  }
  const adminEmail = (process.env.ADMIN_EMAIL || "anondoray553@gmail.com").toLowerCase();
  const isAdmin = emailClean === adminEmail || emailClean === "admin@myiptv.com" || emailClean === "ajoysarker553@gmail.com" || usernameClean.toLowerCase() === "admin";
  const role = isAdmin ? "admin" : "user";
  const newUser = {
    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    username: usernameClean,
    email: emailClean,
    role,
    subscriptionPlan: isAdmin ? "365 Days" : "Free",
    subscriptionExpiresAt: isAdmin ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3).toISOString() : null,
    favorites: [],
    recentlyWatched: [],
    password: passwordClean,
    isApprovedByAdmin: isAdmin
  };
  usersStore.push(newUser);
  await persistUser(newUser);
  const token = generateToken(newUser);
  return res.json({
    token,
    user: newUser,
    message: "Registration successful!"
  });
});
app.get("/api/auth/me", (req, res) => {
  const user = verifyToken(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return res.json({ user });
});
var handleSubscriptionUpdate = async (req, res) => {
  const user = verifyToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const { plan, transactionId, senderNumber, paymentMethod, amount } = req.body;
  user.subscriptionPlan = plan;
  user.isApprovedByAdmin = false;
  user.subscriptionExpiresAt = null;
  await persistUser(user);
  const paymentRecord = {
    id: transactionId || `trx_${Date.now()}`,
    userId: user.id,
    userName: user.email || user.username || "User",
    amount: amount || (plan.includes("100") ? "\u09F3100" : plan.includes("45") ? "\u09F345" : "\u09F310"),
    plan,
    transactionId: transactionId || `trx_${Date.now()}`,
    senderNumber: senderNumber || "01700000000",
    paymentMethod: paymentMethod || "bKash",
    status: "Pending",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  paymentsStore.unshift(paymentRecord);
  try {
    if (db) {
      const paymentRef = doc(db, "payments", paymentRecord.id);
      await setDoc(paymentRef, paymentRecord);
    }
  } catch (err) {
    console.error("Failed to save payment record to Firestore:", err);
  }
  return res.json({ message: "Subscription request submitted to admin for approval", user });
};
app.put("/api/auth/subscription", handleSubscriptionUpdate);
app.post("/api/auth/subscription", handleSubscriptionUpdate);
var deletedPaymentIds = /* @__PURE__ */ new Set();
app.get("/api/admin/payments", async (req, res) => {
  let list = [];
  try {
    if (db) {
      const deletedSnap = await getDocs(collection(db, "deleted_payments"));
      if (deletedSnap && !deletedSnap.empty) {
        deletedSnap.docs.forEach((d) => {
          deletedPaymentIds.add(d.id);
        });
      }
    }
  } catch (err) {
    console.warn("Firestore deleted_payments fetch error:", err);
  }
  try {
    if (db) {
      const snap = await getDocs(collection(db, "payments"));
      if (snap && !snap.empty) {
        list = snap.docs.map((doc2) => ({ id: doc2.id, ...doc2.data() }));
      }
    }
  } catch (err) {
    console.error("Firestore payment fetch error:", err);
  }
  for (const p of paymentsStore) {
    const existing = list.find((existing2) => existing2.id === p.id || existing2.id === `req_${p.userId}` || p.transactionId && existing2.transactionId === p.transactionId || p.userId && existing2.userId === p.userId);
    if (existing) {
      if (p.status) existing.status = p.status;
    } else if (!deletedPaymentIds.has(p.id) && !deletedPaymentIds.has(`req_${p.userId}`)) {
      list.push(p);
    }
  }
  usersStore.forEach((u) => {
    if (u.role !== "admin") {
      const reqId = `req_${u.id}`;
      const isDeleted = deletedPaymentIds.has(reqId) || deletedPaymentIds.has(u.id) || u.email && deletedPaymentIds.has(u.email) || u.username && deletedPaymentIds.has(u.username);
      if (!isDeleted) {
        const existing = list.find((item) => item.userId === u.id || item.userName === u.email || item.userName === u.username || item.id === reqId || item.id === u.id);
        if (existing) {
          if (u.paymentStatus) {
            existing.status = u.paymentStatus;
          } else if (u.isApprovedByAdmin) {
            existing.status = "Success";
          }
        } else {
          list.push({
            id: reqId,
            userId: u.id,
            userName: u.email || u.username,
            amount: u.subscriptionPlan?.includes("100") ? "\u09F3100" : u.subscriptionPlan?.includes("45") ? "\u09F345" : u.subscriptionPlan?.includes("10") ? "\u09F310" : "\u09F3100",
            plan: u.subscriptionPlan || "1 Month Premium (\u09F3100)",
            transactionId: `TRX_${(u.username || "USER").toUpperCase()}`,
            senderNumber: "01712345678",
            paymentMethod: "bKash",
            status: u.paymentStatus || (u.isApprovedByAdmin ? "Success" : u.subscriptionPlan === "Expired" ? "Rejected" : "Pending"),
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      }
    }
  });
  list = list.filter((item) => {
    if (deletedPaymentIds.has(item.id)) return false;
    if (item.userId && (deletedPaymentIds.has(item.userId) || deletedPaymentIds.has(`req_${item.userId}`))) return false;
    if (item.userName && deletedPaymentIds.has(item.userName)) return false;
    if (item.transactionId && deletedPaymentIds.has(item.transactionId)) return false;
    return true;
  });
  const deduplicated = [];
  list.forEach((item) => {
    const key = item.userId || item.userName || item.id;
    const existingIndex = deduplicated.findIndex((d) => d.userId && d.userId === item.userId || d.userName && d.userName === item.userName || d.id === item.id || d.id === `req_${item.userId}`);
    if (existingIndex === -1) {
      deduplicated.push({ ...item });
    } else {
      const current = deduplicated[existingIndex];
      if (item.status === "Rejected" || item.status === "Success") {
        current.status = item.status;
      }
      if (item.plan) current.plan = item.plan;
      if (item.senderNumber && item.senderNumber !== "01712345678") current.senderNumber = item.senderNumber;
      if (item.transactionId) current.transactionId = item.transactionId;
    }
  });
  deduplicated.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  return res.json(deduplicated);
});
app.post("/api/admin/payments/sample", async (req, res) => {
  const samplePayments = [
    {
      id: `trx_BK${Math.floor(1e5 + Math.random() * 9e5)}`,
      userId: "user-free",
      userName: "user@myiptv.com",
      amount: "\u09F3100",
      plan: "1 Month Premium (\u09F3100)",
      transactionId: `BK${Math.floor(1e5 + Math.random() * 9e5)}`,
      senderNumber: "01712345678",
      paymentMethod: "bKash",
      status: "Pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: `trx_NG${Math.floor(1e5 + Math.random() * 9e5)}`,
      userId: "user-expired",
      userName: "expired@myiptv.com",
      amount: "\u09F345",
      plan: "1 Month Standard (\u09F345)",
      transactionId: `NG${Math.floor(1e5 + Math.random() * 9e5)}`,
      senderNumber: "01898765432",
      paymentMethod: "Nagad",
      status: "Pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  ];
  for (const sample of samplePayments) {
    paymentsStore.unshift(sample);
    if (db) {
      try {
        await setDoc(doc(db, "payments", sample.id), sample);
      } catch (e) {
      }
    }
  }
  return res.json({ message: "Sample payments added", payments: paymentsStore });
});
app.get("/api/channels", (req, res) => {
  console.log("API request: /api/channels called");
  const category = req.query.category;
  const search = req.query.search;
  const user = verifyToken(req.headers.authorization);
  const hasAdult = user?.role === "admin" || Boolean(user?.hasAdultAccess);
  if (category && category.toLowerCase() === "adult (18+)" && !hasAdult) {
    return res.status(403).json({ error: "Adult content restricted. Admin permission required." });
  }
  let result = channelsStore.filter((c) => c.isActive);
  if (!hasAdult) {
    result = result.filter((c) => !isAdultContent(c.name, c.category) && c.category.toLowerCase() !== "adult (18+)");
  }
  console.log(`API /api/channels found ${result.length} active channels (hasAdult: ${hasAdult})`);
  if (category && category !== "All" && category !== "Favorites" && category !== "Recently Watched") {
    result = result.filter(
      (c) => c.category.toLowerCase() === category.toLowerCase()
    );
  }
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(
      (c) => c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q) || c.channelNumber.toString().includes(q)
    );
  }
  result.sort((a, b) => a.channelNumber - b.channelNumber);
  return res.json(result);
});
app.get("/api/categories", (req, res) => {
  console.log(
    "API Request: /api/categories called. channelsStore length:",
    channelsStore.length
  );
  try {
    const user = verifyToken(req.headers.authorization);
    const hasAdult = user?.role === "admin" || Boolean(user?.hasAdultAccess);
    let validChannels = channelsStore;
    if (!hasAdult) {
      validChannels = channelsStore.filter((c) => !isAdultContent(c.name, c.category) && c.category.toLowerCase() !== "adult (18+)");
    }
    const existingCats = Array.from(
      new Set(validChannels.map((c) => c.category).filter(Boolean))
    );
    if (hasAdult) {
      const hasAdultChannels = channelsStore.some((c) => isAdultContent(c.name, c.category) || c.category.toLowerCase() === "adult (18+)");
      if (hasAdultChannels && !existingCats.includes("Adult (18+)")) {
        existingCats.push("Adult (18+)");
      }
    }
    existingCats.sort((a, b) => a.localeCompare(b));
    return res.json(existingCats);
  } catch (e) {
    console.error("Error in /api/categories:", e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
app.get("/api/stream/:channelId", (req, res) => {
  const { channelId } = req.params;
  const channel = channelsStore.find((c) => c.id === channelId);
  if (!channel || !channel.isActive) {
    return res.status(404).json({ error: "Channel not found or inactive" });
  }
  if (isAdultContent(channel.name, channel.category)) {
    const user = verifyToken(req.headers.authorization);
    const hasAdult = user?.role === "admin" || Boolean(user?.hasAdultAccess);
    if (!hasAdult) {
      return res.status(403).json({ error: "Adult content restricted. Admin permission required." });
    }
  }
  if (channel.isPremium) {
    const user = verifyToken(req.headers.authorization);
    console.log(`Checking premium channel ${channel.name} for user: ${user?.username}`);
    if (!user) {
      return res.status(403).json({
        error: "This is a Premium Channel. Please login to continue.",
        isPremiumLocked: true
      });
    }
    if (!hasActiveSubscription(user)) {
      console.log(`User ${user.username} does NOT have active subscription.`);
      return res.status(403).json({
        error: "Your subscription has expired or is invalid. Please renew now to watch Premium channels.",
        isSubscriptionExpired: true
      });
    }
    console.log(`User ${user.username} has active subscription.`);
  }
  return res.json({
    channelId: channel.id,
    name: channel.name,
    category: channel.category,
    channelNumber: channel.channelNumber,
    streamUrl: channel.streamUrl,
    // Returned safely to player client
    isPremium: channel.isPremium
  });
});
var proxyCookieJar = /* @__PURE__ */ new Map();
app.options(["/api/proxy", "/api/proxy-stream"], (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Max-Age", "86400");
  return res.status(204).end();
});
app.head(["/api/proxy", "/api/proxy-stream"], (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
  return res.status(200).end();
});
app.get(["/api/proxy", "/api/proxy-stream"], (req, res) => {
  let targetUrl = req.query.url || "";
  const headers = req.query.headers;
  if (!targetUrl) {
    return res.status(400).send("Missing url parameter");
  }
  if (headers && !targetUrl.includes("|")) {
    targetUrl += "|" + headers;
  }
  return proxyStreamRequest(targetUrl, req, res);
});
function proxyStreamRequest(targetUrl, req, res, redirectCount = 0, retryCount = 0) {
  if (req.destroyed || res.destroyed || res.writableEnded) {
    return;
  }
  if (redirectCount > 10) {
    if (!res.headersSent) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.status(502).send("Too many redirects");
    }
    return;
  }
  if (retryCount > 8) {
    if (!res.headersSent) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.status(502).send("Too many connection retries");
    }
    return;
  }
  let activeRetryTimer = null;
  let activeProxyReq = null;
  let activeResponseStream = null;
  let activePassStream = null;
  const cancelRequest = () => {
    if (activeRetryTimer) {
      clearTimeout(activeRetryTimer);
      activeRetryTimer = null;
    }
    if (activePassStream && !activePassStream.destroyed) {
      try {
        activePassStream.destroy();
      } catch (e) {
      }
    }
    if (activeResponseStream && !activeResponseStream.destroyed) {
      try {
        activeResponseStream.destroy();
      } catch (e) {
      }
    }
    if (activeProxyReq && !activeProxyReq.destroyed) {
      try {
        activeProxyReq.destroy();
      } catch (e) {
      }
    }
  };
  req.once("close", cancelRequest);
  res.once("close", cancelRequest);
  try {
    let actualUrl = targetUrl;
    let customHeaderSuffix = "";
    const reqHeaders = {
      "Accept": "*/*",
      "Accept-Encoding": "gzip, deflate, identity",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Connection": "keep-alive"
    };
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
    if (actualUrl.includes("stream.ottplus.bd")) {
      actualUrl = actualUrl.replace("stream.ottplus.bd", "stream.ottplus.live");
      console.log(`[Proxy] Rewrote stream.ottplus.bd to active endpoint stream.ottplus.live`);
    }
    let domainName = "";
    let parsedPort = "";
    try {
      const u = new URL(actualUrl);
      domainName = u.hostname.toLowerCase();
      parsedPort = u.port;
    } catch (e) {
    }
    const isNonStandardPort = parsedPort !== "" && parsedPort !== "443";
    const isKnownNonSsl = isNonStandardPort || knownNonSslDomains.has(domainName) || Array.from(knownNonSslDomains).some((d) => domainName.includes(d) || actualUrl.toLowerCase().includes(d)) || actualUrl.includes("@") || actualUrl.includes(":8080") || actualUrl.includes(":8000") || actualUrl.includes(":8081") || actualUrl.includes(":8087") || actualUrl.includes(":8888") || actualUrl.includes(":80") || actualUrl.includes(":2082") || actualUrl.includes(":2086") || actualUrl.includes(":25461");
    if (actualUrl.startsWith("https://") && isKnownNonSsl) {
      actualUrl = actualUrl.replace("https://", "http://");
      console.log(`[Proxy] Normalized HTTPS to HTTP for non-SSL IPTV endpoint: ${actualUrl}`);
    }
    const parsedUrl = new URL(actualUrl);
    const hostname = parsedUrl.hostname;
    if (parsedUrl.username || parsedUrl.password) {
      const auth = Buffer.from(`${decodeURIComponent(parsedUrl.username)}:${decodeURIComponent(parsedUrl.password)}`).toString("base64");
      reqHeaders["Authorization"] = `Basic ${auth}`;
    }
    if (proxyCookieJar.has(hostname)) {
      reqHeaders["Cookie"] = proxyCookieJar.get(hostname);
    }
    const client = parsedUrl.protocol === "https:" ? https : http;
    delete reqHeaders["Sec-Fetch-Dest"];
    delete reqHeaders["Sec-Fetch-Mode"];
    delete reqHeaders["Sec-Fetch-Site"];
    delete reqHeaders["sec-fetch-dest"];
    delete reqHeaders["sec-fetch-mode"];
    delete reqHeaders["sec-fetch-site"];
    delete reqHeaders["sec-ch-ua"];
    delete reqHeaders["sec-ch-ua-mobile"];
    delete reqHeaders["sec-ch-ua-platform"];
    let hasCustomUA = false;
    let hasCustomReferer = false;
    let hasCustomOrigin = false;
    for (const key of Object.keys(reqHeaders)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === "user-agent") {
        hasCustomUA = true;
        if (key !== "User-Agent") {
          reqHeaders["User-Agent"] = reqHeaders[key];
          delete reqHeaders[key];
        }
      } else if (lowerKey === "referer") {
        hasCustomReferer = true;
        if (key !== "Referer") {
          reqHeaders["Referer"] = reqHeaders[key];
          delete reqHeaders[key];
        }
      } else if (lowerKey === "origin") {
        hasCustomOrigin = true;
        if (key !== "Origin") {
          reqHeaders["Origin"] = reqHeaders[key];
          delete reqHeaders[key];
        }
      }
    }
    if (!hasCustomUA) {
      const isMajorCdn = hostname.includes("amagi") || hostname.includes("akamaized") || hostname.includes("cloudfront") || hostname.includes("doubleclick") || hostname.includes("google") || hostname.includes("fastly") || hostname.includes("armelin") || hostname.includes("r2.dev") || hostname.includes("streamhoster") || hostname.includes("youtube") || hostname.includes("cgtn");
      if (isMajorCdn) {
        reqHeaders["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
      } else {
        reqHeaders["User-Agent"] = "IPTVSmarters/3.1.5 (Android/11)";
      }
    }
    reqHeaders["Accept"] = "*/*";
    if (!hasCustomReferer) {
      delete reqHeaders["Referer"];
      delete reqHeaders["referer"];
    }
    if (!hasCustomOrigin) {
      delete reqHeaders["Origin"];
      delete reqHeaders["origin"];
    }
    if (req.headers.range) reqHeaders["Range"] = req.headers.range;
    reqHeaders["Host"] = parsedUrl.host;
    reqHeaders["Connection"] = "keep-alive";
    const options = {
      headers: reqHeaders,
      rejectUnauthorized: false,
      servername: parsedUrl.hostname,
      ciphers: "DEFAULT:@SECLEVEL=1:ALL",
      timeout: 15e3,
      agent: parsedUrl.protocol === "https:" ? httpsAgent : httpAgent
    };
    const proxyReq = client.get(actualUrl, options, (proxyRes) => {
      if (req.destroyed || res.destroyed || res.writableEnded) {
        proxyRes.destroy();
        return;
      }
      console.log(`[Proxy] Connected to ${actualUrl}, status: ${proxyRes.statusCode}`);
      const setCookie = proxyRes.headers["set-cookie"];
      if (setCookie) {
        const cookies = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;
        proxyCookieJar.set(hostname, cookies);
      }
      if (proxyRes.statusCode && [301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
        proxyRes.destroy();
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
          retryCount
        );
      }
      if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
        proxyRes.destroy();
        if (proxyRes.statusCode === 404 && retryCount < 2 && !req.destroyed && !res.destroyed) {
          console.warn(`[Proxy] Transient 404 for ${targetUrl}, retrying...`);
          activeRetryTimer = setTimeout(() => {
            if (!req.destroyed && !res.destroyed && !res.writableEnded) {
              proxyStreamRequest(targetUrl, req, res, redirectCount, retryCount + 1);
            }
          }, 800);
          return;
        }
        if ((proxyRes.statusCode === 403 || proxyRes.statusCode === 401 || proxyRes.statusCode === 429) && retryCount < 3 && !req.destroyed && !res.destroyed) {
          const alternateUAs = [
            "IPTVSmarters/3.1.5 (Android/11)",
            "VLC/3.0.18 LibVLC/3.0.18",
            "OTT Navigator/1.6.8.2 (Linux; Android 11)",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
          ];
          const newUA = alternateUAs[retryCount] || alternateUAs[0];
          console.warn(`[Proxy] ${proxyRes.statusCode} for ${targetUrl}, retrying with User-Agent: ${newUA}...`);
          activeRetryTimer = setTimeout(() => {
            if (!req.destroyed && !res.destroyed && !res.writableEnded) {
              const cleanUrl = targetUrl.split("|")[0];
              proxyStreamRequest(`${cleanUrl}|User-Agent=${encodeURIComponent(newUA)}`, req, res, redirectCount, retryCount + 1);
            }
          }, 300);
          return;
        }
        if (!res.headersSent) {
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Headers", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
          res.setHeader("Content-Type", "text/plain");
          return res.status(proxyRes.statusCode).send(
            proxyRes.statusCode === 429 ? "Rate Limit Exceeded" : `Stream Server Error: ${proxyRes.statusCode}`
          );
        }
        return;
      }
      const contentType = (proxyRes.headers["content-type"] || "").toLowerCase();
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      let responseStream = proxyRes;
      const encoding = (proxyRes.headers["content-encoding"] || "").toLowerCase();
      if (encoding.includes("gzip")) {
        responseStream = proxyRes.pipe(zlib.createGunzip());
      } else if (encoding.includes("deflate")) {
        responseStream = proxyRes.pipe(zlib.createInflate());
      } else if (encoding.includes("br")) {
        responseStream = proxyRes.pipe(zlib.createBrotliDecompress());
      }
      activeResponseStream = responseStream;
      const isM3U8ContentType = contentType.includes("mpegurl") || contentType.includes("m3u8") || actualUrl.match(/\.m3u8(\?.*)?$/i) !== null;
      const isKnownBinaryMedia = !isM3U8ContentType && (actualUrl.match(/\.(ts|mp4|m4s|m4a|aac|mp3|flv|key|jpg|png|jpeg)(\?.*)?$/i) || actualUrl.includes("/movie/") || actualUrl.includes("/series/") || contentType.includes("video/") || contentType.includes("audio/") || contentType.includes("image/") || contentType.includes("octet-stream"));
      let resolvedContentType = proxyRes.headers["content-type"] || "";
      const isTsFormat = actualUrl.match(/\.ts(\?.*)?$/i) || actualUrl.includes("/ts") || actualUrl.includes(".ts?");
      if (!resolvedContentType || resolvedContentType.includes("text/plain") || resolvedContentType.includes("octet-stream")) {
        if (isTsFormat) {
          resolvedContentType = "video/mp2t";
        } else if (actualUrl.match(/\.(mp4|m4v|m4s)(\?.*)?$/i)) {
          resolvedContentType = "video/mp4";
        } else if (actualUrl.match(/\.m3u8(\?.*)?$/i)) {
          resolvedContentType = "application/vnd.apple.mpegurl";
        } else {
          resolvedContentType = "video/mp2t";
        }
      }
      if (isKnownBinaryMedia) {
        const responseHeaders = {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
          "Content-Type": isTsFormat ? "video/mp2t" : resolvedContentType || "video/mp2t"
        };
        if (proxyRes.headers["content-length"] && !encoding)
          responseHeaders["Content-Length"] = proxyRes.headers["content-length"];
        if (proxyRes.headers["content-range"])
          responseHeaders["Content-Range"] = proxyRes.headers["content-range"];
        if (proxyRes.headers["accept-ranges"])
          responseHeaders["Accept-Ranges"] = proxyRes.headers["accept-ranges"];
        if (!res.headersSent) {
          res.writeHead(proxyRes.statusCode || 200, responseHeaders);
        }
        responseStream.pipe(res).on("error", (err) => {
          if (err.code !== "ERR_STREAM_PREMATURE_CLOSE" && err.code !== "ECONNRESET") {
            console.warn("[Proxy] Direct segment stream pipe warning:", err.message);
          }
        });
        return;
      }
      let firstChunkProcessed = false;
      responseStream.once("data", (chunk) => {
        firstChunkProcessed = true;
        const chunkStr = chunk.toString("utf8");
        const isTsSyncByte = chunk.length > 0 && chunk[0] === 71;
        let hasNullByte = false;
        const checkLen = Math.min(chunk.length, 256);
        for (let j = 0; j < checkLen; j++) {
          if (chunk[j] === 0) {
            hasNullByte = true;
            break;
          }
        }
        const isRealM3U8Text = !isTsSyncByte && !hasNullByte && (chunkStr.startsWith("#EXTM3U") || chunkStr.startsWith("#EXT-X-") || chunkStr.includes("#EXTM3U") || chunkStr.includes("#EXTINF:"));
        if (isRealM3U8Text) {
          let fullData = chunkStr;
          responseStream.setEncoding("utf8");
          responseStream.on("data", (moreData) => {
            fullData += moreData;
          });
          responseStream.on("end", () => {
            if (res.headersSent || res.destroyed || res.writableEnded) return;
            const cleanData = fullData.replace(/^\uFEFF/, "").trim();
            const isM3U8Content = cleanData.startsWith("#EXTM3U") || cleanData.startsWith("#EXT-X-") || cleanData.includes("#EXTM3U") || cleanData.includes("#EXTINF:");
            if (!isM3U8Content && cleanData && !cleanData.startsWith("#")) {
              console.warn(
                `Non-M3U8 text response on stream endpoint: ${cleanData.substring(0, 100)}`
              );
              res.setHeader("Content-Type", "text/plain");
              return res.status(
                cleanData.toLowerCase().includes("rate exceeded") ? 429 : 502
              ).send(cleanData);
            }
            res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
            const lines = fullData.split(/\r?\n/);
            const rewrittenLines = lines.map((line) => {
              const trimmed = line.trim();
              if (!trimmed) return line;
              if (trimmed.includes("/api/proxy?url=") || trimmed.includes("/api/proxy-stream?url=")) return line;
              if (trimmed.startsWith("#")) {
                return line.replace(
                  /URI=(?:"([^"]+)"|'([^']+)'|([^\s,]+))/gi,
                  (_match, q1, q2, q3) => {
                    const rawUri = q1 || q2 || q3;
                    if (!rawUri) return _match;
                    if (rawUri.includes("/api/proxy?url=") || rawUri.includes("/api/proxy-stream?url=")) return _match;
                    try {
                      const absUriObj = new URL(rawUri, actualUrl);
                      const baseUrlObj = new URL(actualUrl);
                      if (!absUriObj.search && baseUrlObj.search) {
                        absUriObj.search = baseUrlObj.search;
                      }
                      let absUri = absUriObj.href;
                      if (customHeaderSuffix) absUri += "|" + customHeaderSuffix;
                      return `URI="/api/proxy?url=${encodeURIComponent(absUri)}"`;
                    } catch (e) {
                      return _match;
                    }
                  }
                );
              }
              try {
                const absUrlObj = new URL(trimmed, actualUrl);
                const baseUrlObj = new URL(actualUrl);
                if (!absUrlObj.search && baseUrlObj.search) {
                  absUrlObj.search = baseUrlObj.search;
                }
                let absUrl = absUrlObj.href;
                if (customHeaderSuffix) absUrl += "|" + customHeaderSuffix;
                return `/api/proxy?url=${encodeURIComponent(absUrl)}`;
              } catch (e) {
                return line;
              }
            });
            res.status(200).send(rewrittenLines.join("\n"));
          });
        } else {
          const responseHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
            "Content-Type": isTsSyncByte || isTsFormat ? "video/mp2t" : resolvedContentType || "video/mp2t"
          };
          if (proxyRes.headers["content-length"] && !encoding)
            responseHeaders["Content-Length"] = proxyRes.headers["content-length"];
          if (proxyRes.headers["content-range"])
            responseHeaders["Content-Range"] = proxyRes.headers["content-range"];
          if (proxyRes.headers["accept-ranges"])
            responseHeaders["Accept-Ranges"] = proxyRes.headers["accept-ranges"];
          const pass = new stream.PassThrough({ highWaterMark: 1024 * 1024 });
          activePassStream = pass;
          if (!res.headersSent) {
            res.writeHead(proxyRes.statusCode || 200, responseHeaders);
          }
          pass.pipe(res);
          pass.write(chunk);
          responseStream.pipe(pass).on("error", (pipeErr) => {
            if (pipeErr.code !== "ERR_STREAM_PREMATURE_CLOSE" && pipeErr.code !== "ECONNRESET") {
              console.warn("Proxy pipe error:", pipeErr.message);
            }
            pass.destroy();
            proxyReq.destroy();
          });
        }
      });
      responseStream.on("end", () => {
        if (!firstChunkProcessed && !res.headersSent && !res.destroyed && !res.writableEnded) {
          res.status(200).send("");
        }
      });
    });
    activeProxyReq = proxyReq;
    proxyReq.setTimeout(15e3, () => {
      console.error(`Stream proxy timeout for ${targetUrl}`);
      proxyReq.destroy();
      if (!res.headersSent && !res.destroyed && !res.writableEnded) {
        res.status(504).send(
          `Stream Connection Timed Out: The source is unresponsive.`
        );
      }
    });
    proxyReq.on("error", (err) => {
      if (req.destroyed || res.destroyed || res.writableEnded) {
        return;
      }
      console.warn(`[Proxy] Stream warning for ${actualUrl}:`, err.message);
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
        "ABORTED"
      ];
      const isSocketOrTlsError = err.message && (err.message.includes("socket hang up") || err.message.includes("socket disconnected") || err.message.includes("TLS") || err.message.includes("handshake") || err.message.includes("connection reset"));
      const isRetryable = retryCodes.includes(err.code) || isSocketOrTlsError;
      const maxRetries = 3;
      if (isRetryable && retryCount < maxRetries && !res.headersSent) {
        let nextTargetUrl = targetUrl;
        if (actualUrl.startsWith("https://") && (isSocketOrTlsError || err.code === "EPROTO" || err.code === "ECONNRESET" || err.code === "ECONNREFUSED")) {
          try {
            const failedHost = new URL(actualUrl).hostname.toLowerCase();
            knownNonSslDomains.add(failedHost);
          } catch (e) {
          }
          nextTargetUrl = actualUrl.replace("https://", "http://");
          return proxyStreamRequest(nextTargetUrl, req, res, redirectCount, retryCount);
        }
        const isDnsError = err.code === "EAI_AGAIN" || err.code === "ENOTFOUND";
        const baseDelay = isDnsError ? 400 : 150;
        const backoff = Math.min(baseDelay * Math.pow(1.5, retryCount), 1500);
        activeRetryTimer = setTimeout(() => {
          if (!req.destroyed && !res.destroyed && !res.writableEnded) {
            proxyStreamRequest(nextTargetUrl, req, res, redirectCount, retryCount + 1);
          }
        }, backoff);
        return;
      }
      if (!res.headersSent && !res.destroyed && !res.writableEnded) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        res.status(502).send(`Stream Proxy Connection Error: ${err.message}`);
      }
    });
  } catch (err) {
    if (!res.headersSent && !res.destroyed && !res.writableEnded) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.status(500).send(`Internal Proxy Error: ${err.message}`);
    }
  }
}
app.get("/api/epg", (req, res) => {
  const channelId = req.query.channelId;
  if (channelId) {
    return res.json(generateSampleEPG(channelId));
  }
  const fullGuide = {};
  channelsStore.forEach((ch) => {
    fullGuide[ch.id] = generateSampleEPG(ch.id);
  });
  return res.json(fullGuide);
});
app.post("/api/favorites/toggle", (req, res) => {
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
app.use("/api/admin", (req, res, next) => {
  try {
    const user = verifyToken(req.headers.authorization);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required." });
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
    return res.status(400).json({ error: "No valid #EXTINF channels found in M3U file" });
  }
  const newChannels = result.channels;
  if (overwrite) {
    channelsStore = newChannels;
  } else {
    const existingUrls = new Set(channelsStore.map((c) => c.streamUrl));
    const filteredNewChannels = newChannels.filter((nc) => nc.streamUrl && !existingUrls.has(nc.streamUrl));
    if (filteredNewChannels.length === 0 && newChannels.length > 0) {
      return res.json({
        message: "All channels in this playlist are already imported.",
        totalChannels: channelsStore.length,
        addedCount: 0
      });
    }
    let maxNum = channelsStore.reduce(
      (max, c) => Math.max(max, c.channelNumber),
      100
    );
    filteredNewChannels.forEach((nc) => {
      maxNum++;
      nc.channelNumber = maxNum;
      channelsStore.push(nc);
    });
  }
  playlistSourceStore.type = "m3u_text";
  playlistSourceStore.lastSyncedAt = (/* @__PURE__ */ new Date()).toISOString();
  await persistChannels(channelsStore);
  await persistPlaylistSource(playlistSourceStore);
  return res.json({
    message: `Successfully parsed and saved ${newChannels.length} channels from M3U playlist!`,
    totalChannels: channelsStore.length,
    addedCount: newChannels.length
  });
});
app.post("/api/admin/m3u/url", async (req, res) => {
  const user = ensureAdminUser(req.headers.authorization);
  const { url, overwrite = true } = req.body;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Valid M3U HTTP/HTTPS Playlist URL is required" });
  }
  const incomingUrls = url.split(/[\n,]+/).map((u) => u.trim()).filter((u) => u.startsWith("http"));
  if (incomingUrls.length === 0) {
    return res.status(400).json({ error: "No valid M3U HTTP/HTTPS Playlist URLs found in input" });
  }
  try {
    let allNewChannels = [];
    let existingUrls = [];
    if (!overwrite && playlistSourceStore.type === "m3u_url" && playlistSourceStore.url) {
      existingUrls = playlistSourceStore.url.split(/[\n,]+/).map((u) => u.trim()).filter(Boolean);
    }
    const urlsToProcess = overwrite ? incomingUrls : incomingUrls.filter((u) => !existingUrls.includes(u));
    if (urlsToProcess.length === 0 && !overwrite) {
      return res.json({
        message: "All provided URLs are already imported. No new channels added.",
        totalChannels: channelsStore.length,
        addedCount: 0
      });
    }
    for (const singleUrl of urlsToProcess) {
      try {
        console.log(`[Admin] Fetching M3U from: ${singleUrl}`);
        const response = await fetchWithTlsBypass(singleUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) IPTVPlayer/2.0"
          }
        });
        if (response.ok) {
          const m3uText = await response.text();
          const result = parseM3U(m3uText, singleUrl);
          if (result.channels.length > 0) {
            allNewChannels.push(...result.channels);
            console.log(`[Admin] Successfully loaded ${result.channels.length} channels from ${singleUrl}`);
          }
        } else {
          console.warn(`[Admin] Failed to fetch M3U from ${singleUrl}: Status ${response.status}`);
        }
      } catch (e) {
        console.warn(`[Admin] Error fetching M3U from ${singleUrl}: ${e.message}`);
      }
    }
    if (allNewChannels.length === 0 && !overwrite) {
      return res.status(400).json({ error: "No valid channels found in the new playlist(s)." });
    }
    if (overwrite) {
      channelsStore = allNewChannels;
      playlistSourceStore.url = incomingUrls.join("\n");
    } else {
      let maxNum = channelsStore.reduce(
        (max, c) => Math.max(max, c.channelNumber),
        100
      );
      allNewChannels.forEach((nc) => {
        maxNum++;
        nc.channelNumber = maxNum;
        channelsStore.push(nc);
      });
      const combinedUrls = [.../* @__PURE__ */ new Set([...existingUrls, ...urlsToProcess])];
      playlistSourceStore.url = combinedUrls.join("\n");
    }
    playlistSourceStore.type = "m3u_url";
    playlistSourceStore.xtreamServer = "";
    playlistSourceStore.xtreamUser = "";
    playlistSourceStore.xtreamPass = "";
    playlistSourceStore.lastSyncedAt = (/* @__PURE__ */ new Date()).toISOString();
    await persistChannels(channelsStore);
    await persistPlaylistSource(playlistSourceStore);
    return res.json({
      message: overwrite ? `Successfully imported ${allNewChannels.length} channels from ${urlsToProcess.length} M3U source(s)!` : `Successfully added ${allNewChannels.length} new channels from ${urlsToProcess.length} new M3U source(s)!`,
      totalChannels: channelsStore.length,
      addedCount: allNewChannels.length,
      sourceUrl: playlistSourceStore.url
    });
  } catch (err) {
    return res.status(500).json({ error: `Error downloading M3U URL: ${err.message}` });
  }
});
app.post("/api/admin/xtream/connect", async (req, res) => {
  const user = ensureAdminUser(req.headers.authorization);
  const { serverUrl, username, password, overwrite = true } = req.body;
  if (!serverUrl || !username || !password) {
    return res.status(400).json({
      error: "Server URL, Username, and Password are all required for Xtream Codes."
    });
  }
  let cleanServer = serverUrl.trim();
  if (!cleanServer.startsWith("http://") && !cleanServer.startsWith("https://")) {
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
            "User-Agent": "VLC/3.0.12 LibVLC/3.0.12"
          }
        });
        if (response.ok) {
          const text = await response.text();
          if (text && text.includes("#EXTINF")) {
            m3uText = text;
            break;
          }
        }
      } catch (e) {
      }
    }
    if (!m3uText) {
      const apiEndpoint = `${cleanServer}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_streams`;
      const vodEndpoint = `${cleanServer}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_vod_streams`;
      const seriesEndpoint = `${cleanServer}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_series`;
      const headers = { "User-Agent": "VLC/3.0.12 LibVLC/3.0.12" };
      const apiRes = await fetchWithTlsBypass(apiEndpoint, { headers });
      if (!apiRes.ok) {
        return res.status(400).json({
          error: `Xtream Codes server error (${apiRes.status}). Please check credentials or URL.`
        });
      }
      let streamList = await apiRes.json();
      if (!Array.isArray(streamList)) {
        streamList = [];
      }
      try {
        const vodRes = await fetchWithTlsBypass(vodEndpoint, { headers });
        if (vodRes.ok) {
          const vodList = await vodRes.json();
          if (Array.isArray(vodList)) {
            vodList.forEach((v) => v.is_vod = true);
            streamList.push(...vodList);
          }
        }
      } catch (e) {
      }
      try {
        const seriesRes = await fetchWithTlsBypass(seriesEndpoint, { headers });
        if (seriesRes.ok) {
          const seriesList = await seriesRes.json();
          if (Array.isArray(seriesList)) {
            seriesList.forEach((s) => s.is_series = true);
            streamList.push(...seriesList);
          }
        }
      } catch (e) {
      }
      if (streamList.length === 0) {
        return res.status(400).json({
          error: "Invalid response from Xtream Codes API or no streams available. Credentials or account status may be invalid."
        });
      }
      let idxCounter = 0;
      const xtreamChannels = streamList.map(
        (st) => {
          idxCounter++;
          let streamUrl = st.direct_source || st.url;
          if (streamUrl) {
            try {
              const urlObj = new URL(streamUrl);
              if (urlObj.hostname.includes("banglaview.online") && cleanServer.includes("banglavu.top")) {
                streamUrl = streamUrl.replace("banglaview.online", "banglavu.top");
              }
            } catch (e) {
            }
          }
          if (!streamUrl) {
            if (st.is_vod) {
              streamUrl = `${cleanServer}/movie/${username}/${password}/${st.stream_id}.${st.container_extension || "mp4"}`;
            } else if (st.is_series) {
              streamUrl = `${cleanServer}/series/${username}/${password}/${st.series_id}`;
            } else {
              streamUrl = `${cleanServer}/live/${username}/${password}/${st.stream_id}.ts`;
            }
          }
          let finalCat = st.category_name || "Xtream TV";
          if (st.is_vod && !finalCat.toLowerCase().match(/(vod|movie|film|cinema)/)) {
            finalCat += " (VOD)";
          } else if (st.is_series && !finalCat.toLowerCase().match(/(series|season|episode)/)) {
            finalCat += " (Series)";
          }
          if (isAdultContent(st.name || "", finalCat)) {
            finalCat = "Adult (18+)";
          }
          return {
            id: `xtream-${st.stream_id || st.series_id || idxCounter}`,
            channelNumber: idxCounter,
            name: st.name || `Channel ${idxCounter}`,
            logo: st.stream_icon || st.cover || "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=200",
            category: finalCat,
            streamUrl,
            isPremium: classifyIsPremium(st.name || "", finalCat),
            isActive: true,
            tvgId: st.epg_channel_id || ""
          };
        }
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
        lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await persistChannels(channelsStore);
      await persistPlaylistSource(playlistSourceStore);
      return res.json({
        message: `Successfully connected Xtream Codes API! Imported ${xtreamChannels.length} channels.`,
        totalChannels: channelsStore.length,
        addedCount: xtreamChannels.length
      });
    }
    const result = parseM3U(m3uText);
    if (result.channels.length === 0) {
      return res.status(400).json({
        error: "Xtream Codes returned 0 channels. Please verify account status and credentials."
      });
    }
    const newChannels = result.channels;
    if (overwrite) {
      channelsStore = newChannels;
    } else {
      let maxNum = channelsStore.reduce(
        (max, c) => Math.max(max, c.channelNumber),
        100
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
      lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await persistChannels(channelsStore);
    await persistPlaylistSource(playlistSourceStore);
    return res.json({
      message: `Successfully connected to Xtream Codes account! Loaded ${newChannels.length} channels.`,
      totalChannels: channelsStore.length,
      addedCount: newChannels.length
    });
  } catch (err) {
    return res.status(500).json({ error: `Xtream Codes Connection Error: ${err.message}` });
  }
});
app.get("/api/admin/playlist-source", (req, res) => {
  const user = ensureAdminUser(req.headers.authorization);
  return res.json({
    ...playlistSourceStore,
    totalChannels: channelsStore.length
  });
});
app.get("/api/admin/channels", (req, res) => {
  const user = ensureAdminUser(req.headers.authorization);
  const search = (req.query.search || "").toLowerCase();
  const limit = parseInt(req.query.limit) || 500;
  const offset = parseInt(req.query.offset) || 0;
  let filtered = channelsStore;
  if (search) {
    filtered = channelsStore.filter(
      (c) => c.name.toLowerCase().includes(search) || c.category.toLowerCase().includes(search) || String(c.channelNumber).includes(search)
    );
  }
  const paginated = filtered.slice(offset, offset + limit);
  return res.json({
    channels: paginated,
    total: filtered.length,
    offset,
    limit
  });
});
app.put("/api/admin/channels/:id", async (req, res) => {
  const user = ensureAdminUser(req.headers.authorization);
  const { id } = req.params;
  const channelIdx = channelsStore.findIndex((c) => c.id === id);
  if (channelIdx === -1)
    return res.status(404).json({ error: "Channel not found" });
  channelsStore[channelIdx] = {
    ...channelsStore[channelIdx],
    ...req.body
  };
  await persistChannels(channelsStore);
  return res.json(channelsStore[channelIdx]);
});
app.delete("/api/admin/channels/:id", async (req, res) => {
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
      } catch (e) {
      }
    }
    playlistSourceStore = {
      type: "cleared",
      url: "",
      xtreamServer: "",
      xtreamUser: "",
      xtreamPass: "",
      lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await persistPlaylistSource(playlistSourceStore);
    await persistChannels(channelsStore);
    return res.json({ message: `Successfully cleared all ${TOTAL} channels!`, totalChannels: 0 });
  } catch (err) {
    console.error("Error clearing channels:", err);
    return res.status(500).json({ error: err.message || "Failed to clear channels" });
  }
});
app.post("/api/admin/channels/reset-default", async (req, res) => {
  try {
    ensureAdminUser(req.headers.authorization);
    channelsStore = JSON.parse(JSON.stringify(INITIAL_CHANNELS));
    playlistSourceStore = {
      type: "default",
      url: "",
      xtreamServer: "",
      xtreamUser: "",
      xtreamPass: "",
      lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    try {
      fs.writeFileSync(CHANNELS_CACHE_FILE, JSON.stringify(channelsStore));
    } catch (e) {
    }
    await persistPlaylistSource(playlistSourceStore);
    await persistChannels(channelsStore);
    return res.json({
      message: `Successfully restored ${channelsStore.length} verified default working channels!`,
      totalChannels: channelsStore.length,
      channels: channelsStore
    });
  } catch (err) {
    console.error("Error restoring default channels:", err);
    return res.status(500).json({ error: err.message || "Failed to restore default channels" });
  }
});
app.post(
  "/api/admin/channels/assign-numbers",
  async (req, res) => {
    const user = ensureAdminUser(req.headers.authorization);
    const { startFrom = 0 } = req.body;
    let num = Number(startFrom);
    channelsStore.forEach((c) => {
      c.channelNumber = num++;
    });
    await persistChannels(channelsStore);
    return res.json({
      message: "Channel numbers re-assigned successfully",
      channels: channelsStore
    });
  }
);
app.post("/api/admin/reset-database", async (req, res) => {
  const user = ensureAdminUser(req.headers.authorization);
  channelsStore = [];
  playlistSourceStore = {
    type: "cleared",
    url: "",
    xtreamServer: "",
    xtreamUser: "",
    xtreamPass: "",
    lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (db && !firestoreQuotaExhausted) {
    await safeFirestoreWrite(async () => {
      const snap = await getDocs(collection(db, "channels"));
      const deletePromises = snap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      console.log("\u{1F525} Firestore channels cleared during database format.");
      await setDoc(doc(db, "settings", "playlistSource"), playlistSourceStore);
    });
  }
  return res.json({
    message: "Database cleared successfully. 0 channels remaining. Add an M3U link in Admin to load channels.",
    channels: channelsStore
  });
});
app.post("/api/admin/users/:id/approve", async (req, res) => {
  const user = ensureAdminUser(req.headers.authorization);
  const { id } = req.params;
  const userToApprove = usersStore.find((u) => u.id === id);
  if (!userToApprove) {
    return res.status(404).json({ error: "User not found" });
  }
  userToApprove.isApprovedByAdmin = true;
  if (db) {
    await setDoc(doc(db, "users", id), userToApprove);
  }
  return res.json({ message: "User approved successfully" });
});
app.get("/api/admin/users", (req, res) => {
  const user = ensureAdminUser(req.headers.authorization);
  return res.json(usersStore);
});
app.post("/api/admin/users", async (req, res) => {
  const user = ensureAdminUser(req.headers.authorization);
  const {
    username,
    email,
    role = "user",
    subscriptionPlan = "Free"
  } = req.body;
  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }
  const existing = usersStore.find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
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
  const newUser = {
    id: `user-${Date.now()}`,
    username,
    email: email || `${username}@myiptv.com`,
    role,
    subscriptionPlan,
    subscriptionExpiresAt: days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1e3).toISOString() : null,
    favorites: [],
    recentlyWatched: []
  };
  usersStore.push(newUser);
  await persistUser(newUser);
  return res.json({ message: "User created successfully", user: newUser });
});
app.delete("/api/admin/users/:id", async (req, res) => {
  const user = ensureAdminUser(req.headers.authorization);
  const { id } = req.params;
  usersStore = usersStore.filter((u) => u.id !== id);
  await deleteUserDoc(id);
  return res.json({ message: "User deleted successfully" });
});
app.put(
  "/api/admin/users/:id/subscription",
  async (req, res) => {
    const user = ensureAdminUser(req.headers.authorization);
    const { id } = req.params;
    const { plan } = req.body;
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
      targetUser.subscriptionExpiresAt = new Date(
        Date.now() + days * 24 * 60 * 60 * 1e3
      ).toISOString();
    } else {
      targetUser.subscriptionExpiresAt = null;
    }
    await persistUser(targetUser);
    return res.json(targetUser);
  }
);
app.put(
  "/api/admin/users/:id/adult-access",
  async (req, res) => {
    const user = ensureAdminUser(req.headers.authorization);
    const { id } = req.params;
    const { hasAdultAccess } = req.body;
    const targetUser = usersStore.find((u) => u.id === id);
    if (!targetUser) return res.status(404).json({ error: "User not found" });
    targetUser.hasAdultAccess = !!hasAdultAccess;
    await persistUser(targetUser);
    return res.json(targetUser);
  }
);
app.post("/api/admin/payments/:id/approve", async (req, res) => {
  const user = ensureAdminUser(req.headers.authorization);
  const { id } = req.params;
  let { userId, plan } = req.body;
  if (!userId) {
    if (id.startsWith("req_")) {
      userId = id.replace("req_", "");
    } else {
      userId = id;
    }
  }
  try {
    if (db) {
      try {
        await setDoc(doc(db, "payments", id), { status: "Success" }, { merge: true });
        if (id.startsWith("req_")) {
          await setDoc(doc(db, "payments", id.replace("req_", "")), { status: "Success" }, { merge: true });
        }
      } catch (e) {
        console.warn("Firestore payment status set error:", e);
      }
    }
    let days = 30;
    const planStr = String(plan || "");
    if (planStr.includes("1 Day")) days = 1;
    else if (planStr.includes("7 Days")) days = 7;
    else if (planStr.includes("90 Days")) days = 90;
    else if (planStr.includes("365 Days")) days = 365;
    let targetUser = usersStore.find((u) => u.id === userId || u.id === id || `req_${u.id}` === id);
    if (targetUser) {
      targetUser.subscriptionPlan = plan || "1 Month Premium (\u09F3100)";
      targetUser.isApprovedByAdmin = true;
      targetUser.paymentStatus = "Success";
      targetUser.subscriptionExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1e3).toISOString();
      await persistUser(targetUser);
    } else if (db) {
      try {
        const userRef = doc(db, "users", userId);
        await setDoc(userRef, {
          id: userId,
          subscriptionPlan: plan || "1 Month Premium (\u09F3100)",
          isApprovedByAdmin: true,
          paymentStatus: "Success",
          subscriptionExpiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1e3).toISOString()
        }, { merge: true });
      } catch (e) {
        console.warn("Firestore user approval set error:", e);
      }
    }
    let payment = paymentsStore.find((p) => p.id === id || p.id === `req_${userId}` || p.userId === userId);
    if (payment) {
      payment.status = "Success";
    } else {
      paymentsStore.push({
        id,
        userId,
        status: "Success",
        plan: plan || "1 Month Premium (\u09F3100)",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    return res.json({ message: "Payment approved successfully" });
  } catch (error) {
    console.error("Error approving payment:", error);
    return res.status(500).json({ error: "Failed to approve payment" });
  }
});
app.post("/api/admin/payments/:id/reject", async (req, res) => {
  const user = ensureAdminUser(req.headers.authorization);
  const { id } = req.params;
  let { userId } = req.body;
  if (!userId) {
    if (id.startsWith("req_")) {
      userId = id.replace("req_", "");
    } else {
      userId = id;
    }
  }
  try {
    let payment = paymentsStore.find((p) => p.id === id || p.id === `req_${userId}` || p.userId === userId);
    if (payment) {
      payment.status = "Rejected";
    } else {
      paymentsStore.push({
        id,
        userId,
        status: "Rejected",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    if (db) {
      try {
        await setDoc(doc(db, "payments", id), { status: "Rejected", userId }, { merge: true });
        if (id.startsWith("req_")) {
          await setDoc(doc(db, "payments", id.replace("req_", "")), { status: "Rejected", userId }, { merge: true });
        }
      } catch (e) {
        console.warn("Firestore payment reject error:", e);
      }
    }
    let targetUser = usersStore.find((u) => u.id === userId || u.id === id || `req_${u.id}` === id);
    if (targetUser) {
      targetUser.subscriptionPlan = "Free";
      targetUser.subscriptionStatus = "inactive";
      targetUser.isApprovedByAdmin = false;
      targetUser.paymentStatus = "Rejected";
      targetUser.subscriptionExpiresAt = null;
      await persistUser(targetUser);
    } else if (db) {
      try {
        const userRef = doc(db, "users", userId);
        await setDoc(userRef, {
          subscriptionPlan: "Free",
          subscriptionStatus: "inactive",
          isApprovedByAdmin: false,
          paymentStatus: "Rejected",
          subscriptionExpiresAt: null
        }, { merge: true });
      } catch (e) {
        console.warn("Firestore user reject error:", e);
      }
    }
    return res.json({ message: "Payment rejected successfully" });
  } catch (error) {
    console.error("Error rejecting payment:", error);
    return res.status(500).json({ error: "Failed to reject payment" });
  }
});
app.delete("/api/admin/payments/:id", async (req, res) => {
  const user = ensureAdminUser(req.headers.authorization);
  const { id } = req.params;
  const { userId, userName, transactionId } = req.body || {};
  try {
    const rawId = id.replace(/^req_/, "");
    const reqId = `req_${rawId}`;
    const toDeleteKeys = [id, rawId, reqId, userId, userName, transactionId].filter(Boolean);
    toDeleteKeys.forEach((k) => deletedPaymentIds.add(k));
    paymentsStore = paymentsStore.filter((p) => {
      if (toDeleteKeys.includes(p.id)) return false;
      if (p.userId && toDeleteKeys.includes(p.userId)) return false;
      if (p.userName && toDeleteKeys.includes(p.userName)) return false;
      if (p.transactionId && toDeleteKeys.includes(p.transactionId)) return false;
      return true;
    });
    if (db) {
      for (const key of toDeleteKeys) {
        try {
          await setDoc(doc(db, "deleted_payments", key), { isDeleted: true, deletedAt: (/* @__PURE__ */ new Date()).toISOString() });
          await deleteDoc(doc(db, "payments", key));
        } catch (e) {
        }
      }
    }
    return res.json({ message: "Payment deleted successfully" });
  } catch (error) {
    console.error("Error deleting payment:", error);
    return res.status(500).json({ error: "Failed to delete payment" });
  }
});
app.post("/api/admin/users/:id/approve", async (req, res) => {
  const user = ensureAdminUser(req.headers.authorization);
  const { id } = req.params;
  const targetUser = usersStore.find((u) => u.id === id);
  if (!targetUser) return res.status(404).json({ error: "User not found" });
  targetUser.isApprovedByAdmin = true;
  await persistUser(targetUser);
  return res.json({ message: "User approved successfully", user: targetUser });
});
app.get("/api/admin/stats", (req, res) => {
  const user = ensureAdminUser(req.headers.authorization);
  return res.json({
    totalChannels: channelsStore.length,
    activeChannels: channelsStore.filter((c) => c.isActive).length,
    premiumChannels: channelsStore.filter((c) => c.isPremium).length,
    totalUsers: usersStore.length,
    activeSubscriptions: usersStore.filter((u) => hasActiveSubscription(u)).length
  });
});
async function start() {
  try {
    await syncFromFirestore();
  } catch (err) {
    console.warn("\u26A0\uFE0F Firestore sync failed during startup, continuing with in-memory store:", err?.message || err);
  }
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn("Vite middleware not loaded, continuing as API server only:", e);
    }
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
var index_default = app;
if (process.env.VERCEL !== "1") {
  start();
}
export {
  app,
  index_default as default,
  ensureSynced
};
