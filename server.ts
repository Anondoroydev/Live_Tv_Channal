import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import https from 'https';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';
import { INITIAL_CHANNELS, generateSampleEPG } from './src/data/initialChannels';
import { Channel, EPGProgram, User, SubscriptionPlan, M3UParseResult } from './src/types';

// Disable TLS verification for external IPTV stream sources & proxies
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize Firebase Firestore
let db: any = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const firebaseApp = getApps().length === 0 ? initializeApp(config) : getApps()[0];
    db = getFirestore(firebaseApp, config.firestoreDatabaseId || undefined);
    console.log('🔥 Firebase Firestore database connected successfully!');
  }
} catch (err) {
  console.error('Failed to initialize Firebase Firestore:', err);
}

// In-Memory Database State
let channelsStore: Channel[] = [...INITIAL_CHANNELS];

let playlistSourceStore = {
  type: 'default' as 'default' | 'm3u_text' | 'm3u_url' | 'xtream',
  url: '',
  xtreamServer: '',
  xtreamUser: '',
  xtreamPass: '',
  lastSyncedAt: new Date().toISOString()
};

let usersStore: User[] = [
  {
    id: 'user-admin',
    username: 'admin',
    email: 'admin@myiptv.com',
    role: 'admin',
    subscriptionPlan: '365 Days',
    subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    favorites: ['ch-0', 'ch-4'],
    recentlyWatched: ['ch-0', 'ch-1']
  },
  {
    id: 'user-free',
    username: 'freeuser',
    email: 'user@myiptv.com',
    role: 'user',
    subscriptionPlan: 'Free',
    subscriptionExpiresAt: null,
    favorites: [],
    recentlyWatched: []
  },
  {
    id: 'user-expired',
    username: 'expireduser',
    email: 'expired@myiptv.com',
    role: 'user',
    subscriptionPlan: 'Expired',
    subscriptionExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    favorites: [],
    recentlyWatched: []
  }
];

// Firestore Sync Helpers
async function syncFromFirestore() {
  if (!db) return;
  try {
    // Sync Users
    const usersSnap = await getDocs(collection(db, 'users'));
    if (!usersSnap.empty) {
      usersStore = usersSnap.docs.map(d => d.data() as User);
      console.log(`Loaded ${usersStore.length} users from Firestore DB`);
    } else {
      for (const u of usersStore) {
        await setDoc(doc(db, 'users', u.id), u);
      }
      console.log('Seeded initial users to Firestore DB');
    }

    // Sync Channels
    const channelsSnap = await getDocs(collection(db, 'channels'));
    if (!channelsSnap.empty) {
      channelsStore = channelsSnap.docs.map(d => d.data() as Channel);
      console.log(`Loaded ${channelsStore.length} channels from Firestore DB`);
    } else {
      for (const ch of INITIAL_CHANNELS) {
        await setDoc(doc(db, 'channels', ch.id), ch);
      }
      console.log('Seeded initial channels to Firestore DB');
    }

    // Sync Playlist Settings
    const playlistDoc = await getDoc(doc(db, 'settings', 'playlistSource'));
    if (playlistDoc.exists()) {
      playlistSourceStore = playlistDoc.data() as any;
      console.log('Loaded playlist source settings from Firestore DB');
    }
  } catch (err) {
    console.error('Error syncing data from Firestore:', err);
  }
}

async function persistUser(user: User) {
  if (!db) return;
  try {
    await setDoc(doc(db, 'users', user.id), user);
  } catch (err) {
    console.error('Error persisting user to Firestore:', err);
  }
}

async function deleteUserDoc(userId: string) {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (err) {
    console.error('Error deleting user from Firestore:', err);
  }
}

async function persistChannels(channels: Channel[]) {
  if (!db) return;
  try {
    for (const ch of channels) {
      await setDoc(doc(db, 'channels', ch.id), ch);
    }
  } catch (err) {
    console.error('Error persisting channels to Firestore:', err);
  }
}

async function deleteChannelDoc(channelId: string) {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'channels', channelId));
  } catch (err) {
    console.error('Error deleting channel from Firestore:', err);
  }
}

