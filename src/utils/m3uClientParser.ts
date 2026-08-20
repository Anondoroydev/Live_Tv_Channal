import { Channel } from "../types";
import { INITIAL_CHANNELS } from "../data/initialChannels";
import { db } from "../firebase";

export interface M3UParseResult {
  channels: Channel[];
  categories: string[];
  totalParsed: number;
}

export function isAdultContent(name: string, category: string = ""): boolean {
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
    /girls?\s*cam/i,
  ];

  return adultPatterns.some(
    (pattern) => pattern.test(lowerName) || pattern.test(lowerCat),
  );
}

export function classifyIsPremium(
  name: string,
  category: string = "",
): boolean {
  const lowerCat = (category || "").toLowerCase();
  if (
    lowerCat.includes("adult") ||
    lowerCat.includes("18+") ||
    lowerCat.includes("xxx") ||
    lowerCat.includes("porn")
  ) {
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

export function parseM3UClient(
  content: string,
  baseUrl?: string,
): M3UParseResult {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  const parsedChannels: Channel[] = [];
  const categoriesSet = new Set<string>();

  const seenUrls = new Set<string>();
  const seenNames = new Set<string>();
  let currentChannel: Partial<Channel> | null = null;
  let autoNumber = 0;
  let customUserAgent = "";
  let customReferer = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#EXTM3U")) continue;

    if (line.startsWith("#EXTINF:")) {
      currentChannel = { isActive: true };

      const infContent = line.substring(8);

      // Extract logo (tvg-logo, logo, icon with double quotes, single quotes, or unquoted)
      const logoMatch = /(?:tvg-logo|logo|icon)=["']?([^"'\s>]+)["']?/i.exec(infContent);
      if (logoMatch) currentChannel.logo = logoMatch[1];

      // Extract group-title / group
      const groupMatch = /(?:group-title|group)=["']?([^"']+)["']?/i.exec(infContent);
      let cat = (groupMatch && groupMatch[1].trim()) || "Entertainment";
      currentChannel.category = cat;
      categoriesSet.add(cat);

      // Extract tvg-id
      const tvgIdMatch = /(?:tvg-id|channel-id)=["']?([^"']+)["']?/i.exec(infContent);
      if (tvgIdMatch) currentChannel.tvgId = tvgIdMatch[1];

      // Extract channel number
      const chnoMatch = /(?:tvg-chno|chno)=["']?(\d+)["']?/i.exec(infContent);
      if (chnoMatch) currentChannel.channelNumber = parseInt(chnoMatch[1], 10);

      // Extract display name after comma
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
        const nameAndUrl = infContent.substring(commaIdx + 1).trim();
        // Check if stream URL is accidentally on the same line
        const urlMatch = /(https?:\/\/[^\s]+|rtmp:\/\/[^\s]+|rtsp:\/\/[^\s]+)/i.exec(nameAndUrl);
        if (urlMatch) {
          currentChannel.streamUrl = urlMatch[1];
          currentChannel.name = nameAndUrl.replace(urlMatch[1], "").trim() || `Channel ${autoNumber + 1}`;
        } else {
          currentChannel.name = nameAndUrl || `Channel ${autoNumber + 1}`;
        }
      } else {
        const tvgNameMatch = /(?:tvg-name)=["']?([^"',]+)["']?/i.exec(infContent);
        currentChannel.name = (tvgNameMatch && tvgNameMatch[1].trim()) || `Channel ${autoNumber + 1}`;
      }

      if (currentChannel.streamUrl) {
        pushChannelItem(currentChannel);
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
      const cat = line.substring(8).trim() || "Entertainment";
      if (currentChannel) {
        currentChannel.category = cat;
        categoriesSet.add(cat);
      }
    } else if (!line.startsWith("#")) {
      let streamUrl = line;
      if (baseUrl && !streamUrl.startsWith("http://") && !streamUrl.startsWith("https://")) {
        try {
          streamUrl = new URL(streamUrl, baseUrl).toString();
        } catch {}
      }

      if (
        streamUrl.startsWith("http://") ||
        streamUrl.startsWith("https://") ||
        streamUrl.startsWith("rtmp://") ||
        streamUrl.startsWith("rtsp://") ||
        /\.(m3u8|m3u|ts|mp4|mkv|flv|avi|mov|webm)(\?.*)?$/i.test(streamUrl) ||
        /\/live\/|\/play\/|\/stream\/|\/get\.php/i.test(streamUrl)
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
            category: "Entertainment",
            isActive: true,
          };
        }

        currentChannel.streamUrl = streamUrl;
        pushChannelItem(currentChannel);
        currentChannel = null;
        customUserAgent = "";
        customReferer = "";
      }
    }
  }

  // Fallback: If 0 channels were parsed, parse any line containing http:// or https:// as a channel URL
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
        } catch (e) {}

        const chName = name.charAt(0).toUpperCase() + name.slice(1);
        parsedChannels.push({
          id: `ch-m3u-${autoNumber}-${Date.now()}`,
          name: chName,
          category: "Entertainment",
          channelNumber: parsedChannels.length,
          streamUrl: line,
          logo: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=100",
          isPremium: classifyIsPremium(chName, "Entertainment"),
          isActive: true,
        });
        categoriesSet.add("Entertainment");
      }
    }
  }

  function pushChannelItem(ch: Partial<Channel>) {
    const chName = ch.name || `Channel ${autoNumber + 1}`;
    let category = ch.category || "Entertainment";
    const streamUrl = ch.streamUrl || "";
    if (!streamUrl) return;

    const lowerName = chName.toLowerCase();
    const cleanUrl = streamUrl.split("|")[0].toLowerCase();

    // Adult content tag handling
    if (isAdultContent(chName, category)) {
      category = "Adult (18+)";
      categoriesSet.add("Adult (18+)");
    }

    if (seenUrls.has(cleanUrl)) return;
    seenUrls.add(cleanUrl);
    seenNames.add(lowerName);

    const fullChannel: Channel = {
      id: `ch-m3u-${autoNumber + 1}-${Math.random().toString(36).substring(2, 7)}`,
      name: chName,
      logo: ch.logo || "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=100",
      category: category,
      channelNumber: ch.channelNumber !== undefined ? ch.channelNumber : autoNumber,
      streamUrl: streamUrl,
      isPremium: classifyIsPremium(chName, category),
      isActive: true,
      tvgId: ch.tvgId,
    };

    parsedChannels.push(fullChannel);
    categoriesSet.add(category);
    autoNumber++;
  }

  return {
    channels: parsedChannels,
    categories: Array.from(categoriesSet),
    totalParsed: parsedChannels.length,
  };
}

