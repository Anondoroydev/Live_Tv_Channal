import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import mpegts from "mpegts.js";
import * as dashjs from "dashjs";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Lock,
  RefreshCw,
  Sliders,
  Sparkles,
  Info,
  Tv,
  CheckCircle,
  AlertTriangle,
  Terminal,
  Activity,
  Copy,
  Trash2,
  Layers,
  Settings2,
  Radio,
  FileText,
  X,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import { Channel, EPGProgram, User, ThemeId, LogEntry, StreamType } from "../types";
import { THEMES } from "./ThemeSelector";
import { calculateEpgProgress } from "../utils/epgUtils";

function createDummySourceBuffer() {
  const eventTarget = new EventTarget();
  let updating = false;
  let mode = "segments";
  let timestampOffset = 0;
  let appendWindowStart = 0;
  let appendWindowEnd = Infinity;

  const dummyTimeRanges = {
    length: 0,
    start: (_i: number) => 0,
    end: (_i: number) => 0,
  };

  const dummySb: any = {
    __isDummy: true,
    get updating() { return updating; },
    get buffered() { return dummyTimeRanges; },
    get mode() { return mode; },
    set mode(val) { mode = val; },
    get timestampOffset() { return timestampOffset; },
    set timestampOffset(val) { timestampOffset = val; },
    get appendWindowStart() { return appendWindowStart; },
    set appendWindowStart(val) { appendWindowStart = val; },
    get appendWindowEnd() { return appendWindowEnd; },
    set appendWindowEnd(val) { appendWindowEnd = val; },

    onupdatestart: null,
    onupdate: null,
    onupdateend: null,
    onerror: null,
    onabort: null,

    addEventListener: (type: string, listener: any, options?: any) => {
      eventTarget.addEventListener(type, listener, options);
    },
    removeEventListener: (type: string, listener: any, options?: any) => {
      eventTarget.removeEventListener(type, listener, options);
    },
    dispatchEvent: (event: Event) => {
      return eventTarget.dispatchEvent(event);
    },

    appendBuffer: (_data: any) => {
      updating = true;
      if (typeof dummySb.onupdatestart === "function") {
        try { dummySb.onupdatestart(new Event("updatestart")); } catch (e) {}
      }
      eventTarget.dispatchEvent(new Event("updatestart"));

      setTimeout(() => {
        updating = false;
        if (typeof dummySb.onupdate === "function") {
          try { dummySb.onupdate(new Event("update")); } catch (e) {}
        }
        eventTarget.dispatchEvent(new Event("update"));

        if (typeof dummySb.onupdateend === "function") {
          try { dummySb.onupdateend(new Event("updateend")); } catch (e) {}
        }
        eventTarget.dispatchEvent(new Event("updateend"));
      }, 0);
    },

    remove: (_start: number, _end: number) => {
      updating = true;
      setTimeout(() => {
        updating = false;
        if (typeof dummySb.onupdateend === "function") {
          try { dummySb.onupdateend(new Event("updateend")); } catch (e) {}
        }
        eventTarget.dispatchEvent(new Event("updateend"));
      }, 0);
    },

    abort: () => {
      updating = false;
    },

    changeType: (_type: string) => {},
  };

  if (typeof window !== "undefined" && window.SourceBuffer) {
    try {
      Object.setPrototypeOf(dummySb, SourceBuffer.prototype);
    } catch (e) {}
  }

  return dummySb;
}

if (typeof window !== "undefined" && window.MediaSource && !(window as any).__mediaSourceAc3Patched) {
  (window as any).__mediaSourceAc3Patched = true;
  const originalAddSourceBuffer = MediaSource.prototype.addSourceBuffer;
  const originalRemoveSourceBuffer = MediaSource.prototype.removeSourceBuffer;

  MediaSource.prototype.addSourceBuffer = function (type: string) {
    if (type && !MediaSource.isTypeSupported(type)) {
      console.warn(`[MediaSource Guard] Intercepted unsupported codec in addSourceBuffer: '${type}'. Providing fallback dummy SourceBuffer.`);
      return createDummySourceBuffer();
    }
    try {
      return originalAddSourceBuffer.call(this, type);
    } catch (err: any) {
      console.warn(`[MediaSource Guard] addSourceBuffer failed for '${type}': ${err.message}. Providing fallback dummy SourceBuffer.`);
      return createDummySourceBuffer();
    }
  };

  MediaSource.prototype.removeSourceBuffer = function (sb: any) {
    if (sb && sb.__isDummy) {
      console.warn(`[MediaSource Guard] Intercepted removeSourceBuffer for dummy SourceBuffer.`);
      return;
    }
    try {
      return originalRemoveSourceBuffer.call(this, sb);
    } catch (err: any) {
      console.warn(`[MediaSource Guard] removeSourceBuffer safely caught error: ${err.message}`);
    }
  };
}

if (typeof window !== "undefined" && window.SourceBuffer && !(window as any).__sourceBufferGuarded) {
  (window as any).__sourceBufferGuarded = true;
  const origAppendBuffer = SourceBuffer.prototype.appendBuffer;
  SourceBuffer.prototype.appendBuffer = function (data: any) {
    try {
      return origAppendBuffer.call(this, data);
    } catch (err: any) {
      console.warn(`[SourceBuffer Guard] appendBuffer safely caught error: ${err.message}`);
    }
  };

  const origAddEventListener = SourceBuffer.prototype.addEventListener;
  SourceBuffer.prototype.addEventListener = function (type: string, listener: any, options?: any) {
    if (type === "error") {
      const wrappedListener = function (this: any, event: Event) {
        console.warn(`[SourceBuffer Guard] Caught SourceBuffer error event gracefully.`);
        if (typeof listener === "function") {
          try {
            listener.call(this, event);
          } catch (e) {
            console.warn(`[SourceBuffer Guard] Error in SourceBuffer error listener:`, e);
          }
        }
      };
      return origAddEventListener.call(this, type, wrappedListener, options);
    }
    return origAddEventListener.call(this, type, listener, options);
  };

  const origBufferedDesc = Object.getOwnPropertyDescriptor(SourceBuffer.prototype, "buffered");
  if (origBufferedDesc && origBufferedDesc.get) {
    Object.defineProperty(SourceBuffer.prototype, "buffered", {
      get: function () {
        try {
          return origBufferedDesc.get!.call(this);
        } catch (err: any) {
          return {
            length: 0,
            start: () => 0,
            end: () => 0,
          };
        }
      },
      configurable: true,
      enumerable: true,
    });
  }
}