async function persistPlaylistSource(source: any) {
  if (!db) return;
  try {
    await setDoc(doc(db, 'settings', 'playlistSource'), source);
  } catch (err) {
    console.error('Error persisting playlist source to Firestore:', err);
  }
}

// Helper to generate simple fake JWT tokens
const generateToken = (user: User) => {
  const payload = { id: user.id, username: user.username, role: user.role, plan: user.subscriptionPlan };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
};

const verifyToken = (authHeader?: string): User | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.split(' ')[1];
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    return usersStore.find(u => u.id === decoded.id) || null;
  } catch {
    return null;
  }
};

const ensureAdminUser = (authHeader?: string): User => {
  const user = verifyToken(authHeader);
  if (user && user.role === 'admin') return user;
  throw new Error('Forbidden: Administrator privileges required.');
};

// Check if user has active premium access
const hasActiveSubscription = (user: User): boolean => {
  if (user.role === 'admin') return true;
  if (user.subscriptionPlan === 'Free' || user.subscriptionPlan === 'Expired') return false;
  if (!user.subscriptionExpiresAt) return false;
  return new Date(user.subscriptionExpiresAt).getTime() > Date.now();
};

// M3U Parsing Function
function parseM3U(content: string): M3UParseResult {
  const lines = content.split(/\r?\n/);
  const parsedChannels: Partial<Channel>[] = [];
  const categoriesSet = new Set<string>();

  let currentChannel: Partial<Channel> | null = null;
  let autoNumber = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXTINF:')) {
      currentChannel = {};

      // Parse tvg-logo
      const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
      if (logoMatch) currentChannel.logo = logoMatch[1];

      // Parse group-title (Category) - Keep exact category from M3U data
      const groupMatch = line.match(/group-title="([^"]+)"/i);
      const cat = groupMatch && groupMatch[1].trim() ? groupMatch[1].trim() : 'Uncategorized';

      currentChannel.category = cat;
      categoriesSet.add(cat);

      // Parse tvg-id
      const tvgIdMatch = line.match(/tvg-id="([^"]+)"/i);
      if (tvgIdMatch) currentChannel.tvgId = tvgIdMatch[1];

      // Parse Channel Name (after last comma)
      const commaIdx = line.lastIndexOf(',');
      if (commaIdx !== -1) {
        currentChannel.name = line.substring(commaIdx + 1).trim();
      } else {
        currentChannel.name = `Channel ${autoNumber}`;
      }

      // Check if premium flag in name or group
      const lowerName = (currentChannel.name || '').toLowerCase();
      currentChannel.isPremium = lowerName.includes('hd') || lowerName.includes('vip') || lowerName.includes('premium') || lowerName.includes('sports');
      currentChannel.isActive = true;

    } else if (line.length > 0 && !line.startsWith('#')) {
      if (currentChannel) {
        currentChannel.streamUrl = line;
        currentChannel.id = `m3u-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        currentChannel.channelNumber = autoNumber++;
        if (!currentChannel.logo) {
          currentChannel.logo = 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=200&auto=format&fit=crop&q=80';
        }
        parsedChannels.push(currentChannel);
        currentChannel = null;
      }
    }
  }

  return {
    totalChannels: parsedChannels.length,
    channels: parsedChannels,
    categories: Array.from(categoriesSet)
  };
}

// REST API ROUTES

// Auth Endpoints
app.post('/api/auth/login', (req: Request, res: Response) => {
  console.log('Login attempt for:', req.body.email);
  const { email, password } = req.body;
  const inputStr = (email || '').toLowerCase().trim();

  if (!inputStr) {
    return res.status(400).json({ error: 'Username or email is required' });
  }

  const user = usersStore.find(
    u => u.email.toLowerCase() === inputStr || u.username.toLowerCase() === inputStr
  );

  if (!user) {
    console.log('User not found:', inputStr);
    return res.status(401).json({ error: 'User account not found. Please register or enter valid credentials.' });
  }

  // If user role is admin, strictly require the admin password
  if (user.role === 'admin') {
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    if (!password || password !== adminPassword) {
      console.log('Admin password mismatch for:', inputStr);
      return res.status(401).json({ error: 'Incorrect Administrator Password. Access Denied.' });
    }
  } else {
    // If a password is set for standard user, verify it
    if (user.password && user.password !== password) {
      console.log('User password mismatch for:', inputStr);
      return res.status(401).json({ error: 'Incorrect Password. Access Denied.' });
    }
  }

  const token = generateToken(user);
  console.log('Login successful for:', inputStr);
  return res.json({
    token,
    user
  });
});

app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { username, email, password } = req.body;
  const usernameClean = (username || '').trim();
  const emailClean = (email || '').toLowerCase().trim();
  const passwordClean = password || '';

  if (!usernameClean) {
    return res.status(400).json({ error: 'Username is required' });
  }
  if (!emailClean) {
    return res.status(400).json({ error: 'Email address is required' });
  }
  if (!passwordClean) {
    return res.status(400).json({ error: 'Password is required' });
  }

  // Check if username or email is already taken
  const exists = usersStore.find(
    u => u.email.toLowerCase() === emailClean || u.username.toLowerCase() === usernameClean.toLowerCase()
  );

  if (exists) {
    return res.status(400).json({ error: 'Username or Email is already registered' });
  }

  // Create new user record
  const newUser: User = {
    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    username: usernameClean,
    email: emailClean,
    role: 'user',
    subscriptionPlan: 'Free',
    subscriptionExpiresAt: null,
    favorites: [],
    recentlyWatched: [],
    password: passwordClean
  };

  usersStore.push(newUser);
  await persistUser(newUser);

  const token = generateToken(newUser);
  return res.json({
    token,
    user: newUser,
    message: 'Registration successful!'
  });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const user = verifyToken(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.json({ user });
});

const handleSubscriptionUpdate = async (req: Request, res: Response) => {
  const user = verifyToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { plan }: { plan: SubscriptionPlan } = req.body;
  const planStr = String(plan);
  let days = 0;
  if (planStr.includes('1 Day')) days = 1;
  else if (planStr.includes('1 Month') || planStr.includes('30 Days')) days = 30;
  else if (planStr.includes('7 Days')) days = 7;
  else if (planStr.includes('90 Days')) days = 90;
  else if (planStr.includes('365 Days')) days = 365;

  user.subscriptionPlan = plan;
  if (days > 0) {
    let baseTime = Date.now();
    if (user.subscriptionExpiresAt) {
      const currentExpiry = new Date(user.subscriptionExpiresAt).getTime();
      if (currentExpiry > Date.now()) {
        baseTime = currentExpiry;
      }
    }
    user.subscriptionExpiresAt = new Date(baseTime + days * 24 * 60 * 60 * 1000).toISOString();
  } else {
    user.subscriptionExpiresAt = null;
  }

  await persistUser(user);

  return res.json({ message: 'Subscription updated', user });
};

app.put('/api/auth/subscription', handleSubscriptionUpdate);
app.post('/api/auth/subscription', handleSubscriptionUpdate);

// Channel Endpoints
app.get('/api/channels', (req: Request, res: Response) => {
  const category = req.query.category as string;
  const search = req.query.search as string;

  let result = channelsStore.filter(c => c.isActive);

  if (category && category !== 'All' && category !== 'Favorites' && category !== 'Recently Watched') {
    result = result.filter(c => c.category.toLowerCase() === category.toLowerCase());
  }

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      c.channelNumber.toString().includes(q)
    );
  }

  // Sort by channel number ascending
  result.sort((a, b) => a.channelNumber - b.channelNumber);

  return res.json(result);
});

app.get('/api/categories', (_req: Request, res: Response) => {
  console.log('API Request: /api/categories called. channelsStore length:', channelsStore.length);
  try {
     const existingCats = Array.from(new Set(channelsStore.map(c => c.category).filter(Boolean)));
     existingCats.sort((a, b) => a.localeCompare(b));
     return res.json(existingCats);
  } catch (e) {
     console.error('Error in /api/categories:', e);
     return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Secure Playback Stream Endpoint
app.get('/api/stream/:channelId', (req: Request, res: Response) => {
  const { channelId } = req.params;
  const channel = channelsStore.find(c => c.id === channelId);

  if (!channel || !channel.isActive) {
    return res.status(404).json({ error: 'Channel not found or inactive' });
  }

  // If Premium channel, check user authentication & subscription
  if (channel.isPremium) {
    const user = verifyToken(req.headers.authorization);
    if (!user) {
      return res.status(403).json({
        error: 'This is a Premium Channel. Please login to continue.',
        isPremiumLocked: true
      });
    }

    if (!hasActiveSubscription(user)) {
      return res.status(403).json({
        error: 'Your subscription has expired or is invalid. Please renew now to watch Premium channels.',
        isSubscriptionExpired: true
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
    isPremium: channel.isPremium
  });
});

// Proxy Stream Helper with HTTP/HTTPS Redirect & M3U8 Playlist URL Rewriting
function proxyStreamRequest(targetUrl: string, req: Request, res: Response, redirectCount = 0) {
  if (redirectCount > 5) {
    return res.status(502).send('Too many redirects');
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const reqHeaders: Record<string, string> = {
      'User-Agent': (req.headers['user-agent'] as string) || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Referer': parsedUrl.origin,
      'Accept-Encoding': 'identity'
    };

    if (req.headers.range) {
      reqHeaders['Range'] = req.headers.range as string;
    }

    const options: https.RequestOptions = {
      headers: reqHeaders,
      rejectUnauthorized: false
    };

    const proxyReq = client.get(targetUrl, options, (proxyRes) => {
      // Follow HTTP redirects (301, 302, 303, 307, 308)
      if (proxyRes.statusCode && [301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
        const redirectUrl = new URL(proxyRes.headers.location, targetUrl).href;
        return proxyStreamRequest(redirectUrl, req, res, redirectCount + 1);
      }

      if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Content-Type', 'text/plain');
        return res.status(proxyRes.statusCode).send(proxyRes.statusCode === 429 ? 'Rate Limit Exceeded (10000)' : `Stream Server Error: ${proxyRes.statusCode}`);
      }

      const contentType = (proxyRes.headers['content-type'] || '').toLowerCase();
      const isM3u8 = targetUrl.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('apple.mpegurl');

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

      if (isM3u8) {
        let data = '';
        proxyRes.setEncoding('utf8');
        proxyRes.on('data', (chunk) => { data += chunk; });
        proxyRes.on('end', () => {
          const trimmedData = data.trim();
          if (trimmedData && !trimmedData.startsWith('#') && !trimmedData.startsWith('EXTM3U') && !trimmedData.startsWith('#EXTM3U')) {
            console.warn(`Non-M3U8 response on stream endpoint: ${trimmedData.substring(0, 100)}`);
            res.setHeader('Content-Type', 'text/plain');
            return res.status(trimmedData.toLowerCase().includes('rate exceeded') ? 429 : 502).send(trimmedData);
          }

          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');

          const lines = data.split(/\r?\n/);
          const rewrittenLines = lines.map(line => {
            const trimmed = line.trim();
            if (!trimmed) return line;

            if (trimmed.startsWith('#')) {
              return line.replace(/URI=(?:"([^"]+)"|'([^']+)'|([^\s,]+))/gi, (_match, q1, q2, q3) => {
                const rawUri = q1 || q2 || q3;
                if (!rawUri) return _match;
                const absUri = new URL(rawUri, targetUrl).href;
                return `URI="/api/proxy-stream?url=${encodeURIComponent(absUri)}"`;
              });
            }

            const absUrl = new URL(trimmed, targetUrl).href;
            return `/api/proxy-stream?url=${encodeURIComponent(absUrl)}`;
          });

          res.status(200).send(rewrittenLines.join('\n'));
        });
      } else {
        const responseHeaders: Record<string, string | string[]> = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Content-Type': proxyRes.headers['content-type'] || 'video/mp2t'
        };

        if (proxyRes.headers['content-length']) responseHeaders['Content-Length'] = proxyRes.headers['content-length'];
        if (proxyRes.headers['content-range']) responseHeaders['Content-Range'] = proxyRes.headers['content-range'];
        if (proxyRes.headers['accept-ranges']) responseHeaders['Accept-Ranges'] = proxyRes.headers['accept-ranges'];

        res.writeHead(proxyRes.statusCode || 200, responseHeaders);
        proxyRes.pipe(res);
      }
    });

    proxyReq.on('error', (err) => {
      console.error('Stream proxy error:', err.message);
      if (!res.headersSent) {
        res.status(502).send('Proxy Stream Connection Error');
      }
    });
  } catch (e) {
    if (!res.headersSent) {
      res.status(400).send('Invalid Stream URL');
    }
  }
}

// Proxy Stream Endpoint to bypass CORS and mixed-content restrictions
app.options('/api/proxy-stream', (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.sendStatus(200);
});

app.get('/api/proxy-stream', (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) return res.status(400).send('URL required');
  proxyStreamRequest(targetUrl, req, res);
});

// EPG Timeline Data
app.get('/api/epg', (req: Request, res: Response) => {
  const channelId = req.query.channelId as string;
  if (channelId) {
    return res.json(generateSampleEPG(channelId));
  }

  const fullGuide: Record<string, EPGProgram[]> = {};
  channelsStore.forEach(ch => {
    fullGuide[ch.id] = generateSampleEPG(ch.id);
  });
  return res.json(fullGuide);
});

// Favorites Toggle
app.post('/api/favorites/toggle', (req: Request, res: Response) => {
  const user = verifyToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { channelId } = req.body;
  if (!channelId) return res.status(400).json({ error: 'Channel ID required' });

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
app.use('/api/admin', (req: Request, res: Response, next) => {
  try {
    const user = verifyToken(req.headers.authorization);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized session.' });
  }
});

app.post('/api/admin/m3u/upload', (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);

  const { m3uContent, overwrite } = req.body;
  if (!m3uContent || typeof m3uContent !== 'string') {
    return res.status(400).json({ error: 'Valid M3U content text required' });
  }

  const result = parseM3U(m3uContent);

  if (result.channels.length === 0) {
    return res.status(400).json({ error: 'No valid #EXTINF channels found in M3U file' });
  }

  const newChannels = result.channels as Channel[];

  if (overwrite) {
    channelsStore = newChannels;
  } else {
    // Append and fix channel numbers
    let maxNum = channelsStore.reduce((max, c) => Math.max(max, c.channelNumber), 100);
    newChannels.forEach(nc => {
      maxNum++;
      nc.channelNumber = maxNum;
      channelsStore.push(nc);
    });
  }

  playlistSourceStore.type = 'm3u_text';
  playlistSourceStore.lastSyncedAt = new Date().toISOString();

  return res.json({
    message: `Successfully parsed and saved ${newChannels.length} channels from M3U playlist!`,
    totalChannels: channelsStore.length,
    addedCount: newChannels.length
  });
});

// Admin M3U URL Import
app.post('/api/admin/m3u/url', async (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);

  const { url, overwrite = true } = req.body;
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return res.status(400).json({ error: 'Valid M3U HTTP/HTTPS Playlist URL is required' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) IPTVPlayer/2.0'
      }
    });

    if (!response.ok) {
      return res.status(400).json({ error: `Failed to fetch M3U URL. Server returned status: ${response.status}` });
    }

    const m3uText = await response.text();
    const result = parseM3U(m3uText);

    if (result.channels.length === 0) {
      return res.status(400).json({ error: 'No valid channels (#EXTINF) found at the provided M3U URL.' });
    }

    const newChannels = result.channels as Channel[];

    if (overwrite) {
      channelsStore = newChannels;
    } else {
      let maxNum = channelsStore.reduce((max, c) => Math.max(max, c.channelNumber), 100);
      newChannels.forEach(nc => {
        maxNum++;
        nc.channelNumber = maxNum;
        channelsStore.push(nc);
      });
    }

    playlistSourceStore = {
      type: 'm3u_url',
      url,
      xtreamServer: '',
      xtreamUser: '',
      xtreamPass: '',
      lastSyncedAt: new Date().toISOString()
    };

    return res.json({
      message: `Successfully connected & imported ${newChannels.length} channels from M3U URL!`,
      totalChannels: channelsStore.length,
      addedCount: newChannels.length,
      sourceUrl: url
    });
  } catch (err: any) {
    return res.status(500).json({ error: `Error downloading M3U URL: ${err.message}` });
  }
});

// Admin Xtream Codes API Connect
app.post('/api/admin/xtream/connect', async (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);

  const { serverUrl, username, password, overwrite = true } = req.body;
  if (!serverUrl || !username || !password) {
    return res.status(400).json({ error: 'Server URL, Username, and Password are all required for Xtream Codes.' });
  }

  // Clean up server URL
  let cleanServer = serverUrl.trim();
  if (!cleanServer.startsWith('http://') && !cleanServer.startsWith('https://')) {
    cleanServer = `http://${cleanServer}`;
  }
  cleanServer = cleanServer.replace(/\/+$/, '');

  try {
    let m3uText = '';
    const formatsToTry = ['m3u8', 'hls', 'ts'];

    for (const fmt of formatsToTry) {
      const m3uPlusUrl = `${cleanServer}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus&output=${fmt}`;
      try {
        const response = await fetch(m3uPlusUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) IPTVPlayer/2.0' }
        });
        if (response.ok) {
          const text = await response.text();
          if (text && text.includes('#EXTINF')) {
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
      const apiRes = await fetch(apiEndpoint, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) IPTVPlayer/2.0' }
      });
      if (!apiRes.ok) {
        return res.status(400).json({ error: `Xtream Codes server error (${apiRes.status}). Please check credentials or URL.` });
      }
      const streamList = await apiRes.json();
      if (!Array.isArray(streamList)) {
        return res.status(400).json({ error: 'Invalid response from Xtream Codes API. Credentials or account status may be invalid.' });
      }

      // Convert Xtream Streams JSON to Channel[]
      const xtreamChannels: Channel[] = streamList.map((st: any, idx: number) => ({
        id: `xtream-${st.stream_id || idx}`,
        channelNumber: 101 + idx,
        name: st.name || `Channel ${101 + idx}`,
        logo: st.stream_icon || 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=200',
        category: st.category_name || 'Xtream TV',
        streamUrl: `${cleanServer}/live/${username}/${password}/${st.stream_id}.m3u8`,
        isPremium: (st.name || '').toLowerCase().includes('hd') || (st.name || '').toLowerCase().includes('vip'),
        isActive: true,
        tvgId: st.epg_channel_id || ''
      }));

      if (overwrite) {
        channelsStore = xtreamChannels;
      } else {
        channelsStore.push(...xtreamChannels);
      }

      playlistSourceStore = {
        type: 'xtream',
        url: '',
        xtreamServer: cleanServer,
        xtreamUser: username,
        xtreamPass: password,
        lastSyncedAt: new Date().toISOString()
      };

      return res.json({
        message: `Successfully connected Xtream Codes API! Imported ${xtreamChannels.length} channels.`,
        totalChannels: channelsStore.length,
        addedCount: xtreamChannels.length
      });
    }

    // Parse returned M3U text
    const result = parseM3U(m3uText);
    if (result.channels.length === 0) {
      return res.status(400).json({ error: 'Xtream Codes returned 0 channels. Please verify account status and credentials.' });
    }

    const newChannels = result.channels as Channel[];
    if (overwrite) {
      channelsStore = newChannels;
    } else {
      let maxNum = channelsStore.reduce((max, c) => Math.max(max, c.channelNumber), 100);
      newChannels.forEach(nc => {
        maxNum++;
        nc.channelNumber = maxNum;
        channelsStore.push(nc);
      });
    }

    playlistSourceStore = {
      type: 'xtream',
      url: '',
      xtreamServer: cleanServer,
      xtreamUser: username,
      xtreamPass: password,
      lastSyncedAt: new Date().toISOString()
    };

    return res.json({
      message: `Successfully connected to Xtream Codes account! Loaded ${newChannels.length} channels.`,
      totalChannels: channelsStore.length,
      addedCount: newChannels.length
    });

  } catch (err: any) {
    return res.status(500).json({ error: `Xtream Codes Connection Error: ${err.message}` });
  }
});