export function getStoredChannelsDirect(): Channel[] {
  try {
    const isCleared = localStorage.getItem("myiptv_channels_cleared");
    if (isCleared === "true") {
      return [];
    }

    let deletedIds = new Set<string>();
    try {
      const deletedStr = localStorage.getItem("myiptv_deleted_channel_ids");
      if (deletedStr) {
        deletedIds = new Set(JSON.parse(deletedStr));
      }
    } catch (e) {}

    const local = localStorage.getItem("myiptv_custom_channels");
    if (local !== null) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((c) => c && !deletedIds.has(c.id) && !deletedIds.has(c.name));
      }
    }

    return [];
  } catch (e) {
    return [];
  }
}

export async function deleteChannelDirect(id: string) {
  try {
    let deletedIds = new Set<string>();
    try {
      const deletedStr = localStorage.getItem("myiptv_deleted_channel_ids");
      if (deletedStr) {
        deletedIds = new Set(JSON.parse(deletedStr));
      }
    } catch (e) {}

    deletedIds.add(id);
    localStorage.setItem(
      "myiptv_deleted_channel_ids",
      JSON.stringify(Array.from(deletedIds)),
    );

    const current = getStoredChannelsDirect();
    const updated = current.filter((c) => c.id !== id);
    await saveChannelsDirect(updated);
  } catch (e) {
    console.warn("deleteChannelDirect error:", e);
  }
}

export async function clearAllChannelsDirect() {
  try {
    localStorage.setItem("myiptv_channels_cleared", "true");
    localStorage.setItem("myiptv_custom_channels", "[]");
    await saveChannelsDirect([], "cleared");
  } catch (e) {
    console.warn("clearAllChannelsDirect error:", e);
  }
}

export async function restoreDefaultChannelsDirect(): Promise<Channel[]> {
  try {
    localStorage.removeItem("myiptv_channels_cleared");
    localStorage.removeItem("myiptv_deleted_channel_ids");
    await saveChannelsDirect(INITIAL_CHANNELS as Channel[], "default");
    return INITIAL_CHANNELS as Channel[];
  } catch (e) {
    return INITIAL_CHANNELS as Channel[];
  }
}

export async function saveChannelsDirect(
  channels: Channel[],
  sourceType: string = "m3u_text",
  sourceUrl: string = "",
) {
  try {
    if (channels.length > 0) {
      localStorage.removeItem("myiptv_channels_cleared");
    }
    localStorage.setItem("myiptv_custom_channels", JSON.stringify(channels));
    localStorage.setItem(
      "myiptv_playlist_source",
      JSON.stringify({
        type: sourceType,
        url: sourceUrl,
        lastSyncedAt: new Date().toISOString(),
        totalChannels: channels.length,
      }),
    );
  } catch (e) {}

  try {
    if (db) {
      const { doc, setDoc, getDocs, collection, writeBatch, deleteDoc } = await import("firebase/firestore");

      // Delete old channel chunks
      try {
        const chunksColl = collection(db, "channel_chunks");
        const existingSnap = await getDocs(chunksColl);
        if (!existingSnap.empty) {
          let batch = writeBatch(db);
          let count = 0;
          for (const d of existingSnap.docs) {
            batch.delete(d.ref);
            count++;
            if (count >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              count = 0;
            }
          }
          if (count > 0) {
            await batch.commit();
          }
        }
      } catch (e) {
        console.warn("Error cleaning old channel chunks in client:", e);
      }

      try {
        await deleteDoc(doc(db, "settings", "channelsList"));
      } catch (e) {}

      // Persist channels in chunks of 100 in parallel batches of 8
      const chunkSize = 100;
      const totalChunks = Math.ceil(channels.length / chunkSize);
      const chunkTasks: Promise<void>[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = start + chunkSize;
        const chunkChannels = channels.slice(start, end);

        chunkTasks.push(
          setDoc(doc(db, "channel_chunks", `chunk_${i}`), {
            chunkIndex: i,
            channels: chunkChannels,
            updatedAt: new Date().toISOString(),
          }),
        );
      }

      // Execute chunk writes in batches
      for (let i = 0; i < chunkTasks.length; i += 8) {
        await Promise.all(chunkTasks.slice(i, i + 8));
      }

      await setDoc(doc(db, "settings", "playlistSource"), {
        type: sourceType,
        url: sourceUrl,
        lastSyncedAt: new Date().toISOString(),
        totalChannels: channels.length,
      });

      await setDoc(doc(db, "settings", "channelsMeta"), {
        totalChannels: channels.length,
        totalChunks,
        lastSyncedAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.warn("Direct Firestore channel save skipped/error:", e);
  }
}