interface VideoPlayerProps {
  channel: Channel | null;
  currentEpg?: EPGProgram | null;
  nextEpg?: EPGProgram | null;
  currentUser: User | null;
  onPrevChannel: () => void;
  onNextChannel: () => void;
  onOpenLogin: () => void;
  onOpenSubscription: () => void;
  autoPlay?: boolean;
  autoReconnect?: boolean;
  currentTheme?: ThemeId;
  allChannels?: Channel[];
  onSelectChannel?: (channel: Channel) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  channel,
  currentEpg,
  nextEpg,
  currentUser,
  onPrevChannel,
  onNextChannel,
  onOpenLogin,
  onOpenSubscription,
  autoPlay = true,
  autoReconnect = true,
  currentTheme = "gold",
  allChannels = [],
  onSelectChannel,
}) => {
  const theme = THEMES[currentTheme] || THEMES.gold;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem("isMuted");
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem("volume");
    return saved !== null ? JSON.parse(saved) : 1;
  });

  useEffect(() => {
    localStorage.setItem("isMuted", JSON.stringify(isMuted));
    localStorage.setItem("volume", JSON.stringify(volume));
  }, [isMuted, volume]);

  const changeVolume = (delta: number) => {
    setVolume((prev) => {
      let newVol = prev + delta;
      if (newVol > 1) newVol = 1;
      if (newVol < 0) newVol = 0;
      if (newVol > 0) setIsMuted(false);
      return newVol;
    });
  };
  const [isBuffering, setIsBuffering] = useState(false);
  const [showBufferSpinner, setShowBufferSpinner] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioTracks, setAudioTracks] = useState<
    { id: number; name: string }[]
  >([]);
  const [selectedAudio, setSelectedAudio] = useState<number>(0);
  const [retryCount, setRetryCount] = useState(0);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [overrideStreamUrl, setOverrideStreamUrl] = useState<string | null>(null);
  const [prevChannel, setPrevChannel] = useState<{ id?: string | number; streamUrl?: string } | null>(null);
  const MAX_RETRIES = 5;

  // Stream Engine & Diagnostics State
  const [forcedEngine, setForcedEngine] = useState<"auto" | "hls" | "dash" | "ts" | "native">("auto");
  const [detectedStreamType, setDetectedStreamType] = useState<StreamType>("hls");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [logFilter, setLogFilter] = useState<string>("all");

  const playerRef = useRef<any>(null);
  const hlsPlayerRef = useRef<Hls | null>(null);
  const dashPlayerRef = useRef<any>(null);
  const mpegtsPlayerRef = useRef<any>(null);
  const hlsAttemptsRef = useRef<{ triedProxy: boolean; triedDirect: boolean; triedMpegTs: boolean; triedHls: boolean; triedBackup: boolean }>({
    triedProxy: false,
    triedDirect: false,
    triedMpegTs: false,
    triedHls: false,
    triedBackup: false,
  });

  const currentChanKey = channel ? { id: channel.id, streamUrl: channel.streamUrl } : null;
  const isChanChanged = (channel && !prevChannel) || 
                       (!channel && prevChannel) || 
                       (channel && prevChannel && (channel.id !== prevChannel.id || channel.streamUrl !== prevChannel.streamUrl));

  if (isChanChanged) {
    setPrevChannel(currentChanKey);
    setOverrideStreamUrl(null);
    hlsAttemptsRef.current = {
      triedProxy: false,
      triedDirect: false,
      triedMpegTs: false,
      triedHls: false,
      triedBackup: false,
    };
  }

  const activePlayPromiseRef = useRef<Promise<void> | null>(null);
  const isUserPausedRef = useRef<boolean>(false);
  const playVideoRef = useRef<() => void>(() => {});

  // Real-time Diagnostic Logger (VLC-style)
  const addLog = (
    level: LogEntry["level"],
    category: LogEntry["category"],
    message: string,
    details?: string
  ) => {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + String(new Date().getMilliseconds()).padStart(3, '0'),
      level,
      category,
      message,
      details,
    };
    setLogs((prev) => [entry, ...prev.slice(0, 199)]);
    if (level === "error") {
      // Direct stream errors that are automatically recovered should be logged as warnings/info to avoid false positive diagnostic alerts
      const isRecoverableStreamEvent = 
        message.includes("MPEG-TS Error") || 
        message.includes("HttpStatusCodeInvalid") || 
        message.includes("DASH.js Error") || 
        message.includes("Native HTML5") || 
        message.includes("watchdog timed out") ||
        message.includes("attach error");

      if (isRecoverableStreamEvent) {
        console.warn(`[IPTV Diagnostic] [${category}] Stream issue (recovering): ${message}`, details || "");
      } else {
        console.error(`[IPTV Diagnostic] [${category}] ${message}`, details || "");
      }
    } else if (level === "warn") {
      console.warn(`[IPTV Diagnostic] [${category}] ${message}`, details || "");
    } else {
      console.log(`[IPTV Diagnostic] [${category}] ${message}`, details || "");
    }
  };

  // Thorough Player Destruction to Guarantee Memory Leak Prevention
  const destroyCurrentPlayer = () => {
    // 1. Destroy HLS.js
    if (hlsPlayerRef.current) {
      try {
        hlsPlayerRef.current.detachMedia();
        hlsPlayerRef.current.destroy();
      } catch (e) {
        console.warn("HLS destroy caught:", e);
      }
      hlsPlayerRef.current = null;
    }

    // 2. Destroy Dash.js
    if (dashPlayerRef.current) {
      try {
        dashPlayerRef.current.reset();
      } catch (e) {
        console.warn("DASH reset caught:", e);
      }
      dashPlayerRef.current = null;
    }

    // 3. Destroy MPEG-TS
    if (mpegtsPlayerRef.current) {
      try {
        mpegtsPlayerRef.current.unload();
        mpegtsPlayerRef.current.detachMediaElement();
        mpegtsPlayerRef.current.destroy();
      } catch (e) {
        console.warn("MPEG-TS destroy caught:", e);
      }
      mpegtsPlayerRef.current = null;
    }

    // Generic playerRef cleanup
    if (playerRef.current && typeof playerRef.current.destroy === "function") {
      try {
        playerRef.current.destroy();
      } catch (e) {}
      playerRef.current = null;
    }

    // Reset video tag
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
        v.removeAttribute("src");
        v.load();
        v.onloadedmetadata = null;
        v.onerror = null;
        v.onwaiting = null;
        v.onplaying = null;
      } catch (e) {}
    }
  };

  const safePause = (v?: HTMLVideoElement | null) => {
    const targetVideo = v || videoRef.current;
    if (!targetVideo) return;
    const currentPromise = activePlayPromiseRef.current;
    if (currentPromise) {
      currentPromise
        .then(() => {
          try { targetVideo.pause(); } catch (e) {}
        })
        .catch(() => {
          try { targetVideo.pause(); } catch (e) {}
        });
    } else {
      try { targetVideo.pause(); } catch (e) {}
    }
  };
  const [epgProgress, setEpgProgress] = useState<number>(() =>
    calculateEpgProgress(currentEpg),
  );
  const [bufferedPercent, setBufferedPercent] = useState<number>(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs)) return "00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const mStr = String(m).padStart(2, "0");
    const sStr = String(s).padStart(2, "0");
    if (h > 0) {
      return `${h}:${mStr}:${sStr}`;
    }
    return `${mStr}:${sStr}`;
  };

  useEffect(() => {
    setVideoCurrentTime(0);
    setVideoDuration(0);
  }, [channel]);

  const isChannelVOD = 
    (channel?.category || "").toLowerCase().includes("vod") ||
    (channel?.category || "").toLowerCase().includes("series") ||
    (channel?.category || "").toLowerCase().includes("movie") ||
    (channel?.category || "").toLowerCase().includes("cinema") ||
    (channel?.category || "").toLowerCase().includes("drama") ||
    (channel?.id || "").toString().includes("curated-");

  const isVOD = (videoDuration > 0 && isFinite(videoDuration)) || isChannelVOD;

  // TV remote & direct channel number entry states
  const [numberBuffer, setNumberBuffer] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(2);
  const bufferTimerRef = useRef<NodeJS.Timeout | null>(null);
  const spinnerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Listen to fullscreen changes dynamically to stay 100% in sync
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const [streamProxyEnabled, setStreamProxyEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("myiptv_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.streamProxyEnabled !== undefined) {
          return parsed.streamProxyEnabled;
        }
      }
    } catch (e) {}
    return true;
  });

  useEffect(() => {
    const handleSettingsUpdate = (e: any) => {
      const updatedSettings = e.detail;
      if (updatedSettings && updatedSettings.streamProxyEnabled !== undefined) {
        setStreamProxyEnabled(updatedSettings.streamProxyEnabled);
      }
    };
    window.addEventListener("myiptv_settings_updated", handleSettingsUpdate);
    return () => {
      window.removeEventListener("myiptv_settings_updated", handleSettingsUpdate);
    };
  }, []);

  // Ref for stable callbacks/data
  const allChannelsRef = useRef(allChannels);
  const onSelectChannelRef = useRef(onSelectChannel);

  useEffect(() => {
    allChannelsRef.current = allChannels;
    onSelectChannelRef.current = onSelectChannel;
  }, [allChannels, onSelectChannel]);

  // Auto-switch channel after typing number
  useEffect(() => {
    if (!numberBuffer) {
      if (countdownIntervalRef.current)
        clearInterval(countdownIntervalRef.current);
      setCountdown(0);
      return;
    }

    setCountdown(3);

    if (countdownIntervalRef.current)
      clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    const timeout = setTimeout(() => {
      const finalNum = parseInt(numberBuffer, 10);
      const finalTarget = allChannelsRef.current.find(
        (c) => c.channelNumber === finalNum,
      );
      if (finalTarget && onSelectChannelRef.current) {
        onSelectChannelRef.current(finalTarget);
      }
      setNumberBuffer("");
    }, 3500); // 3.5 seconds to allow for 3+ digit entries

    return () => {
      clearTimeout(timeout);
      if (countdownIntervalRef.current)
        clearInterval(countdownIntervalRef.current);
    };
  }, [numberBuffer]);

  // Keyboard and Remote Event Listener for Direct Channel Tuning & Arrow Keys CH+/CH-
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore typing inside text inputs
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // Check numbers 0-9
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        setNumberBuffer((prev) => (prev + e.key).slice(-4)); // max 4 digits
        return;
      }

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          onNextChannel();
          break;
        case "ArrowDown":
          e.preventDefault();
          onPrevChannel();
          break;
        case "ArrowRight":
        case "+":
        case "=":
          e.preventDefault();
          if (videoRef.current && isFinite(videoRef.current.duration) && videoRef.current.duration > 0) {
            videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 10);
          } else {
            window.dispatchEvent(
              new CustomEvent("volume-change", { detail: 0.1 }),
            );
          }
          break;
        case "ArrowLeft":
        case "-":
        case "_":
          e.preventDefault();
          if (videoRef.current && isFinite(videoRef.current.duration) && videoRef.current.duration > 0) {
            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
          } else {
            window.dispatchEvent(
              new CustomEvent("volume-change", { detail: -0.1 }),
            );
          }
          break;
        case "Enter":
          setNumberBuffer((prev) => {
            if (prev) {
              const num = parseInt(prev, 10);
              const target = allChannels.find((c) => c.channelNumber === num);
              if (target && onSelectChannel) {
                onSelectChannel(target);
              }
            }
            return "";
          });
          break;
        case "Backspace":
        case "Escape":
          setNumberBuffer("");
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [allChannels, onSelectChannel, onNextChannel, onPrevChannel]);

  // Listen to custom volume events to avoid dependency issues
  useEffect(() => {
    const handleVolChange = (e: any) => {
      setVolume((prev) => {
        let newVol = prev + e.detail;
        if (newVol > 1) newVol = 1;
        if (newVol < 0) newVol = 0;
        if (newVol > 0) setIsMuted(false);
        return newVol;
      });
    };
    window.addEventListener("volume-change", handleVolChange);
    return () => window.removeEventListener("volume-change", handleVolChange);
  }, []);

  // Dynamic live program & buffer progress interval
  useEffect(() => {
    const updateProgress = () => {
      setEpgProgress(calculateEpgProgress(currentEpg));

      if (videoRef.current) {
        const v = videoRef.current;
        if (v.buffered && v.buffered.length > 0) {
          const bufferedEnd = v.buffered.end(v.buffered.length - 1);
          if (v.duration && isFinite(v.duration) && v.duration > 0) {
            setBufferedPercent(
              Math.min(100, Math.round((bufferedEnd / v.duration) * 100)),
            );
          } else {
            const bufSecs = Math.max(0, bufferedEnd - v.currentTime);
            const pct = Math.min(
              100,
              Math.max(10, Math.round((bufSecs / 12) * 100)),
            );
            setBufferedPercent(pct);
          }
        }
      }
    };

    updateProgress();
    const timer = setInterval(updateProgress, 1000);
    return () => clearInterval(timer);
  }, [currentEpg]);

  // Delay the visual rendering of the buffering spinner by 1200ms
  // to avoid flashing/flickering on fast stream switching and give an instant-load feeling
  useEffect(() => {
    if (isBuffering) {
      const t = setTimeout(() => {
        setShowBufferSpinner(true);
      }, 1200);
      return () => clearTimeout(t);
    } else {
      setShowBufferSpinner(false);
    }
  }, [isBuffering]);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto hide controls after 4 seconds
  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 6000);
  };

  const [unlockedChannels, setUnlockedChannels] = useState<Record<string, boolean>>({});

  // Check if current user is allowed to watch this channel
  const isSubscriptionActive =
    !!currentUser &&
    (currentUser.role === "admin" ||
      (currentUser.subscriptionPlan !== "Free" &&
        currentUser.subscriptionPlan !== "Expired" &&
        (!currentUser.subscriptionExpiresAt ||
          new Date(currentUser.subscriptionExpiresAt).getTime() > Date.now())));

  const isPremiumLocked =
    channel?.isPremium && !isSubscriptionActive && !unlockedChannels[channel?.id || ""];

  // Smart Background Preloading and DNS Prefetching for Adjacent Channels
  // Disabled due to potential network congestion on unstable connections
  /*
  useEffect(() => {
    if (!channel || !allChannels || allChannels.length === 0) return;

    // Debounce the preloading for 400 milliseconds to instantly prewarm adjacent channels while browsing
    const prewarmTimer = setTimeout(() => {
      try {
        const currentIdx = allChannels.findIndex((c) => c.id === channel.id);
        if (currentIdx === -1) return;

        // Determine adjacent channel indices (next and previous)
        const nextIdx = (currentIdx + 1) % allChannels.length;
        const prevIdx = (currentIdx - 1 + allChannels.length) % allChannels.length;

        const adjacentChannels = [allChannels[nextIdx], allChannels[prevIdx]].filter(
          (c) => c && c.id !== channel.id && !c.isPremium
        );

        adjacentChannels.forEach((adjChannel) => {
          let targetUrl = adjChannel.streamUrl;
          if (!targetUrl) return;

          const needsProxy = targetUrl.startsWith("http://") || targetUrl.startsWith("https://");

          let effectiveUrl = "";
          if (needsProxy) {
            if (targetUrl.includes("|")) {
              const parts = targetUrl.split("|");
              effectiveUrl = `/api/proxy-stream?url=${encodeURIComponent(parts[0])}&headers=${encodeURIComponent(parts[1])}`;
            } else {
              effectiveUrl = `/api/proxy-stream?url=${encodeURIComponent(targetUrl)}`;
            }
          } else {
            effectiveUrl = targetUrl;
          }

          if (effectiveUrl) {
            console.log(`[Smart Preload] Pre-warming adjacent channel "${adjChannel.name}" via path:`, effectiveUrl);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);
            fetch(effectiveUrl, { signal: controller.signal, priority: "low" } as any)
              .then((r) => {
                clearTimeout(timeoutId);
                try { r.body?.cancel(); } catch (e) {}
              })
              .catch(() => {
                clearTimeout(timeoutId);
              });
          }
        });
      } catch (err) {
        console.warn("[Smart Preload] Failed to prewarm adjacent channels:", err);
      }
    }, 400);

    return () => clearTimeout(prewarmTimer);
  }, [channel, allChannels]);
  */

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !channel || isPremiumLocked) {
      destroyCurrentPlayer();
      return;
    }

    // Instantly destroy previous player instances & reset video element for zero memory leaks
    destroyCurrentPlayer();
    isUserPausedRef.current = false;

    setErrorMsg(null);
    setRetryCount(0);
    setIsBuffering(true);
    setShowBufferSpinner(false);

    let isCancelled = false;

    const getAbsoluteUrl = (path: string) => {
      if (!path) return "";
      if (
        path.startsWith("http://") ||
        path.startsWith("https://") ||
        path.startsWith("data:") ||
        path.startsWith("blob:")
      ) {
        return path;
      }
      return `${window.location.origin}${path.startsWith("/") ? "" : "/"}${path}`;
    };

    const getEffectiveUrl = (rawUrl: string, forceDirect = false) => {
      if (!rawUrl) return "";
      if (
        rawUrl.startsWith("/api/") ||
        rawUrl.startsWith("data:") ||
        rawUrl.startsWith("blob:")
      ) {
        return getAbsoluteUrl(rawUrl);
      }
      
      const isHttpsPage = typeof window !== "undefined" && window.location.protocol === "https:";
      const isHttpStream = rawUrl.startsWith("http://");
      if ((streamProxyEnabled || (isHttpsPage && isHttpStream)) && !forceDirect && (rawUrl.startsWith("http://") || rawUrl.startsWith("https://"))) {
        if (rawUrl.includes("/api/proxy-stream")) return getAbsoluteUrl(rawUrl);
        if (rawUrl.includes("|")) {
          const parts = rawUrl.split("|");
          const url = parts[0];
          const headers = parts.slice(1).join("|");
          return getAbsoluteUrl(`/api/proxy-stream?url=${encodeURIComponent(url)}&headers=${encodeURIComponent(headers)}`);
        }
        return getAbsoluteUrl(`/api/proxy-stream?url=${encodeURIComponent(rawUrl)}`);
      }
      return rawUrl;
    };

    let currentEffectiveUrl = overrideStreamUrl || getEffectiveUrl(channel.streamUrl);

    // Auto-detect stream type
    const rawStreamUrl = overrideStreamUrl || channel.streamUrl;
    const urlLower = rawStreamUrl.toLowerCase().split("|")[0];
    let detectedType: StreamType = channel.streamType || "hls";
    if (overrideStreamUrl) {
      detectedType = "hls"; // Backup stream is always HLS (.m3u8)
    } else if (urlLower.includes(".mpd") || urlLower.includes("/dash/")) {
      detectedType = "dash";
    } else if (urlLower.includes(".m3u8") || urlLower.includes("/hls/")) {
      detectedType = "hls";
    } else if (
      urlLower.includes(".ts") ||
      urlLower.includes("/ts/") ||
      urlLower.endsWith("/ts") ||
      urlLower.includes("/ts?") ||
      urlLower.includes("output=ts") ||
      urlLower.includes("type=ts")
    ) {
      detectedType = "ts";
    } else if (/\.(mp4|webm|mkv|avi|flv|mov|3gp|m4v)(\?.*)?$/i.test(urlLower)) {
      detectedType = "direct";
    }
    setDetectedStreamType(detectedType);

    const attempts = hlsAttemptsRef.current;
    if (overrideStreamUrl) {
      // If we are playing an override backup stream, reset other attempt flags so it starts fresh
      attempts.triedProxy = false;
      attempts.triedDirect = false;
      attempts.triedMpegTs = false;
      attempts.triedHls = false;
    }

    addLog("info", "Detection", `Channel "${channel.name}" selected (CH.${channel.channelNumber})`, `URL: ${channel.streamUrl}`);
    addLog("info", "Proxy", streamProxyEnabled ? "Proxy routing active" : "Direct stream connection", `Effective URL: ${currentEffectiveUrl}`);
    addLog("info", "Detection", `Detected stream type: ${detectedType.toUpperCase()}`);

    const playVideo = () => {
      if (!video || isCancelled) return;
      if (isUserPausedRef.current) return;
      try {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          activePlayPromiseRef.current = playPromise;
          playPromise
            .then(() => {
              if (activePlayPromiseRef.current === playPromise) activePlayPromiseRef.current = null;
              if (!isCancelled) {
                setIsPlaying(true);
                setIsBuffering(false);
                addLog("success", "Player", "Playback running smoothly");
              }
            })
            .catch((err) => {
              if (activePlayPromiseRef.current === playPromise) activePlayPromiseRef.current = null;
              if (
                isCancelled ||
                err.name === "AbortError" ||
                (err.message && (err.message.includes("interrupted") || err.message.includes("pause")))
              ) {
                return;
              }
              addLog("warn", "Player", "Autoplay requires user interaction or muted audio", err?.message);
              if (!video || isCancelled) return;
              video.muted = true;
              setIsMuted(true);
              const retryPromise = video.play();
              if (retryPromise !== undefined) {
                activePlayPromiseRef.current = retryPromise;
                retryPromise
                  .then(() => {
                    if (activePlayPromiseRef.current === retryPromise) activePlayPromiseRef.current = null;
                    if (!isCancelled) {
                      setIsPlaying(true);
                      setIsBuffering(false);
                    }
                  })
                  .catch(() => {
                    if (activePlayPromiseRef.current === retryPromise) activePlayPromiseRef.current = null;
                  });
              }
            });
        }
      } catch (e) {}
    };
    playVideoRef.current = playVideo;

    // 1. DASH Engine Initialization
    function initDashJs() {
      destroyCurrentPlayer();
      addLog("info", "Player", `Initializing DASH.js engine for ${channel.name}`);

      try {
        const dashPlayer = dashjs.MediaPlayer().create();
        dashPlayerRef.current = dashPlayer;
        playerRef.current = dashPlayer;

        dashPlayer.updateSettings({
          streaming: {
            buffer: {
              fastSwitchEnabled: true,
              bufferToKeep: 20,
            },
            retryIntervals: { MPD: 2000 },
            retryAttempts: { MPD: 5 },
          },
        });

        dashPlayer.initialize(video, currentEffectiveUrl, autoPlay);

        dashPlayer.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
          if (isCancelled) return;
          addLog("success", "Player", "DASH Stream initialized successfully");
          setIsBuffering(false);
          setRetryCount(0);
          setErrorMsg(null);
        });

        dashPlayer.on(dashjs.MediaPlayer.events.PLAYBACK_STARTED, () => {
          if (isCancelled) return;
          addLog("info", "Player", "DASH Playback started");
          setIsPlaying(true);
          setIsBuffering(false);
        });

        dashPlayer.on(dashjs.MediaPlayer.events.ERROR, (e: any) => {
          if (isCancelled) return;
          const errorStr = e?.error ? `${e.error}: ${e.event?.message || ""}` : JSON.stringify(e || {});
          addLog("error", "Player", "DASH.js Error encountered", errorStr);

          if (retryCount < MAX_RETRIES) {
            addLog("warn", "Player", `Retrying DASH stream (${retryCount + 1}/${MAX_RETRIES})...`);
            setRetryCount((prev) => prev + 1);
            setTimeout(() => {
              if (!isCancelled) initDashJs();
            }, 3000);
          } else {
            addLog("warn", "Player", "Falling back from DASH to HLS engine...");
            initHlsJs();
          }
        });
      } catch (err: any) {
        addLog("error", "Player", "Failed to start DASH.js engine", err?.message);
        initHlsJs();
      }
    }

    // 2. HLS Engine Initialization
    function initHlsJs() {
      destroyCurrentPlayer();
      attempts.triedHls = true;

      if (!Hls.isSupported()) {
        addLog("warn", "Player", "HLS.js not supported. Falling back to native video player...");
        initNativeVideo();
        return;
      }

      addLog("info", "Player", `Initializing HLS.js engine for ${channel.name}`);

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 45,
        maxBufferLength: 25,
        maxMaxBufferLength: 45,
        maxBufferSize: 64 * 1024 * 1024,
        maxBufferHole: 0.8,
        highBufferWatchdogPeriod: 1.0,
        nudgeMaxRetry: 10,
        nudgeOffset: 0.1,
        liveSyncDurationCount: 5.0,
        liveMaxLatencyDurationCount: 20.0,
        liveDurationInfinity: true,
        startLevel: -1, // Auto-select best quality for user's network speed
        manifestLoadingTimeOut: 25000,
        levelLoadingTimeOut: 25000,
        fragLoadingTimeOut: 25000,
        fragLoadingMaxRetry: 10,
        manifestLoadingMaxRetry: 10,
        levelLoadingMaxRetry: 10,
        fragLoadingRetryDelay: 500,
        manifestLoadingRetryDelay: 500,
        levelLoadingRetryDelay: 500,
        capLevelToPlayerSize: true,
        testBandwidth: true,
        abrBandWidthFactor: 0.85,
        abrBandWidthUpFactor: 0.7,
        initialLiveManifestSize: 1, // Start playback instantly after 1 fragment
        progressive: true,
        startFragPrefetch: true,
      });

      hlsPlayerRef.current = hls;
      playerRef.current = hls;

      hls.attachMedia(video);
      hls.loadSource(currentEffectiveUrl);

      if (autoPlay) playVideo();

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        if (isCancelled) return;
        addLog(
          "success",
          "Player",
          `HLS Manifest parsed successfully (${data.levels.length} quality levels)`,
          `Levels: ${data.levels.map((l) => `${l.height}p`).join(", ")}`
        );
        setIsBuffering(false);
        setRetryCount(0);
        setErrorMsg(null);
        if (autoPlay) playVideo();

        if (hls.audioTracks) {
          const tracks = hls.audioTracks.map((t, idx) => ({
            id: idx,
            name: t.name || `Audio Track ${idx + 1}`,
          }));
          setAudioTracks(tracks);
        }
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        if (isCancelled) return;
        setIsBuffering(false);
        setRetryCount(0);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (isCancelled) return;
        const detailStr = String(data.details || "");
        const detailLower = detailStr.toLowerCase();
        const isParsingError =
          detailLower.includes("parsingerror") ||
          detailLower.includes("levelparsing") ||
          detailLower.includes("manifestparsing") ||
          detailStr === "manifestParsingError" ||
          detailStr === "levelParsingError" ||
          detailStr === "manifestIncompatibleCodecsError" ||
          detailStr === "fragParsingError";

        const isTimeoutOrNetworkError =
          detailLower.includes("timeout") ||
          detailStr === "manifestLoadTimeOut" ||
          detailStr === "manifestLoadError" ||
          detailStr === "levelLoadTimeOut" ||
          data.type === Hls.ErrorTypes.NETWORK_ERROR ||
          data.response?.code === 404;

        const isRecoverableError = isParsingError || isTimeoutOrNetworkError || data.type === Hls.ErrorTypes.MEDIA_ERROR;

        addLog(
          (data.fatal && !isRecoverableError) ? "error" : "warn",
          "Player",
          `HLS Error: ${detailStr}`,
          `Type: ${data.type}, HTTP Code: ${data.response?.code || "N/A"}`
        );

        if (isParsingError) {
          if (!attempts.triedProxy && streamProxyEnabled && !currentEffectiveUrl.includes("/api/proxy-stream")) {
            attempts.triedProxy = true;
            addLog("warn", "Proxy", `HLS parsing error (${detailStr}, HTTP ${data.response?.code || "N/A"}). Routing via CORS/M3U8 proxy...`);
            currentEffectiveUrl = getEffectiveUrl(channel.streamUrl, false);
            setTimeout(() => {
              if (!isCancelled) initHlsJs();
            }, 300);
            return;
          } else if (!attempts.triedDirect && currentEffectiveUrl.includes("/api/proxy-stream")) {
            attempts.triedDirect = true;
            addLog("warn", "Proxy", `HLS parsing error (${detailStr}) via proxy. Bypassing proxy and trying direct stream...`);
            currentEffectiveUrl = getEffectiveUrl(channel.streamUrl, true);
            setTimeout(() => {
              if (!isCancelled) initHlsJs();
            }, 300);
            return;
          } else if (!attempts.triedMpegTs) {
            attempts.triedMpegTs = true;
            addLog("warn", "Player", `HLS parsing failed (${detailStr}). Stream is likely raw TS/direct media. Switching to MPEG-TS engine...`);
            initMpegTs();
            return;
          } else if (!overrideStreamUrl && !attempts.triedBackup) {
            attempts.triedBackup = true;
            addLog("warn", "Player", `HLS parsing failed (${detailStr}). Auto-recovering using Live Backup Stream...`);
            setErrorMsg(null);
            setOverrideStreamUrl("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8");
            setRetryTrigger((prev) => prev + 1);
            return;
          } else {
            addLog("warn", "Player", `HLS parsing failed (${detailStr}). Falling back to Native HTML5 player...`);
            initNativeVideo();
            return;
          }
        }

        if (isTimeoutOrNetworkError) {
          const is404 = data.response?.code === 404;
          if (is404 && !overrideStreamUrl && !attempts.triedBackup) {
            attempts.triedBackup = true;
            addLog("warn", "Player", "HLS stream offline (HTTP 404). Auto-recovering using Live Backup Stream...");
            setErrorMsg(null);
            setOverrideStreamUrl("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8");
            setRetryTrigger((prev) => prev + 1);
            return;
          }

          if (!attempts.triedProxy && streamProxyEnabled && !currentEffectiveUrl.includes("/api/proxy-stream")) {
            attempts.triedProxy = true;
            addLog("warn", "Proxy", `HLS network error (${detailStr}, HTTP ${data.response?.code || "N/A"}). Routing via CORS/M3U8 proxy...`);
            currentEffectiveUrl = getEffectiveUrl(channel.streamUrl, false);
            setTimeout(() => {
              if (!isCancelled) initHlsJs();
            }, 300);
            return;
          } else if (!attempts.triedDirect && currentEffectiveUrl.includes("/api/proxy-stream")) {
            attempts.triedDirect = true;
            addLog("warn", "Proxy", `HLS network error (${detailStr}) via proxy. Bypassing proxy and trying direct stream...`);
            currentEffectiveUrl = getEffectiveUrl(channel.streamUrl, true);
            setTimeout(() => {
              if (!isCancelled) initHlsJs();
            }, 300);
            return;
          } else if (!overrideStreamUrl && !attempts.triedBackup) {
            attempts.triedBackup = true;
            addLog("warn", "Player", `HLS network error (${detailStr}). Auto-recovering using Live Backup Stream...`);
            setErrorMsg(null);
            setOverrideStreamUrl("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8");
            setRetryTrigger((prev) => prev + 1);
            return;
          } else if (!attempts.triedMpegTs) {
            attempts.triedMpegTs = true;
            addLog("warn", "Player", `HLS network error (${detailStr}). Switching to MPEG-TS engine...`);
            initMpegTs();
            return;
          } else {
            addLog("warn", "Player", `HLS network error failed (${detailStr}). Falling back to Native HTML5 player...`);
            initNativeVideo();
            return;
          }
        }

        if (detailStr === "bufferStalledError" || detailStr === "bufferNudgeOnStall") {
          addLog("warn", "Buffer", "Live stream buffer stall detected, resuming stream loading...");
          try {
            hls.startLoad();
          } catch (e) {}
          return;
        }

        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            if (currentEffectiveUrl.includes("/api/proxy-stream")) {
              addLog("warn", "Proxy", "HLS fatal network error. Bypassing proxy...");
              currentEffectiveUrl = getEffectiveUrl(channel.streamUrl, true);
              initHlsJs();
            } else if (retryCount < MAX_RETRIES) {
              addLog("warn", "Proxy", `Network fetch failed (${data.response?.code || "Offline"}). Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
              setErrorMsg(`Reconnecting to live stream (${retryCount + 1}/${MAX_RETRIES})...`);
              setRetryCount((prev) => prev + 1);
              setTimeout(() => {
                if (!isCancelled) {
                  setErrorMsg(null);
                  initHlsJs();
                }
              }, 2000);
            } else if (!overrideStreamUrl) {
              addLog("warn", "Player", "Source stream unavailable. Auto-recovering using Live Backup Stream...");
              setErrorMsg(null);
              setOverrideStreamUrl("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8");
              setRetryTrigger((prev) => prev + 1);
            } else {
              setErrorMsg("Stream connection failed (HTTP 404 or Network Timeout). Source stream is currently offline.");
            }
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            addLog("warn", "Codec", "Media error encountered in HLS. Attempting recovery...");
            hls.recoverMediaError();
          } else {
            setErrorMsg("Stream playback failed. Source format incompatible or offline.");
          }
        }
      });
    }

    // 3. Native Video Initialization
    function initNativeVideo() {
      destroyCurrentPlayer();
      addLog("info", "Player", `Initializing Native HTML5 Video for ${channel.name}`);
      video.src = currentEffectiveUrl;
      video.onerror = () => {
        addLog("error", "Player", "Native HTML5 Video element encountered load error");
        if (!isCancelled) {
          if (currentEffectiveUrl.includes("/api/proxy-stream")) {
            addLog("warn", "Proxy", "Native player failed via proxy. Trying direct stream...");
            currentEffectiveUrl = getEffectiveUrl(channel.streamUrl, true);
            video.src = currentEffectiveUrl;
            video.load();
            if (autoPlay) playVideo();
          } else if (!overrideStreamUrl) {
            addLog("warn", "Player", "Native player stream unavailable. Auto-recovering using Live Backup Stream...");
            setErrorMsg(null);
            setOverrideStreamUrl("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8");
            setRetryTrigger((prev) => prev + 1);
          } else {
            setErrorMsg("Stream playback failed. Source stream is currently offline or unsupported.");
          }
        }
      };
      video.load();
      if (autoPlay) playVideo();
    }

    // 4. MPEG-TS Engine Initialization
    function initMpegTs(videoOnly = false) {
      destroyCurrentPlayer();
      attempts.triedMpegTs = true;

      if (!mpegts.getFeatureList().mseLivePlayback) {
        addLog("warn", "Player", "MPEG-TS MSE live playback not supported. Falling back to native player...");
        initNativeVideo();
        return;
      }

      addLog("info", "Player", `Initializing MPEG-TS engine for ${channel.name} ${videoOnly ? "(Video-Only)" : ""}`);

      const mPlayerInstance = mpegts.createPlayer(
        {
          type: "mse",
          isLive: true,
          url: currentEffectiveUrl,
          hasAudio: !videoOnly,
          hasVideo: true,
        },
        {
          enableStashBuffer: true,
          stashInitialSize: 128 * 1024,
          liveBufferLatencyChasing: true,
          liveBufferLatencyMaxLatency: 10,
          liveBufferLatencyMinRemain: 2,
          enableWorker: true,
          lazyLoad: false,
          autoCleanupSourceBuffer: true,
        }
      );

      mpegtsPlayerRef.current = mPlayerInstance;
      playerRef.current = mPlayerInstance;

      try {
        mPlayerInstance.attachMediaElement(video);
        mPlayerInstance.load();
        if (autoPlay) playVideo();
      } catch (err: any) {
        addLog("error", "Player", "MPEG-TS attach error", err?.message);
        if (!videoOnly) {
          initMpegTs(true);
        } else if (!attempts.triedHls) {
          initHlsJs();
        } else {
          initNativeVideo();
        }
        return;
      }

      mPlayerInstance.on(mpegts.Events.MEDIA_INFO, (mediaInfo: any) => {
        addLog("info", "Codec", `MPEG-TS Media Info: Video: ${mediaInfo.videoCodec || "N/A"}, Audio: ${mediaInfo.audioCodec || "N/A"}`);
      });

      mPlayerInstance.on(mpegts.Events.ERROR, (type: any, detail: any, info: any) => {
        const detailStr = String(detail || "");
        const infoStr = JSON.stringify(info || {});
        if (!isCancelled) {
          const is404Error =
            detailStr.includes("HttpStatusCodeInvalid") &&
            (infoStr.includes("404") || (info && info.code === 404));

          if (is404Error) {
            addLog("warn", "Player", `MPEG-TS stream offline / issue: ${detailStr}`, infoStr);
          } else {
            addLog("warn", "Player", `MPEG-TS Stream issue: ${detailStr}`, infoStr);
          }

          if (is404Error && !overrideStreamUrl && !attempts.triedBackup) {
            attempts.triedBackup = true;
            addLog("warn", "Player", "MPEG-TS stream offline (HTTP 404). Auto-recovering using Live Backup Stream...");
            setErrorMsg(null);
            setOverrideStreamUrl("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8");
            setRetryTrigger((prev) => prev + 1);
            return;
          }

          const isFormatUnsupported =
            detailStr.includes("FormatUnsupported") ||
            detailStr.includes("Unsupported media type") ||
            infoStr.includes("Unsupported media type") ||
            detailStr.includes("NotSupported") ||
            detailStr.includes("ParsingError");

          if (isFormatUnsupported) {
            addLog("warn", "Player", `MPEG-TS format incompatible (${detailStr}). Falling back to HLS player...`);
            if (!attempts.triedHls) {
              initHlsJs();
            } else {
              initNativeVideo();
            }
            return;
          }

          if (currentEffectiveUrl.includes("/api/proxy-stream")) {
            addLog("warn", "Proxy", "MPEG-TS failed on proxy. Bypassing proxy...");
            currentEffectiveUrl = getEffectiveUrl(channel.streamUrl, true);
            if (!attempts.triedHls) {
              initHlsJs();
            } else {
              initNativeVideo();
            }
          } else if (!overrideStreamUrl && !attempts.triedBackup) {
            attempts.triedBackup = true;
            addLog("warn", "Player", "MPEG-TS stream unavailable. Auto-recovering using Live Backup Stream...");
            setErrorMsg(null);
            setOverrideStreamUrl("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8");
            setRetryTrigger((prev) => prev + 1);
          } else {
            if (!attempts.triedHls) {
              initHlsJs();
            } else {
              initNativeVideo();
            }
          }
        }
      });
    }

    // Select Engine based on Forced Selection or Auto Detection
    if (forcedEngine === "dash" || (forcedEngine === "auto" && detectedType === "dash")) {
      initDashJs();
    } else if (forcedEngine === "ts" || (forcedEngine === "auto" && detectedType === "ts")) {
      initMpegTs();
    } else if (forcedEngine === "native" || (forcedEngine === "auto" && detectedType === "direct")) {
      initNativeVideo();
    } else {
      initHlsJs();
    }

    // Connection watchdog timer
    const watchdog = setTimeout(() => {
      if (isCancelled) return;
      if (video && video.currentTime > 0.1) return;
      setIsBuffering(false);
      addLog("error", "Player", "Stream connection watchdog timed out after 18s");
      if (currentEffectiveUrl.includes("/api/proxy-stream")) {
        addLog("warn", "Proxy", "Watchdog timeout on proxy stream. Switching to direct URL...");
        currentEffectiveUrl = getEffectiveUrl(channel.streamUrl, true);
        initHlsJs();
      } else if (!overrideStreamUrl && !attempts.triedBackup) {
        attempts.triedBackup = true;
        addLog("warn", "Player", "Watchdog timeout on direct stream. Auto-recovering using Live Backup Stream...");
        setErrorMsg(null);
        setOverrideStreamUrl("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8");
        setRetryTrigger((prev) => prev + 1);
      } else {
        setErrorMsg("Stream connection timed out (18s). Source stream is currently offline or slow to respond.");
      }
    }, 18000);

    return () => {
      isCancelled = true;
      clearTimeout(watchdog);
      destroyCurrentPlayer();
    };
  }, [channel, isPremiumLocked, autoPlay, autoReconnect, streamProxyEnabled, retryTrigger, forcedEngine, overrideStreamUrl]);

  // Continuous auto-resume & freeze-recovery watchdog for live channel playback
  useEffect(() => {
    let lastTime = -1;
    let freezeCount = 0;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || !channel || isPremiumLocked || errorMsg) return;

      if (!isUserPausedRef.current && video.paused) {
        console.log("[Auto-Resume Watchdog] Video paused unexpectedly, auto-resuming playback...");
        if (playVideoRef.current) {
          playVideoRef.current();
        }
        return;
      }

      // Detect stream freeze on same frame during active live playback
      if (!isUserPausedRef.current && !video.paused) {
        if (video.currentTime === lastTime && video.currentTime > 0) {
          freezeCount++;
          if (freezeCount >= 2) {
            console.warn("[Freeze Watchdog] Stream frozen on frame at currentTime:", video.currentTime, "- Recovering live playback...");
            freezeCount = 0;
            if (playerRef.current && typeof playerRef.current.startLoad === "function") {
              try { playerRef.current.startLoad(); } catch (e) {}
            }
            if (video.buffered && video.buffered.length > 0) {
              const end = video.buffered.end(video.buffered.length - 1);
              if (end - video.currentTime > 0.1) {
                video.currentTime = Math.max(video.currentTime + 0.05, end - 0.2);
              }
            }
            if (playVideoRef.current) playVideoRef.current();
          }
        } else {
          lastTime = video.currentTime;
          freezeCount = 0;
        }
      }
    }, 1200);
    return () => clearInterval(interval);
  }, [channel, isPremiumLocked, errorMsg]);

  // Unified buffering & progress handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onWaiting = () => {
      setIsBuffering(true);
      if (spinnerTimerRef.current) clearTimeout(spinnerTimerRef.current);
      spinnerTimerRef.current = setTimeout(() => {
        setShowBufferSpinner(true);
      }, 4000); // 4 second delay to avoid flickering on minor glitches
    };
    const onPlaying = () => {
      if (spinnerTimerRef.current) clearTimeout(spinnerTimerRef.current);
      setIsBuffering(false);
      setIsPlaying(true);
      setShowBufferSpinner(false);
      setRetryCount(0);
    };
    const onPause = () => {
      setIsPlaying(false);
      if (!isUserPausedRef.current) {
        console.log("[Auto-Resume Guard] Stream paused automatically. Auto-resuming...");
        setTimeout(() => {
          if (!isUserPausedRef.current && videoRef.current && videoRef.current.paused) {
            if (playVideoRef.current) playVideoRef.current();
          }
        }, 300);
      }
    };
    const onStalled = () => {
      setIsBuffering(true);
      if (!isUserPausedRef.current) {
        setTimeout(() => {
          if (!isUserPausedRef.current && videoRef.current && videoRef.current.paused) {
            if (playVideoRef.current) playVideoRef.current();
          }
        }, 500);
      }
    };
    const onProgress = () => {
      if (video.buffered.length > 0) {
        const duration = video.duration || 1;
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        setBufferedPercent((bufferedEnd / duration) * 100);
      }
    };
    const onTimeUpdate = () => {
      setVideoCurrentTime(video.currentTime);
      if (video.duration && isFinite(video.duration) && video.duration !== 0) {
        setVideoDuration(video.duration);
      }
    };
    const onDurationChange = () => {
      if (video.duration && isFinite(video.duration)) {
        setVideoDuration(video.duration);
      } else {
        setVideoDuration(0);
      }
    };

    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("stalled", onStalled);
    video.addEventListener("progress", onProgress);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("loadedmetadata", onDurationChange);

    return () => {
      if (spinnerTimerRef.current) clearTimeout(spinnerTimerRef.current);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("stalled", onStalled);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("loadedmetadata", onDurationChange);
    };
  }, []);

  const skipForward = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    if (dur && isFinite(dur)) {
      const dest = Math.min(videoRef.current.currentTime + 10, dur);
      videoRef.current.currentTime = dest;
      setVideoCurrentTime(dest);
    }
  };

  const skipBackward = () => {
    if (!videoRef.current) return;
    const dest = Math.max(0, videoRef.current.currentTime - 10);
    videoRef.current.currentTime = dest;
    setVideoCurrentTime(dest);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      isUserPausedRef.current = true;
      safePause(videoRef.current);
      setIsPlaying(false);
    } else {
      isUserPausedRef.current = false;
      if (playVideoRef.current) {
        playVideoRef.current();
      }
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current
        .requestFullscreen()
        .then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const handleAudioTrackChange = (trackId: number) => {
    setSelectedAudio(trackId);
    if (hlsPlayerRef.current) {
      hlsPlayerRef.current.audioTrack = trackId;
    }
  };

  if (!channel) {
    return (
      <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center text-slate-500 gap-3 border border-slate-800 rounded-3xl p-8">
        <Tv className="w-16 h-16 text-slate-700 animate-pulse" />
        <p className="text-lg font-bold text-slate-400">
          Select a channel to start watching
        </p>
        <p className="text-xs text-slate-600">
          Use D-Pad Arrow keys or Remote to browse channels
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
      className="relative w-full h-full bg-black rounded-3xl overflow-hidden shadow-2xl group select-none flex items-center justify-center border border-white/10 hover:border-blue-500/50 transition-colors player-container"
    >
      {/* Video Element */}
      {!isPremiumLocked && (
        <video
          ref={videoRef}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          className="w-full h-full object-contain bg-black"
          playsInline
          {...({ "webkit-playsinline": "true" } as any)}
          muted={isMuted}
          autoPlay={autoPlay}
          preload="auto"
        />
      )}

      {/* Corner Channel Number Badge (Always Visible in Screen Corner) */}
      {channel && (
        <div className="absolute top-2.5 right-2.5 z-30 pointer-events-none flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md border border-amber-400/50 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg sm:rounded-xl shadow-2xl">
          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="font-mono font-black text-[10px] sm:text-xs text-amber-400 tracking-wider">
            CH. {channel.channelNumber}
          </span>
        </div>
      )}

      {/* Buffering Spinner Overlay - Less intrusive */}
      {showBufferSpinner && !isPremiumLocked && (
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] flex flex-col items-center justify-center z-20 gap-3">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-amber-500/20" />
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 animate-pulse bg-slate-950/80 px-3 py-1 rounded-full border border-amber-500/30">
            Buffering...
          </span>
        </div>
      )}

      {/* Stream Error Banner */}
      {errorMsg && !isPremiumLocked && (
        <div className="absolute z-40 inset-auto bg-slate-950/95 border border-red-500/50 p-6 rounded-2xl flex flex-col items-center gap-3 text-center max-w-sm shadow-2xl backdrop-blur-lg pointer-events-auto">
          <AlertTriangle className="w-10 h-10 text-red-400 animate-bounce" />
          <p className="text-white font-bold text-sm leading-relaxed">{errorMsg}</p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
            <button
              onClick={() => {
                setErrorMsg(null);
                setRetryCount(0);
                setIsBuffering(true);
                setShowBufferSpinner(true);
                setRetryTrigger((prev) => prev + 1);
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-red-600/30 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reconnect
            </button>
            <button
              onClick={() => {
                setErrorMsg(null);
                setRetryCount(0);
                setIsBuffering(true);
                setShowBufferSpinner(true);
                // Switch to public reliable backup test stream
                setOverrideStreamUrl("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8");
                setRetryTrigger((prev) => prev + 1);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-blue-600/30 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" /> Try Backup Stream
            </button>
            <button
              onClick={() => {
                setErrorMsg(null);
                setIsBuffering(true);
                onNextChannel();
              }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 border border-white/20 cursor-pointer"
            >
              Next Channel
            </button>
          </div>
        </div>
      )}

      {/* PREMIUM GATEWAY OVERLAY */}
      {isPremiumLocked && (
        <div className="absolute inset-0 bg-gradient-to-t from-black via-[#08080c]/95 to-black z-30 flex flex-col items-center justify-center p-8 text-center backdrop-blur-md">
          <div className="w-20 h-20 rounded-3xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center mb-5 text-yellow-400 shadow-2xl shadow-yellow-500/10">
            <Lock className="w-10 h-10" />
          </div>

          <span className="text-xs font-extrabold text-yellow-400 tracking-widest uppercase mb-1 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Premium Channel
          </span>

          <h2 className="text-2xl font-black text-white mb-2 max-w-md">
            🔒 VIP Premium Channel Locked
          </h2>

          <p className="text-sm text-gray-300 max-w-md mb-6 leading-relaxed">
            {channel?.name || "This channel"} requires an active VIP Subscription package or activation code to watch.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onOpenSubscription}
              className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-2xl shadow-xl shadow-amber-500/20 text-xs uppercase tracking-wider transition-all scale-105 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> Buy Package / Unlock
            </button>

            {!currentUser && (
              <button
                onClick={onOpenLogin}
                className="px-5 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-600/25 text-xs uppercase tracking-wider transition-all"
              >
                Login
              </button>
            )}

            <button
              onClick={onNextChannel}
              className="px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl text-xs uppercase tracking-wider border border-white/10 transition-colors"
            >
              Skip Next
            </button>
          </div>
        </div>
      )}

      {/* TRANSPARENT OSD CONTROLS */}
      {!isPremiumLocked && showControls && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-black/80 z-20 flex flex-col justify-between p-3 sm:p-6 transition-opacity duration-300">
          {/* Top Channel Header Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <div className="px-2 py-1 sm:px-3.5 sm:py-1.5 bg-blue-600 text-white font-bold text-sm sm:text-lg rounded-lg sm:rounded-xl font-mono shadow-md shrink-0">
                Ch. {channel.channelNumber}
              </div>
              <img
                src={channel.logo}
                alt={channel.name}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl object-cover bg-white/5 border border-white/10 shadow-md shrink-0"
              />
              <div className="min-w-0">
                <h3 className="text-white font-bold text-sm sm:text-lg tracking-wide flex items-center gap-2 truncate">
                  {channel.name}
                  <span className="hidden sm:inline-flex items-center gap-1.5">
                    {channel.isPremium && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-bold ${
                          isSubscriptionActive
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                            : "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
                        }`}
                      >
                        {isSubscriptionActive ? "PREMIUM UNLOCKED" : "PREMIUM"}
                      </span>
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-mono font-bold uppercase">
                      {detectedStreamType}
                    </span>
                  </span>
                </h3>
                <p className="text-blue-400 text-[10px] sm:text-xs font-semibold truncate flex items-center gap-2">
                  <span>{channel.category}</span>
                  {channel.tvgCountry && (
                    <span className="text-gray-400 text-[9px] uppercase font-mono">[{channel.tvgCountry}]</span>
                  )}
                </p>
              </div>
            </div>

            {/* Top Right Controls: Diagnostics & Audio Selector */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDiagnostics((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                  showDiagnostics
                    ? "bg-amber-500 text-slate-950 border-amber-400"
                    : "bg-slate-900/80 text-amber-400 border-amber-500/40 hover:bg-slate-800"
                }`}
                title="VLC Stream Diagnostics & Player Engine Log"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Diagnostics Log</span>
              </button>

              {audioTracks.length > 1 && (
                <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-gray-300">
                  <Sliders className="w-4 h-4 text-blue-400" />
                  <select
                    value={selectedAudio}
                    onChange={(e) =>
                      handleAudioTrackChange(Number(e.target.value))
                    }
                    className="bg-transparent font-bold focus:outline-none cursor-pointer"
                  >
                    {audioTracks.map((track) => (
                      <option
                        key={track.id}
                        value={track.id}
                        className="bg-black text-white"
                      >
                        {track.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Control & EPG Timeline Bar */}
          <div className="space-y-1.5 sm:space-y-3">
            {isVOD ? (
              /* High-Quality Interactive VOD Seekbar and Slider */
              <div className="bg-slate-950/90 border border-white/10 p-2.5 sm:p-3.5 rounded-xl backdrop-blur-md flex flex-col gap-1.5 shadow-xl">
                <div className="flex items-center justify-between text-[10px] sm:text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                    <span className="font-bold text-white text-[10px] sm:text-xs truncate">
                      {channel?.name || "VOD Playback"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[9px] sm:text-xs font-bold shrink-0">
                    <span className="text-amber-400">{formatTime(videoCurrentTime)}</span>
                    <span className="text-white/30">/</span>
                    <span className="text-gray-400">{formatTime(videoDuration)}</span>
                  </div>
                </div>

                {/* Draggable interactive Seek Slider Container */}
                <div className="relative flex items-center group w-full py-1.5">
                  {/* Track background */}
                  <div className="absolute left-0 right-0 h-1 rounded-full bg-white/10 pointer-events-none" />
                  
                  {/* Buffered progress bar */}
                  {bufferedPercent > 0 && (
                    <div
                      className="absolute left-0 h-1 rounded-full bg-emerald-500/20 pointer-events-none transition-all duration-300"
                      style={{ width: `${bufferedPercent}%` }}
                    />
                  )}
                  
                  {/* Played progress bar (Active Accent) */}
                  <div
                    className={`absolute left-0 h-1 rounded-full bg-gradient-to-r ${theme.accentGradient} pointer-events-none`}
                    style={{ width: `${videoDuration > 0 ? (videoCurrentTime / videoDuration) * 100 : 0}%` }}
                  />

                  {/* HTML5 Range Input overlay for native drag support */}
                  <input
                    type="range"
                    min={0}
                    max={videoDuration || 100}
                    step={0.1}
                    value={videoCurrentTime}
                    onChange={(e) => {
                      if (videoRef.current) {
                        const val = parseFloat(e.target.value);
                        videoRef.current.currentTime = val;
                        setVideoCurrentTime(val);
                      }
                    }}
                    className="w-full h-4 opacity-0 cursor-pointer relative z-20"
                    style={{ WebkitAppearance: "none" }}
                  />

                  {/* Floating drag thumb representing the slider position */}
                  <div
                    className="absolute w-3.5 h-3.5 sm:w-4 sm:h-4 bg-white rounded-full shadow-lg border border-slate-900 pointer-events-none transform -translate-x-1/2 scale-75 group-hover:scale-100 group-active:scale-110 transition-transform duration-100 z-10"
                    style={{ left: `${videoDuration > 0 ? (videoCurrentTime / videoDuration) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ) : (
              /* Ultra-Compact EPG Program Bar (For Live Channels) */
              <div className="bg-slate-950/80 border border-white/10 p-1.5 sm:p-2.5 rounded-xl backdrop-blur-md flex flex-col gap-1">
                <div className="flex items-center justify-between text-[9px] sm:text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping shrink-0" />
                    <span className="font-bold text-white text-[10px] sm:text-xs truncate">
                      {currentEpg?.title || "Live Broadcast"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[8px] sm:text-[10px] shrink-0">
                    <span className="text-gray-400 hidden xs:inline">
                      {currentEpg
                        ? `${currentEpg.startTime} - ${currentEpg.endTime}`
                        : "24/7 HD"}
                    </span>
                    <span className="text-amber-400 font-black bg-amber-400/20 px-1 py-0.2 rounded border border-amber-400/30">
                      {epgProgress}%
                    </span>
                  </div>
                </div>

                {/* Thin Micro Stream Progress Line */}
                <div className="w-full bg-white/10 h-0.5 sm:h-1 rounded-full overflow-hidden relative">
                  {bufferedPercent > 0 && (
                    <div
                      className="bg-emerald-500/30 h-full absolute left-0 top-0 transition-all duration-300"
                      style={{
                        width: `${Math.max(epgProgress, bufferedPercent)}%`,
                      }}
                    />
                  )}
                  <div
                    className={`h-full bg-gradient-to-r ${theme.accentGradient} rounded-full relative z-10 transition-all duration-500`}
                    style={{ width: `${epgProgress}%` }}
                  />
                </div>

                {nextEpg && (
                  <p className="text-gray-400 text-[8px] sm:text-[10px] font-medium flex items-center gap-1 truncate hidden xs:flex">
                    <span className="text-blue-400 font-bold uppercase shrink-0">
                      Next:
                    </span>{" "}
                    <span className="truncate">{nextEpg.title}</span>
                  </p>
                )}
              </div>
            )}

            {/* Transport Action Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 sm:gap-3">
                <button
                  onClick={onPrevChannel}
                  className="p-2 sm:p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/10 transition-all active:scale-95"
                  title="Previous Channel"
                >
                  <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {isVOD && (
                  <button
                    onClick={skipBackward}
                    className="p-2 sm:p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/10 transition-all active:scale-95"
                    title="Rewind 10s"
                  >
                    <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}

                <button
                  onClick={togglePlay}
                  className="p-2.5 sm:p-3.5 bg-white hover:bg-gray-200 text-black font-bold rounded-xl shadow-lg transition-all active:scale-95"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-black" />
                  ) : (
                    <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-black" />
                  )}
                </button>

                {isVOD && (
                  <button
                    onClick={skipForward}
                    className="p-2 sm:p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/10 transition-all active:scale-95"
                    title="Forward 10s"
                  >
                    <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}

                <button
                  onClick={onNextChannel}
                  className="p-2 sm:p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/10 transition-all active:scale-95"
                  title="Next Channel"
                >
                  <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                <button
                  onClick={toggleMute}
                  className="p-2 sm:p-3 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-xl border border-white/10 transition-colors"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <span className="hidden md:flex text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg uppercase tracking-wider items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Auto Reconnect ON
                </span>

                <button
                  onClick={toggleFullscreen}
                  className="p-3 sm:p-3.5 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-xl border border-white/10 transition-colors"
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? (
                    <Minimize className="w-5 h-5 sm:w-6 sm:h-6" />
                  ) : (
                    <Maximize className="w-5 h-5 sm:w-6 sm:h-6" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VLC-STYLE REAL-TIME STREAM DIAGNOSTICS & LOG DRAWER */}
      {showDiagnostics && (
        <div className="absolute inset-y-0 right-0 w-full sm:w-[480px] bg-slate-950/95 border-l border-amber-500/30 backdrop-blur-2xl z-50 flex flex-col p-4 shadow-2xl text-xs font-sans text-slate-200 pointer-events-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-amber-400 font-black text-sm">
              <Activity className="w-4 h-4 animate-pulse" />
              <span>VLC Stream Diagnostics & Log</span>
            </div>
            <button
              onClick={() => setShowDiagnostics(false)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>



          {/* Channel Specs Summary */}
          {channel && (
            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800 text-[10px] font-mono space-y-1 mb-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Channel Name:</span>
                <span className="font-bold text-white">{channel.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Stream Format:</span>
                <span className="font-bold text-amber-400 uppercase">{detectedStreamType}</span>
              </div>
              {channel.tvgId && (
                <div className="flex justify-between">
                  <span className="text-slate-400">TVG ID:</span>
                  <span className="text-emerald-400 truncate max-w-[200px]">{channel.tvgId}</span>
                </div>
              )}
              {channel.groupTitle && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Group Title:</span>
                  <span className="text-blue-300">{channel.groupTitle}</span>
                </div>
              )}
            </div>
          )}

          {/* Log Controls */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex gap-1">
              {(["all", "error", "warn", "info"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setLogFilter(filter)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
                    logFilter === filter
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const text = logs.map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.category}] ${l.message} ${l.details || ""}`).join("\n");
                  navigator.clipboard.writeText(text);
                  alert("Diagnostics log copied to clipboard!");
                }}
                className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
                title="Copy Diagnostics"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setLogs([])}
                className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-red-400 border border-slate-800 transition-colors"
                title="Clear Logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Logs List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 font-mono text-[10px] scrollbar-thin scrollbar-thumb-slate-800">
            {logs
              .filter((l) => logFilter === "all" || l.level === logFilter)
              .map((log) => (
                <div
                  key={log.id}
                  className={`p-2 rounded-lg border ${
                    log.level === "error"
                      ? "bg-red-950/40 border-red-500/30 text-red-300"
                      : log.level === "warn"
                      ? "bg-amber-950/30 border-amber-500/30 text-amber-300"
                      : log.level === "success"
                      ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                      : "bg-slate-900/60 border-slate-800 text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between text-[9px] text-slate-400 mb-0.5">
                    <span>[{log.timestamp}]</span>
                    <span className="uppercase font-bold text-amber-400/80">{log.category}</span>
                  </div>
                  <div className="font-bold leading-tight">{log.message}</div>
                  {log.details && (
                    <div className="text-[9px] opacity-75 mt-0.5 break-all font-sans">{log.details}</div>
                  )}
                </div>
              ))}
            {logs.length === 0 && (
              <div className="text-center py-8 text-slate-600 font-sans">No diagnostic logs recorded yet.</div>
            )}
          </div>
        </div>
      )}

      {/* Floating Fullscreen TV Remote Channel Number Buffer Overlay */}
      {numberBuffer && (
        <div className="absolute top-10 right-10 z-50 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-slate-950/95 border-2 border-amber-500 rounded-3xl p-5 shadow-2xl shadow-amber-500/20 backdrop-blur-2xl flex flex-col items-center gap-3 min-w-[180px] text-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/70">
              CHANNEL TUNING
            </span>
            <div className="text-6xl font-black text-white font-mono tracking-tighter leading-none py-1">
              {numberBuffer}
            </div>

            {(() => {
              const matched = allChannels.find(
                (c) => c.channelNumber === parseInt(numberBuffer, 10),
              );
              return (
                <div className="w-full flex flex-col items-center gap-3">
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-1000 ease-linear"
                      style={{ width: `${(countdown / 3.5) * 100}%` }}
                    />
                  </div>

                  {matched ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-2xl w-full justify-center">
                      <img
                        src={matched.logo}
                        alt={matched.name}
                        className="w-6 h-6 rounded-lg object-contain bg-slate-900 p-0.5"
                      />
                      <div className="flex flex-col items-start min-w-0">
                        <span className="text-[11px] font-black text-white truncate max-w-[100px] leading-tight">
                          {matched.name}
                        </span>
                        <span className="text-[8px] font-bold text-amber-500/60 uppercase">
                          {matched.category}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                      Searching...
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