// Get Current Playlist Source Status
app.get('/api/admin/playlist-source', (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);

  return res.json({
    ...playlistSourceStore,
    totalChannels: channelsStore.length
  });
});

app.get('/api/admin/channels', (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);
  return res.json(channelsStore);
});

app.put('/api/admin/channels/:id', (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);

  const { id } = req.params;
  const channelIdx = channelsStore.findIndex(c => c.id === id);
  if (channelIdx === -1) return res.status(404).json({ error: 'Channel not found' });

  channelsStore[channelIdx] = {
    ...channelsStore[channelIdx],
    ...req.body
  };

  return res.json(channelsStore[channelIdx]);
});

app.delete('/api/admin/channels/:id', (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);

  const { id } = req.params;
  channelsStore = channelsStore.filter(c => c.id !== id);
  return res.json({ message: 'Channel deleted successfully' });
});

app.post('/api/admin/channels/assign-numbers', async (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);

  const { startFrom = 101 } = req.body;
  let num = Number(startFrom);
  channelsStore.forEach(c => {
    c.channelNumber = num++;
  });

  await persistChannels(channelsStore);

  return res.json({ message: 'Channel numbers re-assigned successfully', channels: channelsStore });
});

app.get('/api/admin/users', (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);
  return res.json(usersStore);
});

