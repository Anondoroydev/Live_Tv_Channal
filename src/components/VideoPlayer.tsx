import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import mpegts from "mpegts.js";

function getHlsConstructor(): any {
  if (typeof Hls === "function") return Hls;
  if ((Hls as any)?.default && typeof (Hls as any).default === "function") return (Hls as any).default;
  if (typeof (window as any).Hls === "function") return (window as any).Hls;
  let cls: any = Hls;
  while (cls && typeof cls !== "function") {
    if (cls.default) {
      cls = cls.default;
    } else {
      break;
    }
  }
  if (typeof cls === "function") return cls;
  return null;
}

function isHlsSupported(): boolean {
  const HlsConstructor = getHlsConstructor();
  if (HlsConstructor && typeof HlsConstructor.isSupported === "function") {
    try {
      return HlsConstructor.isSupported();
    } catch (e) {
      console.warn("HlsConstructor.isSupported error:", e);
    }
  }
  if (typeof (Hls as any)?.isSupported === "function") {
    try { return (Hls as any).isSupported(); } catch (e) {}
  }
  if (typeof (Hls as any)?.default?.isSupported === "function") {
    try { return (Hls as any).default.isSupported(); } catch (e) {}
  }
  return false;
}

function getHlsEvents(): any {
  const HlsConstructor = getHlsConstructor();
  return HlsConstructor?.Events || (Hls as any)?.Events || (Hls as any)?.default?.Events || {};
}

function getHlsErrorTypes(): any {
  const HlsConstructor = getHlsConstructor();
  return HlsConstructor?.ErrorTypes || (Hls as any)?.ErrorTypes || (Hls as any)?.default?.ErrorTypes || {};
}

