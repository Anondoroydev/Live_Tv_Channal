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
  let currentChannel: Partial<Channel> | null = null;
  let autoNumber = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#EXTM3U")) continue;

    if (line.startsWith("#EXTINF:")) {
      let tvgName = "";
      let tvgLogo = "";
      let groupTitle = "Entertainment";
      let channelNumber: number | undefined;

      const tvgNameMatch = line.match(/tvg-name="([^"]+)"/i) || line.match(/tvg-name=([^\s,]+)/i);
      if (tvgNameMatch) tvgName = tvgNameMatch[1].trim();

      const tvgLogoMatch = line.match(/tvg-logo="([^"]+)"/i) || line.match(/tvg-logo=([^\s,]+)/i);
      if (tvgLogoMatch) tvgLogo = tvgLogoMatch[1].trim();

      const groupMatch = line.match(/group-title="([^"]+)"/i) || line.match(/group-title=([^\s,]+)/i);
      if (groupMatch) groupTitle = groupMatch[1].trim();

      const tvgChnoMatch = line.match(/tvg-chno="?(\d+)"?/i) || line.match(/channel-id="?(\d+)"?/i);
      if (tvgChnoMatch) channelNumber = parseInt(tvgChnoMatch[1], 10);

      const commaIndex = line.lastIndexOf(",");
      let rawDisplayName = commaIndex !== -1 ? line.substring(commaIndex + 1).trim() : "";
      rawDisplayName = rawDisplayName.replace(/\r/g, "").trim();

      const finalName = rawDisplayName || tvgName || `Channel ${autoNumber + 1}`;
      if (!groupTitle || groupTitle === "Undefined" || groupTitle === "Unknown") {
        groupTitle = "Entertainment";
      }

      currentChannel = {
        name: finalName,
        logo: tvgLogo || "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=100",
        category: groupTitle,
        channelNumber: channelNumber !== undefined ? channelNumber : autoNumber,
        isPremium: classifyIsPremium(finalName, groupTitle),
        isActive: true,
      };
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
        streamUrl.startsWith("rtsp://")
      ) {
        if (!seenUrls.has(streamUrl)) {
          seenUrls.add(streamUrl);
          const chName = currentChannel?.name || `Live Stream ${autoNumber + 1}`;
          const chCat = currentChannel?.category || "Entertainment";

          const fullChannel: Channel = {
            id: `ch-m3u-${autoNumber}-${Date.now()}`,
            name: chName,
            logo: currentChannel?.logo || "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=100",
            category: chCat,
            channelNumber: currentChannel?.channelNumber !== undefined ? currentChannel.channelNumber : autoNumber,
            streamUrl: streamUrl,
            isPremium: classifyIsPremium(chName, chCat),
            isActive: true,
          };

          parsedChannels.push(fullChannel);
          categoriesSet.add(chCat);
          autoNumber++;
        }
      }
      currentChannel = null;
    }
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
      if (Array.isArray(parsed)) {
        return parsed.filter((c) => !deletedIds.has(c.id) && !deletedIds.has(c.name));
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
      const { doc, setDoc, getDocs, collection, writeBatch } = await import("firebase/firestore");
      
      // Delete existing chunks and fallback legacy doc first to prevent dirty state
      const chunksColl = collection(db, "channel_chunks");
      const existingSnap = await getDocs(chunksColl);
      const batch = writeBatch(db);
      
      existingSnap.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      try {
        batch.delete(doc(db, "settings", "channelsList"));
      } catch (e) {}
      
      await batch.commit();

      // Persist channels in chunks of 100
      const chunkSize = 100;
      const totalChunks = Math.ceil(channels.length / chunkSize);
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = start + chunkSize;
        const chunkChannels = channels.slice(start, end);
        
        await setDoc(doc(db, "channel_chunks", `chunk_${i}`), {
          chunkIndex: i,
          channels: chunkChannels,
          updatedAt: new Date().toISOString(),
        });
      }

      await setDoc(doc(db, "settings", "playlistSource"), {
        type: sourceType,
        url: sourceUrl,
        lastSyncedAt: new Date().toISOString(),
        totalChannels: channels.length,
      });
    }
  } catch (e) {
    console.warn("Direct Firestore channel save skipped/error:", e);
  }
}