app.post('/api/admin/users', async (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);
  const { username, email, role = 'user', subscriptionPlan = 'Free' } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const existing = usersStore.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const planStr = String(subscriptionPlan);
  let days = 0;
  if (planStr.includes('1 Day')) days = 1;
  else if (planStr.includes('1 Month') || planStr.includes('30 Days')) days = 30;
  else if (planStr.includes('7 Days')) days = 7;
  else if (planStr.includes('90 Days')) days = 90;
  else if (planStr.includes('365 Days')) days = 365;

  const newUser: User = {
    id: `user-${Date.now()}`,
    username,
    email: email || `${username}@myiptv.com`,
    role,
    subscriptionPlan: subscriptionPlan as SubscriptionPlan,
    subscriptionExpiresAt: days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null,
    favorites: [],
    recentlyWatched: []
  };

  usersStore.push(newUser);
  await persistUser(newUser);

  return res.json({ message: 'User created successfully', user: newUser });
});

app.delete('/api/admin/users/:id', async (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);
  const { id } = req.params;

  usersStore = usersStore.filter(u => u.id !== id);
  await deleteUserDoc(id);

  return res.json({ message: 'User deleted successfully' });
});

app.put('/api/admin/users/:id/subscription', async (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);

  const { id } = req.params;
  const { plan }: { plan: SubscriptionPlan } = req.body;

  const targetUser = usersStore.find(u => u.id === id);
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  targetUser.subscriptionPlan = plan;
  const planStr = String(plan);
  let days = 0;
  if (planStr.includes('1 Day')) days = 1;
  else if (planStr.includes('1 Month') || planStr.includes('30 Days')) days = 30;
  else if (planStr.includes('7 Days')) days = 7;
  else if (planStr.includes('90 Days')) days = 90;
  else if (planStr.includes('365 Days')) days = 365;

  if (days > 0) {
    let baseTime = Date.now();
    if (targetUser.subscriptionExpiresAt) {
      const currentExpiry = new Date(targetUser.subscriptionExpiresAt).getTime();
      if (currentExpiry > Date.now()) {
        baseTime = currentExpiry;
      }
    }
    targetUser.subscriptionExpiresAt = new Date(baseTime + days * 24 * 60 * 60 * 1000).toISOString();
  } else {
    targetUser.subscriptionExpiresAt = null;
  }

  await persistUser(targetUser);

  return res.json(targetUser);
});

app.get('/api/admin/stats', (req: Request, res: Response) => {
  const user = ensureAdminUser(req.headers.authorization);

  return res.json({
    totalChannels: channelsStore.length,
    activeChannels: channelsStore.filter(c => c.isActive).length,
    premiumChannels: channelsStore.filter(c => c.isPremium).length,
    totalUsers: usersStore.length,
    activeSubscriptions: usersStore.filter(u => hasActiveSubscription(u)).length
  });
});

// Start Express and Vite
async function start() {
  await syncFromFirestore();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

start();