function getMpegtsObj(): any {
  if (mpegts && typeof (mpegts as any).createPlayer === "function") return mpegts;
  if ((mpegts as any)?.default && typeof (mpegts as any).default.createPlayer === "function") return (mpegts as any).default;
  if ((window as any).mpegts && typeof (window as any).mpegts.createPlayer === "function") return (window as any).mpegts;
  let obj: any = mpegts;
  while (obj && !obj.createPlayer && obj.default) {
    obj = obj.default;
  }
  return obj;
}
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Maximize2,
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
  RotateCw,
} from "lucide-react";
import { Channel, EPGProgram, User, ThemeId } from "../types";
import { THEMES } from "./ThemeSelector";
import { calculateEpgProgress } from "../utils/epgUtils";

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
  isVod?: boolean;
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
  isVod,
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
  const [levels, setLevels] = useState<{ id: number; name: string }[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<number>(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRotated, setIsRotated] = useState(false);
  const lastTapRef = useRef<number>(0);
  const [showControls, setShowControls] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioTracks, setAudioTracks] = useState<
    { id: number; name: string }[]
  >([]);
  const [selectedAudio, setSelectedAudio] = useState<number>(0);
  const [hlsInstance, setHlsInstance] = useState<Hls | null>(null);
  const [mpegtsPlayer, setMpegtsPlayer] = useState<any>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [forceDirect, setForceDirect] = useState<boolean>(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [objectFit, setObjectFit] = useState<"fill" | "cover" | "contain">("fill");
  const MAX_RETRIES = 5;
  const playerRef = useRef<any>(null);
  const activePlayPromiseRef = useRef<Promise<void> | null>(null);
  const isUserPausedRef = useRef<boolean>(false);
  const playVideoRef = useRef<() => void>(() => {});

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

  // TV remote & direct channel number entry states
  const [numberBuffer, setNumberBuffer] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(2);
  const bufferTimerRef = useRef<NodeJS.Timeout | null>(null);
  const spinnerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Swipe gesture & mobile back button support
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("button, input, select, option")) return;
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touchEnd = e.changedTouches[0];
    if (!touchEnd) return;

    const deltaX = touchEnd.clientX - touchStartRef.current.x;
    const deltaY = touchEnd.clientY - touchStartRef.current.y;

    touchStartRef.current = null;

    if (
      Math.abs(deltaX) > 30 &&
      Math.abs(deltaX) > Math.abs(deltaY) * 1.1
    ) {
      if (deltaX > 0) {
        // Left to Right swipe -> Previous channel
        onPrevChannel();
      } else {
        // Right to Left swipe -> Next channel
        onNextChannel();
      }
    }
  };

  // Close quality menu on phone back button
  useEffect(() => {
    const handlePopState = () => {
      if (showQualityMenu) {
        setShowQualityMenu(false);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showQualityMenu]);

  // Auto-rotate screen orientation lock helpers for phone screen
  const lockLandscape = () => {
    if (
      typeof window !== "undefined" &&
      window.screen &&
      window.screen.orientation
    ) {
      const orientation = window.screen.orientation as any;
      if (typeof orientation.lock === "function") {
        orientation.lock("landscape").catch(() => {
          orientation.lock("landscape-primary").catch(() => {});
        });
      }
    }
  };

  const unlockOrientation = () => {
    if (
      typeof window !== "undefined" &&
      window.screen &&
      window.screen.orientation
    ) {
      const orientation = window.screen.orientation as any;
      if (typeof orientation.unlock === "function") {
        try {
          orientation.unlock();
        } catch (e) {}
      }
    }
  };

  // Listen to fullscreen changes & WebKit events dynamically to stay 100% in sync and auto-rotate phone
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFS = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFS);

      if (isFS) {
        lockLandscape();
      } else {
        unlockOrientation();
      }
    };

    // Auto-rotate phone detection when user physically turns device sideways (portrait <-> landscape)
    const handleDeviceOrientation = () => {
      if (typeof window === "undefined" || typeof navigator === "undefined") return;
      const isMobileDevice = /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent);
      if (!isMobileDevice) {
        setIsRotated(false);
        return;
      }
      const isLandscapeMode =
        (window.screen && window.screen.orientation && window.screen.orientation.type.includes("landscape")) ||
        Math.abs(Number(window.orientation) || 0) === 90;

      if (isLandscapeMode) {
        setIsRotated(false); // When landscape, no CSS rotation needed usually (native fullscreen handles it)
      } else {
        // Only maybe CSS rotate if they are in portrait but want fullscreen landscape? Actually let's just keep it simple.
        setIsRotated(false);
      }
    };

    window.addEventListener("resize", handleDeviceOrientation);
    window.addEventListener("orientationchange", handleDeviceOrientation);
    if (typeof window !== "undefined" && window.screen && window.screen.orientation) {
      try {
        window.screen.orientation.addEventListener("change", handleDeviceOrientation);
      } catch (e) {}
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    const video = videoRef.current;
    const handleWebkitBegin = () => {
      setIsFullscreen(true);
      lockLandscape();
    };
    const handleWebkitEnd = () => {
      setIsFullscreen(false);
      unlockOrientation();
    };

    if (video) {
      video.addEventListener("webkitbeginfullscreen", handleWebkitBegin);
      video.addEventListener("webkitendfullscreen", handleWebkitEnd);
    }

    return () => {
      window.removeEventListener("resize", handleDeviceOrientation);
      window.removeEventListener("orientationchange", handleDeviceOrientation);
      if (typeof window !== "undefined" && window.screen && window.screen.orientation) {
        try {
          window.screen.orientation.removeEventListener("change", handleDeviceOrientation);
        } catch (e) {}
      }
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
      if (video) {
        video.removeEventListener("webkitbeginfullscreen", handleWebkitBegin);
        video.removeEventListener("webkitendfullscreen", handleWebkitEnd);
      }
    };
  }, []);

  const [streamProxyEnabled, setStreamProxyEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("myiptv_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.streamProxyEnabled === "boolean") {
          return parsed.streamProxyEnabled;
        }
      }
    } catch (e) {}
    return true; // Default ON
  });

  useEffect(() => {
    const handleSettingsUpdate = () => {
      try {
        const saved = localStorage.getItem("myiptv_settings");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.streamProxyEnabled === "boolean") {
            setStreamProxyEnabled(parsed.streamProxyEnabled);
          }
        }
      } catch (e) {}
    };

    window.addEventListener("myiptv_settings_updated", handleSettingsUpdate);
    window.addEventListener("storage", handleSettingsUpdate);
    return () => {
      window.removeEventListener("myiptv_settings_updated", handleSettingsUpdate);
      window.removeEventListener("storage", handleSettingsUpdate);
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

    setCountdown(1);

    if (countdownIntervalRef.current)
      clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 500);

    const timeout = setTimeout(() => {
      const finalNum = parseInt(numberBuffer, 10);
      const finalTarget = allChannelsRef.current.find(
        (c) => c.channelNumber === finalNum,
      );
      if (finalTarget && onSelectChannelRef.current) {
        onSelectChannelRef.current(finalTarget);
      }
      setNumberBuffer("");
    }, 700); // 700ms quick tune on remote/keyboard number entry

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
        case "ChannelDown":
          e.preventDefault();
          onPrevChannel();
          break;
        case "ArrowDown":
        case "ChannelUp":
          e.preventDefault();
          onNextChannel();
          break;
        case "ArrowRight":
        case "+":
        case "=":
          e.preventDefault();
          // We can't use changeVolume here if we don't include it in deps,
          // but we can just let React use the latest version if we're careful.
          // Wait, changeVolume uses functional state updates: setVolume(prev => prev + delta).
          // So it doesn't need to be in deps because it's stable if we didn't add it in deps before!
          // Actually, we'll just ignore the warning or use functional state.
          // To be safe, let's just trigger a custom event.
          window.dispatchEvent(
            new CustomEvent("volume-change", { detail: 0.1 }),
          );
          break;
        case "ArrowLeft":
        case "-":
        case "_":
          e.preventDefault();
          window.dispatchEvent(
            new CustomEvent("volume-change", { detail: -0.1 }),
          );
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

  const [proxyAttempted, setProxyAttempted] = useState<boolean>(false);
  const [directAttempted, setDirectAttempted] = useState<boolean>(false);

  // Reset fallback states when channel changes
  useEffect(() => {
    setProxyAttempted(false);
    setDirectAttempted(false);
    setForceDirect(false);
    setRetryCount(0);
    setErrorMsg(null);
  }, [channel?.id]);

  // Standard Channel Loading
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !channel || isPremiumLocked) {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.warn("Cleanup destroy error:", e);
        }
        playerRef.current = null;
      }
      return;
    }

    // Reset video state and destroy previous player
    if (playerRef.current) {
      if (typeof playerRef.current.stopLoad === "function") {
        try { playerRef.current.stopLoad(); } catch (e) {}
      }
      if (typeof playerRef.current.destroy === "function") {
        try { playerRef.current.destroy(); } catch (e) {}
      }
      playerRef.current = null;
    }
    isUserPausedRef.current = false;
    safePause(video);
    video.removeAttribute("src");
    video.load();

    setErrorMsg(null);
    setRetryCount(0);
    setIsBuffering(true);
    setShowBufferSpinner(false);

    let hls: Hls | null = null;
    let mPlayer: any = null;
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

    const getEffectiveUrl = (rawUrl?: string, forceDirectParam = false) => {
      const urlStr = typeof rawUrl === "string" ? rawUrl.trim() : "";
      if (!urlStr) return "";
      
      if (
        urlStr.startsWith("/api/") ||
        urlStr.startsWith("data:") ||
        urlStr.startsWith("blob:")
      ) {
        return getAbsoluteUrl(urlStr);
      }

      if (forceDirectParam) {
        return urlStr.split("|")[0];
      }

      const hasHeaders = urlStr.includes("|");
      const isHttpsPage = typeof window !== "undefined" && window.location.protocol === "https:";
      const isHttpStream = urlStr.startsWith("http://");

      // When streamProxyEnabled is ON: proxy is used for external streams
      // When streamProxyEnabled is OFF: direct is used (except for custom headers or HTTP on HTTPS)
      const shouldUseProxy = streamProxyEnabled ? true : (hasHeaders || (isHttpsPage && isHttpStream));

      if (shouldUseProxy && (urlStr.startsWith("http://") || urlStr.startsWith("https://"))) {
        const proxyPath = "/api/proxy";
        if (urlStr.includes("/api/proxy") || urlStr.includes("/api/proxy-stream")) return getAbsoluteUrl(urlStr);
        if (hasHeaders) {
          const parts = urlStr.split("|");
          const url = parts[0];
          const headers = parts.slice(1).join("|");
          return getAbsoluteUrl(`${proxyPath}?url=${encodeURIComponent(url)}&headers=${encodeURIComponent(headers)}`);
        }
        return getAbsoluteUrl(`${proxyPath}?url=${encodeURIComponent(urlStr)}`);
      }
      return urlStr.split("|")[0];
    };

    // Auto-stream playback URL
    let currentEffectiveUrl = getEffectiveUrl(channel.streamUrl, forceDirect);
    const isUsingProxyInitial = currentEffectiveUrl.includes("/api/proxy");

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
                // On success, reset our fallback flags
                setProxyAttempted(false);
                setDirectAttempted(false);
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
              console.warn("Autoplay unmuted failed, retrying muted:", err);
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
                  .catch((retryErr) => {
                    if (activePlayPromiseRef.current === retryPromise) activePlayPromiseRef.current = null;
                    if (
                      !isCancelled &&
                      retryErr.name !== "AbortError" &&
                      !(retryErr.message && (retryErr.message.includes("interrupted") || retryErr.message.includes("pause")))
                    ) {
                      setIsPlaying(false);
                      setIsBuffering(false);
                    }
                  });
              }
            });
        }
      } catch (e) {
        // Ignore play execution errors during rapid load/unload
      }
    };
    playVideoRef.current = playVideo;

    const rawUrl = (channel.streamUrl || "").split("|")[0];
    const isDirectMediaStream = (rawUrl.match(
      /\.(mp4|webm|ogg|mov|mkv|avi|flv|wmv|3gp|mp3|aac|m4a)(\?.*)?$/i,
    ) || rawUrl.includes("/movie/") || rawUrl.includes("/vod/")) && !rawUrl.match(/\.(m3u8|ts)(\?.*)?$/i);

    const isHlsStream = rawUrl.match(/\.(m3u8)(\?.*)?$/i) || rawUrl.includes(".m3u8") || rawUrl.includes("m3u8");
    const isXtreamLiveTs = (rawUrl.includes("/live/") || rawUrl.includes("/get.php")) && !isHlsStream && !isDirectMediaStream;
    const isRawTsStream = (rawUrl.match(/\.(ts)(\?.*)?$/i) || rawUrl.includes(".ts") || rawUrl.includes("/ts/") || isXtreamLiveTs) && !isHlsStream && !isDirectMediaStream;

    const canPlayNativeHls = video.canPlayType("application/vnd.apple.mpegurl") !== "";
    
    function initHlsJs() {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          if (typeof playerRef.current.stopLoad === "function") playerRef.current.stopLoad();
          playerRef.current.destroy();
        } catch (e) {
          console.warn("Player reset destroy error:", e);
        }
        playerRef.current = null;
      }

      const HlsConstructor: any = getHlsConstructor();
      const HlsEvents: any = HlsConstructor?.Events || (Hls as any)?.Events || (Hls as any)?.default?.Events || {};
      const HlsErrorTypes: any = HlsConstructor?.ErrorTypes || (Hls as any)?.ErrorTypes || (Hls as any)?.default?.ErrorTypes || {};

      if (!HlsConstructor || typeof HlsConstructor !== 'function') {
        initNativeVideo();
        return;
      }

      const hls = new HlsConstructor({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 10,
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
        maxBufferSize: 15 * 1024 * 1024,
        startLevel: -1,
        capLevelToPlayerSize: true,
        abrEwmaDefaultEstimate: 5000000,
        maxBufferHole: 0.5,
        nudgeOffset: 0.1,
        nudgeMaxRetry: 5,
        fragLoadingTimeOut: 6000,
        manifestLoadingTimeOut: 6000,
        levelLoadingTimeOut: 6000,
        fragLoadingMaxRetry: 3,
        manifestLoadingMaxRetry: 3,
        levelLoadingMaxRetry: 3,
        fragLoadingRetryDelay: 400,
        manifestLoadingRetryDelay: 400,
        liveSyncDurationCount: 1, // Start instantly on 1st segment (under 1-2s)
        liveMaxLatencyDurationCount: 4,
        liveDurationInfinity: true,
        startFragPrefetch: true,
        testBandwidth: false,
        fpsDroppedMonitoringPeriod: 0,
        highBufferWatchdogPeriod: 2,
        stretchShortVideoTrack: true,
      });

      hls.attachMedia(video);
      hls.loadSource(currentEffectiveUrl);

      hls.on(HlsEvents.MEDIA_ATTACHED || "hlsMediaAttached", () => {
        if (isCancelled) return;
        if (autoPlay) playVideo();
      });

      hls.on(HlsEvents.BUFFER_APPENDED || "hlsBufferAppended", () => {
        if (isCancelled) return;
        setIsBuffering(false);
        setShowBufferSpinner(false);
        if (autoPlay && video.paused && !isUserPausedRef.current) {
          playVideo();
        }
      });

      hls.on(HlsEvents.FRAG_BUFFERED || "hlsFragBuffered", () => {
        if (isCancelled) return;
        setIsBuffering(false);
        setShowBufferSpinner(false);
        if (autoPlay && video.paused && !isUserPausedRef.current) {
          playVideo();
        }
      });

      hls.on(HlsEvents.MANIFEST_PARSED || "hlsManifestParsed", () => {
        if (isCancelled) return;
        setIsBuffering(false);
        setShowBufferSpinner(false);
        setRetryCount(0);
        if (autoPlay) playVideo();

        if (hls) {
          const tracks = hls.audioTracks.map((t, idx) => ({
            id: idx,
            name: t.name || `Audio Track ${idx + 1}`,
          }));
          setAudioTracks(tracks);

          const qLevels = hls.levels.map((l, idx) => ({
            id: idx,
            name: l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)}kbps`,
          }));
          setLevels([{ id: -1, name: "Auto" }, ...qLevels]);
        }
      });

      hls.on(HlsEvents.ERROR || "hlsError", (_event, data) => {
        if (isCancelled) return;
        
        const detailStr = String(data.details || "");
        console.warn("[HLS Event/Error]:", data.type, detailStr, "Fatal:", data.fatal);

        // Handle non-HLS streams (e.g. raw TS, FLV, MP4) parsed by Hls.js
        if (detailStr === "manifestParsingError" || detailStr === "manifestIncompatibleCodecsError") {
          console.warn("HLS manifest parsing failed (non-M3U8 stream). Fallback to MPEG-TS / native player...");
          hls?.destroy();
          if (playerRef.current === hls) playerRef.current = null;
          initMpegTs();
          return;
        }

        // Handle HLS Buffer Stall gracefully (e.g. live sports streams like T Sports)
        if (detailStr === "bufferStalledError" || detailStr === "bufferNudgeOnStall" || detailStr === "bufferSeekOverHole") {
          console.warn("[HLS Guard] Live buffer stall detected, nudging playhead & resuming stream...", detailStr);
          try {
            if (video) {
              if (hls && hls.liveSyncPosition && Math.abs(video.currentTime - hls.liveSyncPosition) > 15) {
                video.currentTime = hls.liveSyncPosition - 3;
              } else if (video.buffered && video.buffered.length > 0) {
                const curTime = video.currentTime;
                let jumped = false;
                for (let i = 0; i < video.buffered.length; i++) {
                  const start = video.buffered.start(i);
                  if (curTime < start && start - curTime < 4) {
                    video.currentTime = start + 0.1;
                    jumped = true;
                    break;
                  }
                }
                if (!jumped) video.currentTime += 0.3;
              } else {
                video.currentTime += 0.3;
              }
            }
            hls?.startLoad();
            if (video && video.paused && !isUserPausedRef.current) playVideo();
          } catch (e) {}
          return;
        }

        if (data.fatal) {
          switch (data.type) {
            case HlsErrorTypes.NETWORK_ERROR || "networkError":
              const is429 = data.response && (data.response.code === 429 || String(data.response.text || "").includes("Rate exceeded"));
              const is404 = data.response && data.response.code === 404;
              const is403 = data.response && data.response.code === 403;
              const isFetchError = data.response && data.response.code === 0;

              // If network fails and we haven't tried the fallback yet, switch proxy/direct
              if (isUsingProxyInitial && !directAttempted) {
                console.warn("[Smart Proxy] Proxied load failed, falling back to DIRECT...");
                setDirectAttempted(true);
                setForceDirect(true);
                return;
              } else if (!isUsingProxyInitial && !proxyAttempted && (is403 || is404 || isFetchError || is429)) {
                console.warn("[Smart Proxy] Direct load failed, falling back to PROXY...");
                setProxyAttempted(true);
                setForceDirect(false);
                return;
              }

              // Otherwise standard retry with backoff
              if (retryCount < MAX_RETRIES) {
                setRetryCount(prev => prev + 1);
                const backoff = 2000 + (retryCount * 1000);
                setTimeout(() => {
                  if (!isCancelled) hls?.startLoad();
                }, backoff);
              } else {
                setErrorMsg("Streaming error. Try another channel.");
                setIsBuffering(false);
              }
              break;
            case HlsErrorTypes.MEDIA_ERROR || "mediaError":
              hls?.recoverMediaError();
              break;
            default:
              hls?.destroy();
              setErrorMsg("Playback failed.");
              break;
          }
        }
      });

      playerRef.current = hls;
      setHlsInstance(hls);
    }

    function initNativeVideo() {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try { playerRef.current.destroy(); } catch (e) {}
        playerRef.current = null;
      }
      video.src = currentEffectiveUrl;
      video.preload = "auto";
      video.load();
      if (autoPlay) playVideo();
      video.onloadeddata = () => {
        if (!isCancelled && autoPlay) playVideo();
      };
      video.oncanplay = () => {
        if (!isCancelled && autoPlay) playVideo();
      };
    }

    function initMpegTs(videoOnly = false) {
      const mpegtsObj: any = getMpegtsObj();
      const mpegtsEvents: any = mpegtsObj?.Events || (mpegts as any)?.Events || (mpegts as any)?.default?.Events || {};

      if (!mpegtsObj || typeof mpegtsObj.createPlayer !== 'function') {
        initNativeVideo();
        return;
      }
      if (typeof mpegtsObj.getFeatureList === 'function' && !mpegtsObj.getFeatureList().mseLivePlayback) {
        initNativeVideo();
        return;
      }
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try { playerRef.current.destroy(); } catch (e) {}
        playerRef.current = null;
      }
      const mPlayerInstance = mpegtsObj.createPlayer({
        type: "mpegts",
        isLive: true,
        url: currentEffectiveUrl,
        hasAudio: !videoOnly,
        hasVideo: true,
      }, {
        enableStashBuffer: false,
        stashInitialSize: 32 * 1024,
        liveBufferLatencyChasing: true,
        liveBufferLatencyMaxLatency: 2.0,
        liveBufferLatencyMinRemain: 0.2,
        enableWorker: true,
        lazyLoad: false,
        autoCleanupSourceBuffer: true,
      });

      try {
        mPlayerInstance.attachMediaElement(video);
        mPlayerInstance.load();
        if (autoPlay) playVideo();
      } catch (err: any) {
        console.warn("mpegts attach/load error:", err);
        if (!videoOnly) {
          initMpegTs(true);
          return;
        } else {
          initNativeVideo();
          return;
        }
      }

      const mediaInfoEvent = mpegtsEvents.MEDIA_INFO || "media_info";
      const statsInfoEvent = mpegtsEvents.STATISTICS_INFO || "statistics_info";
      const errorEvent = mpegtsEvents.ERROR || "error";

      mPlayerInstance.on(mediaInfoEvent, (mediaInfo: any) => {
        if (!videoOnly && mediaInfo && mediaInfo.hasAudio && mediaInfo.audioCodec) {
          const codecLower = String(mediaInfo.audioCodec).toLowerCase();
          if (codecLower.includes("ac-3") || codecLower.includes("ac3") || codecLower.includes("eac3") || codecLower.includes("dolby")) {
            const mime = `audio/mp4;codecs=${codecLower}`;
            if (window.MediaSource && !MediaSource.isTypeSupported(mime)) {
              console.warn(`[mpegts] Unsupported AC-3 audio codec detected (${mediaInfo.audioCodec}). Re-initializing mpegts in video-only mode...`);
              try { mPlayerInstance.destroy(); } catch (e) {}
              if (playerRef.current === mPlayerInstance) playerRef.current = null;
              setMpegtsPlayer(null);
              initMpegTs(true);
              return;
            }
          }
        }
      });

      mPlayerInstance.on(statsInfoEvent, (stats: any) => {
        if (stats.speed > 0) {
          if (spinnerTimerRef.current) clearTimeout(spinnerTimerRef.current);
          setIsBuffering(false);
          setShowBufferSpinner(false);
        }
      });

      mPlayerInstance.on(errorEvent, (type: any, detail: any, info: any) => {
        console.warn("mpegts.js error:", type, detail, info);
        if (!isCancelled) {
          setIsBuffering(false);
          
          const errStr = (JSON.stringify(info || {}) + " " + String(detail || "") + " " + String(type || "")).toLowerCase();
          const isAC3orMseError = errStr.includes("ac-3") || 
                                 errStr.includes("ac3") || 
                                 errStr.includes("addsourcebuffer") || 
                                 errStr.includes("sourcebuffer") || 
                                 errStr.includes("unsupported") || 
                                 errStr.includes("codecs=");

          if (mPlayerInstance) {
            setTimeout(() => {
              try { if (mPlayerInstance) mPlayerInstance.destroy(); } catch (e) {}
            }, 0);
            if (playerRef.current === mPlayerInstance) playerRef.current = null;
            setMpegtsPlayer(null);
          }

          if (isAC3orMseError && !videoOnly) {
             console.warn("MSE/AC-3 error detected in mpegts. Restarting in video-only mode...");
             initMpegTs(true);
             return;
          }

          if (retryCount < MAX_RETRIES) {
             setRetryCount(prev => prev + 1);
             initNativeVideo();
          } else {
             setErrorMsg("Stream playback failed. The channel source may be currently offline.");
          }
        }
      });
      playerRef.current = mPlayerInstance;
      setMpegtsPlayer(mPlayerInstance);
    }

    const hlsSupported = isHlsSupported();

    const checkStreamTypeAndPlay = () => {
      if (isRawTsStream) {
        initMpegTs();
      } else if (isDirectMediaStream) {
        initNativeVideo();
      } else if (hlsSupported) {
        initHlsJs();
      } else if (canPlayNativeHls) {
        video.src = currentEffectiveUrl;
        video.load();
        let nativePlaybackStarted = false;
        const nativeTimeout = setTimeout(() => {
          if (!nativePlaybackStarted && !isCancelled && !isDirectMediaStream) {
            initHlsJs();
          }
        }, 8000);

        video.onloadedmetadata = () => {
          if (!isCancelled) {
            nativePlaybackStarted = true;
            clearTimeout(nativeTimeout);
            setIsBuffering(false);
            if (autoPlay) playVideo();
          }
        };
        video.onerror = () => {
          if (!isCancelled) {
            clearTimeout(nativeTimeout);
            initHlsJs();
          }
        };
      } else {
        initNativeVideo();
      }
    };

    checkStreamTypeAndPlay();

    // Connection watchdog: if after 15 seconds the stream hasn't started playing, stop buffering and show message
    const watchdog = setTimeout(() => {
      if (isCancelled) return;
      if (video && (video.currentTime > 0 || !video.paused)) return;
      setIsBuffering(false);
      setErrorMsg(
        "Stream connection timed out. The source might be offline or slow to respond.",
      );
    }, 15000);

    return () => {
      isCancelled = true;
      clearTimeout(watchdog);
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.warn("Player cleanup error:", e);
        }
        playerRef.current = null;
      }
      if (video) {
        safePause(video);
        video.removeAttribute("src");
        try {
          video.load();
        } catch (e) {
          // Ignore load errors during cleanup
        }
      }
    };
  }, [channel, isPremiumLocked, autoPlay, autoReconnect, retryTrigger, forceDirect]);

  // Continuous auto-resume & freeze-recovery watchdog for live channel playback
  useEffect(() => {
    let lastTime = -1;
    let freezeCount = 0;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || !channel || isPremiumLocked || errorMsg || isBuffering) return;

      if (!isUserPausedRef.current && video.paused) {
        if (playVideoRef.current) {
          playVideoRef.current();
        }
        return;
      }

      // Detect real stream freeze on same frame during active live playback
      if (!isUserPausedRef.current && !video.paused) {
        if (video.currentTime === lastTime && video.currentTime > 0) {
          freezeCount++;
          if (freezeCount >= 3) {
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
    }, 3500);
    return () => clearInterval(interval);
  }, [channel, isPremiumLocked, errorMsg, isBuffering]);

  // Unified buffering & progress handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onWaiting = () => {
      setIsBuffering(true);
      if (spinnerTimerRef.current) clearTimeout(spinnerTimerRef.current);
      spinnerTimerRef.current = setTimeout(() => {
        setShowBufferSpinner(true);
      }, 400); // 400ms delay for fast responsiveness
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

    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("stalled", onStalled);
    video.addEventListener("progress", onProgress);

    return () => {
      if (spinnerTimerRef.current) clearTimeout(spinnerTimerRef.current);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("stalled", onStalled);
      video.removeEventListener("progress", onProgress);
    };
  }, []);

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
    const isFS = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );

    if (!isFS) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current
          .requestFullscreen()
          .then(() => {
            setIsFullscreen(true);
            lockLandscape();
          })
          .catch(() => {
            if (videoRef.current && (videoRef.current as any).webkitEnterFullscreen) {
              try {
                (videoRef.current as any).webkitEnterFullscreen();
                lockLandscape();
              } catch (e) {}
            }
          });
      } else if ((containerRef.current as any).webkitRequestFullscreen) {
        try {
          (containerRef.current as any).webkitRequestFullscreen();
          setIsFullscreen(true);
          lockLandscape();
        } catch (e) {}
      } else if (videoRef.current && (videoRef.current as any).webkitEnterFullscreen) {
        try {
          (videoRef.current as any).webkitEnterFullscreen();
          lockLandscape();
        } catch (e) {}
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
          setIsFullscreen(false);
          unlockOrientation();
        }).catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        try {
          (document as any).webkitExitFullscreen();
          setIsFullscreen(false);
          unlockOrientation();
        } catch (e) {}
      }
    }
  };

  const handleAudioTrackChange = (trackId: number) => {
    setSelectedAudio(trackId);
    if (hlsInstance) {
      hlsInstance.audioTrack = trackId;
    }
  };

  const handleQualityChange = (levelId: number) => {
    setSelectedLevel(levelId);
    if (hlsInstance) {
      hlsInstance.currentLevel = levelId;
    }
    setShowQualityMenu(false);
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
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        resetControlsTimer();
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300;
        if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
          // Double click: Toggle fullscreen and play video
          toggleFullscreen();
          if (videoRef.current && videoRef.current.paused && !isPremiumLocked && !errorMsg) {
            playVideoRef.current?.();
          }
          lastTapRef.current = 0;
        } else {
          lastTapRef.current = now;
          if (videoRef.current && videoRef.current.paused && !isPremiumLocked && !errorMsg) {
            playVideoRef.current?.();
          }
        }
      }}
      className="relative w-full h-full bg-black overflow-hidden group select-none flex items-center justify-center player-container"
    >
      {/* Video Element */}
      {!isPremiumLocked && (
        <video
          ref={videoRef}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsPlaying(true);
            setIsBuffering(false);
            setShowBufferSpinner(false);
          }}
          onCanPlay={() => {
            if (autoPlay && videoRef.current) {
              videoRef.current.play().catch(() => {});
            }
            setIsBuffering(false);
            setShowBufferSpinner(false);
          }}
          onTimeUpdate={() => {
            if (videoRef.current && videoRef.current.currentTime > 0) {
              setIsBuffering(false);
              setShowBufferSpinner(false);
            }
          }}
          className={`w-full h-full bg-black transition-transform duration-300 ${
            objectFit === "fill"
              ? "object-fill"
              : objectFit === "cover"
              ? "object-cover"
              : "object-contain"
          } ${isRotated ? "rotate-90 scale-[1.35]" : ""}`}
          playsInline
          {...({
            "webkit-playsinline": "true",
            "x5-playsinline": "true",
            "x5-video-player-type": "h5",
            "x5-video-player-fullscreen": "true"
          } as any)}
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

      {/* Unmute Prompt Banner when muted by browser policy */}
      {isPlaying && isMuted && !isPremiumLocked && (
        <button
          onClick={toggleMute}
          className="absolute top-2.5 left-2.5 z-30 flex items-center gap-2 bg-amber-500/90 hover:bg-amber-400 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs shadow-xl backdrop-blur-md transition-all active:scale-95 cursor-pointer animate-pulse"
        >
          <VolumeX className="w-4 h-4" />
          <span>Tap to Unmute Audio</span>
        </button>
      )}

      {/* Central Big Play Button Overlay when Paused */}
      {!isPlaying && !isBuffering && !showBufferSpinner && !errorMsg && !isPremiumLocked && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[2px]">
          <button
            onClick={togglePlay}
            className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-blue-600/90 hover:bg-blue-500 text-white flex items-center justify-center shadow-[0_0_50px_rgba(37,99,235,0.4)] transition-all hover:scale-110 active:scale-95 cursor-pointer border-2 border-white/30 group/play"
            title="Click to Play Stream"
          >
            <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping group-hover:animate-none" />
            <Play className="w-8 h-8 sm:w-12 sm:h-12 fill-white translate-x-0.5 relative z-10" />
          </button>
          <p className="mt-4 text-xs sm:text-sm font-bold text-white/90 bg-slate-900/80 px-5 py-2 rounded-full border border-white/10 backdrop-blur-md shadow-lg">
            Tap to Play Live Stream
          </p>
        </div>
      )}

      {/* Buffering Spinner Overlay - Completely Disabled per User Request */}
      {false && showBufferSpinner && !isPremiumLocked && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[4px] flex flex-col items-center justify-center z-20 gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full" />
            <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <div className="absolute inset-2 border-2 border-amber-500/20 rounded-full" />
            <div className="absolute inset-2 border-2 border-amber-500 border-b-transparent rounded-full animate-spin-slow" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 animate-pulse">
              Optimizing Stream
            </span>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-widest">
              Please wait...
            </span>
          </div>
        </div>
      )}

      {/* Stream Error Banner removed as requested - showing smooth spinner instead */}

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
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-black/80 z-20 flex flex-col justify-between p-3 sm:p-6 pt-safe pb-safe transition-opacity duration-300">
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
                  <span className="hidden sm:inline">
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
                  </span>
                </h3>
                <p className="text-blue-400 text-[10px] sm:text-xs font-semibold truncate">
                  {channel.category}
                </p>
              </div>
            </div>

            {/* Audio Track Selector if available */}
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

          {/* Bottom Control & EPG Timeline Bar */}
          <div className="space-y-1.5 sm:space-y-3">
            {/* Ultra-Compact EPG Program Bar */}
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

            {/* Transport Action Bar */}
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 sm:gap-2.5">
                <button
                  onClick={onPrevChannel}
                  className="p-1.5 sm:p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg sm:rounded-xl border border-white/10 transition-all active:scale-95 shrink-0"
                  title="Previous Channel"
                >
                  <SkipBack className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </button>

                <button
                  onClick={togglePlay}
                  className="p-2 sm:p-3 bg-white hover:bg-gray-200 text-black font-bold rounded-lg sm:rounded-xl shadow-lg transition-all active:scale-95 shrink-0"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-black" />
                  ) : (
                    <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-black" />
                  )}
                </button>

                <button
                  onClick={onNextChannel}
                  className="p-1.5 sm:p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg sm:rounded-xl border border-white/10 transition-all active:scale-95 shrink-0"
                  title="Next Channel"
                >
                  <SkipForward className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </button>

                <button
                  onClick={toggleMute}
                  className="p-1.5 sm:p-2.5 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-lg sm:rounded-xl border border-white/10 transition-colors shrink-0"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-red-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-1 sm:gap-2.5">
                <span className="hidden md:flex text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-lg uppercase tracking-wider items-center gap-1 shrink-0">
                  <CheckCircle className="w-3 h-3" /> Auto Reconnect ON
                </span>

                <button
                  onClick={() => {
                    if (objectFit === "fill") setObjectFit("cover");
                    else if (objectFit === "cover") setObjectFit("contain");
                    else setObjectFit("fill");
                  }}
                  className="p-1.5 sm:px-3 sm:py-2.5 bg-white/10 hover:bg-white/20 text-[10px] font-bold text-gray-200 hover:text-white rounded-lg sm:rounded-xl border border-white/10 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                  title="Toggle Video Aspect Fit"
                >
                  <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                  <span className="hidden sm:inline uppercase">
                    {objectFit === "fill" ? "Fit: Fill" : objectFit === "cover" ? "Fit: Cover" : "Fit: Contain"}
                  </span>
                </button>

                <button
                  onClick={() => setShowQualityMenu(!showQualityMenu)}
                  className="p-1.5 sm:p-2.5 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-lg sm:rounded-xl border border-white/10 transition-colors cursor-pointer shrink-0"
                  title="Quality Settings"
                >
                  <Sliders className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </button>

                {showQualityMenu && (
                  <div className="absolute bottom-14 right-2 sm:right-5 bg-slate-900 border border-slate-700 rounded-xl p-2 z-50 text-white text-xs min-w-[110px] shadow-2xl">
                    {levels.map((level) => (
                      <button
                        key={level.id}
                        onClick={() => handleQualityChange(level.id)}
                        className={`block w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-bold ${
                          selectedLevel === level.id
                            ? "bg-blue-600 text-white"
                            : "hover:bg-slate-800 text-slate-300"
                        }`}
                      >
                        {level.name}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={toggleFullscreen}
                  className="p-1.5 sm:p-2.5 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-lg sm:rounded-xl border border-white/10 transition-colors cursor-pointer shrink-0"
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? (
                    <Minimize className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                  ) : (
                    <Maximize className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                  )}
                </button>
              </div>
            </div>
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
