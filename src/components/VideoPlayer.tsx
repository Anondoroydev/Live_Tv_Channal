import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
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
  AlertTriangle
} from 'lucide-react';
import { Channel, EPGProgram, User, ThemeId } from '../types';
import { THEMES } from './ThemeSelector';
import { calculateEpgProgress } from '../utils/epgUtils';

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
  currentTheme = 'gold',
  allChannels = [],
  onSelectChannel
}) => {
  const theme = THEMES[currentTheme] || THEMES.gold;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('isMuted');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('volume');
    return saved !== null ? JSON.parse(saved) : 1;
  });

  useEffect(() => {
    localStorage.setItem('isMuted', JSON.stringify(isMuted));
    localStorage.setItem('volume', JSON.stringify(volume));
  }, [isMuted, volume]);
  
  const changeVolume = (delta: number) => {
    setVolume(prev => {
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
  const [audioTracks, setAudioTracks] = useState<{ id: number; name: string }[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<number>(0);
  const [hlsInstance, setHlsInstance] = useState<Hls | null>(null);
  const [epgProgress, setEpgProgress] = useState<number>(() => calculateEpgProgress(currentEpg));
  const [bufferedPercent, setBufferedPercent] = useState<number>(0);

  // TV remote & direct channel number entry states
  const [numberBuffer, setNumberBuffer] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(2);
  const bufferTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Listen to fullscreen changes dynamically to stay 100% in sync
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
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
    if (!numberBuffer) return;
    
    // Instant check
    const num = parseInt(numberBuffer, 10);
    const target = allChannelsRef.current.find(c => c.channelNumber === num);
    if (target && onSelectChannelRef.current) {
        onSelectChannelRef.current(target);
        setNumberBuffer('');
        return; // Done!
    }

    setCountdown(1);
    
    const timeout = setTimeout(() => {
      const finalNum = parseInt(numberBuffer, 10);
      const finalTarget = allChannelsRef.current.find(c => c.channelNumber === finalNum);
      if (finalTarget && onSelectChannelRef.current) {
        onSelectChannelRef.current(finalTarget);
      }
      setNumberBuffer('');
    }, 800);
    
    return () => {
      clearTimeout(timeout);
    };
  }, [numberBuffer]);

  // Keyboard and Remote Event Listener for Direct Channel Tuning & Arrow Keys CH+/CH-
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore typing inside text inputs
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // Check numbers 0-9
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        setNumberBuffer(prev => (prev + e.key).slice(-4)); // max 4 digits
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          onNextChannel();
          break;
        case 'ArrowDown':
          e.preventDefault();
          onPrevChannel();
          break;
        case 'ArrowRight':
        case '+':
        case '=':
          e.preventDefault();
          // We can't use changeVolume here if we don't include it in deps,
          // but we can just let React use the latest version if we're careful.
          // Wait, changeVolume uses functional state updates: setVolume(prev => prev + delta).
          // So it doesn't need to be in deps because it's stable if we didn't add it in deps before!
          // Actually, we'll just ignore the warning or use functional state.
          // To be safe, let's just trigger a custom event.
          window.dispatchEvent(new CustomEvent('volume-change', { detail: 0.1 }));
          break;
        case 'ArrowLeft':
        case '-':
        case '_':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('volume-change', { detail: -0.1 }));
          break;
        case 'Enter':
          setNumberBuffer(prev => {
            if (prev) {
              const num = parseInt(prev, 10);
              const target = allChannels.find(c => c.channelNumber === num);
              if (target && onSelectChannel) {
                onSelectChannel(target);
              }
            }
            return '';
          });
          break;
        case 'Backspace':
        case 'Escape':
          setNumberBuffer('');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [allChannels, onSelectChannel, onNextChannel, onPrevChannel]);

  // Listen to custom volume events to avoid dependency issues
  useEffect(() => {
    const handleVolChange = (e: any) => {
      setVolume(prev => {
        let newVol = prev + e.detail;
        if (newVol > 1) newVol = 1;
        if (newVol < 0) newVol = 0;
        if (newVol > 0) setIsMuted(false);
        return newVol;
      });
    };
    window.addEventListener('volume-change', handleVolChange);
    return () => window.removeEventListener('volume-change', handleVolChange);
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
            setBufferedPercent(Math.min(100, Math.round((bufferedEnd / v.duration) * 100)));
          } else {
            const bufSecs = Math.max(0, bufferedEnd - v.currentTime);
            const pct = Math.min(100, Math.max(10, Math.round((bufSecs / 12) * 100)));
            setBufferedPercent(pct);
          }
        }
      }
    };

    updateProgress();
    const timer = setInterval(updateProgress, 1000);
    return () => clearInterval(timer);
  }, [currentEpg]);

  // Delay the visual rendering of the buffering spinner by 500ms
  // to avoid flashing/flickering on fast stream switching
  useEffect(() => {
    if (isBuffering) {
      const t = setTimeout(() => {
        setShowBufferSpinner(true);
      }, 500);
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
    }, 4000);
  };

  // Check if current user is allowed to watch this channel
  const isSubscriptionActive = !!currentUser && (
    currentUser.role === 'admin' ||
    (currentUser.subscriptionPlan !== 'Free' &&
     currentUser.subscriptionPlan !== 'Expired' &&
     (!currentUser.subscriptionExpiresAt || new Date(currentUser.subscriptionExpiresAt).getTime() > Date.now()))
  );

  const isPremiumLocked = channel?.isPremium && !isSubscriptionActive;

  useEffect(() => {
    if (!channel || isPremiumLocked) {
      if (hlsInstance) {
        hlsInstance.destroy();
        setHlsInstance(null);
      }
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    setErrorMsg(null);
    setIsBuffering(true);

    let hls: Hls | null = null;
    let isCancelled = false;

    // Helper to resolve stream URL with CORS & HTTPS proxy
    const getEffectiveUrl = (rawUrl: string, forceProxy = false) => {
      if (!rawUrl) return '';
      if (rawUrl.startsWith('/api/') || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
        return rawUrl;
      }
      // If Xtream live stream URL ends in .ts, auto-convert to .m3u8 for native HLS support
      let cleanUrl = rawUrl;
      if (cleanUrl.includes('/live/') && cleanUrl.endsWith('.ts')) {
        cleanUrl = cleanUrl.replace(/\.ts$/i, '.m3u8');
      }
      if (forceProxy || cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
        return `/api/proxy-stream?url=${encodeURIComponent(cleanUrl)}`;
      }
      return cleanUrl;
    };

    let currentEffectiveUrl = getEffectiveUrl(channel.streamUrl);

    const playVideo = () => {
      if (!video || isCancelled) return;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (!isCancelled) {
              setIsPlaying(true);
              setIsBuffering(false);
            }
          })
          .catch((err) => {
            if (isCancelled || err.name === 'AbortError') return;
            console.warn('Autoplay unmuted failed, retrying muted:', err);
            if (!video || isCancelled) return;
            video.muted = true;
            setIsMuted(true);
            video.play()
              .then(() => {
                if (!isCancelled) {
                  setIsPlaying(true);
                  setIsBuffering(false);
                }
              })
              .catch((retryErr) => {
                if (!isCancelled && retryErr.name !== 'AbortError') {
                  setIsPlaying(false);
                  setIsBuffering(false);
                }
              });
          });
      }
    };

    const isDirectMp4 = channel.streamUrl.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i);

    if (!isDirectMp4 && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 8,
        maxMaxBufferLength: 15,
        maxBufferSize: 15 * 1024 * 1024,
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 5,
        liveDurationInfinity: true,
        highBufferWatchdogPeriod: 2,
        startLevel: -1,
        fragLoadingTimeOut: 10000,
        manifestLoadingTimeOut: 10000,
        fragLoadingMaxRetry: 8,
        manifestLoadingMaxRetry: 8,
        levelLoadingMaxRetry: 8,
        capLevelToPlayerSize: true
      });

      hls.loadSource(currentEffectiveUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (isCancelled) return;
        setIsBuffering(false);
        if (autoPlay) playVideo();

        if (hls) {
          const tracks = hls.audioTracks.map((t, idx) => ({
            id: idx,
            name: t.name || `Audio Track ${idx + 1}`
          }));
          setAudioTracks(tracks);
        }
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        if (isCancelled) return;
        setIsBuffering(false);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (isCancelled) return;

        // Check for rate exceeded or other specific error strings
        let responseText = '';
        if (data.response && typeof data.response === 'object') {
          responseText = (data.response.text || data.response.data || '').toString();
        }

        const isRateLimit = responseText.toLowerCase().includes('rate exceeded') || 
                            responseText.toLowerCase().includes('too many requests') ||
                            (data.response && data.response.code === 429);

        if (isRateLimit) {
          setIsBuffering(false);
          setErrorMsg('Rate Limit Exceeded (10000). Please try again later.');
          const targetHls = hls;
          setTimeout(() => {
            try {
              if (targetHls) targetHls.destroy();
            } catch (err) {
              console.warn('Deferred HLS destroy error:', err);
            }
          }, 0);
          return;
        }

        if (data.fatal) {
          console.warn('HLS fatal error:', data.type, data.details);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // For HTTP 403 / 429, don't keep retrying, fail fast with appropriate message
              if (data.response && (data.response.code === 429 || data.response.code === 403)) {
                setIsBuffering(false);
                setErrorMsg(data.response.code === 429 
                  ? 'Rate Limit Exceeded (10000). Stream connection failed.' 
                  : 'Stream playback forbidden (403). Try another channel.');
                const targetHls = hls;
                setTimeout(() => {
                  try {
                    if (targetHls) targetHls.destroy();
                  } catch (err) {
                    console.warn('Deferred HLS destroy error:', err);
                  }
                }, 0);
                break;
              }

              if (currentEffectiveUrl === channel.streamUrl) {
                currentEffectiveUrl = getEffectiveUrl(channel.streamUrl, true);
                console.log('Retrying stream via backend proxy:', currentEffectiveUrl);
                hls?.loadSource(currentEffectiveUrl);
                hls?.startLoad();
              } else {
                console.warn('HLS Network error, attempting to startLoad...');
                hls?.startLoad();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('HLS Media error, attempting to recover...');
              hls?.recoverMediaError();
              break;
            default:
              setIsBuffering(false);
              if (data.details === 'manifestParsingError') {
                setErrorMsg('Invalid stream response or stream is offline (Rate Exceeded / Bad Format).');
                const targetHls = hls;
                setTimeout(() => {
                  try {
                    if (targetHls) targetHls.destroy();
                  } catch (err) {
                    console.warn('Deferred HLS destroy error:', err);
                  }
                }, 0);
              } else if (video && !isCancelled) {
                video.src = currentEffectiveUrl;
                video.load();
                if (autoPlay) playVideo();
              }
              break;
          }
        }
      });

      setHlsInstance(hls);
    } else {
      // Direct video src fallback
      video.src = currentEffectiveUrl;
      video.load();
      video.oncanplay = () => {
        if (isCancelled) return;
        setIsBuffering(false);
        if (autoPlay) playVideo();
      };
      video.onerror = () => {
        if (isCancelled) return;
        if (currentEffectiveUrl === channel.streamUrl) {
          currentEffectiveUrl = getEffectiveUrl(channel.streamUrl, true);
          video.src = currentEffectiveUrl;
          video.load();
          if (autoPlay) playVideo();
        } else {
          setIsBuffering(false);
          setErrorMsg('Stream connection failed. Check stream URL or try another channel.');
        }
      };
    }

    // Connection watchdog: if after 10 seconds the stream hasn't started playing, stop buffering and show message
    const watchdog = setTimeout(() => {
      if (isCancelled) return;
      if (video && (video.currentTime > 0 || !video.paused)) return;
      setIsBuffering(false);
      setErrorMsg('Stream connection timed out. This stream might be offline.');
    }, 10000);

    return () => {
      isCancelled = true;
      clearTimeout(watchdog);
      if (hls) {
        hls.destroy();
      }
      if (video) {
        video.pause();
      }
    };
  }, [channel, isPremiumLocked, autoPlay, autoReconnect]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
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
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const handleAudioTrackChange = (trackId: number) => {
    setSelectedAudio(trackId);
    if (hlsInstance) {
      hlsInstance.audioTrack = trackId;
    }
  };

  if (!channel) {
    return (
      <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center text-slate-500 gap-3 border border-slate-800 rounded-3xl p-8">
        <Tv className="w-16 h-16 text-slate-700 animate-pulse" />
        <p className="text-lg font-bold text-slate-400">Select a channel to start watching</p>
        <p className="text-xs text-slate-600">Use D-Pad Arrow keys or Remote to browse channels</p>
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
          muted={isMuted}
          autoPlay={autoPlay}
        />
      )}

      {/* Buffering Spinner Overlay */}
      {showBufferSpinner && !isPremiumLocked && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex flex-col items-center justify-center z-20 gap-3">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-blue-500/50" />
          <span className="text-xs font-bold uppercase tracking-widest text-blue-400 animate-pulse">
            Connecting Stream...
          </span>
        </div>
      )}

      {/* Stream Error Banner */}
      {errorMsg && !isPremiumLocked && (
        <div className="absolute z-20 bg-black/90 border border-red-500/50 p-6 rounded-2xl flex flex-col items-center gap-3 text-center max-w-sm">
          <AlertTriangle className="w-10 h-10 text-red-400" />
          <p className="text-white font-bold text-sm">{errorMsg}</p>
          <button
            onClick={() => {
              setErrorMsg(null);
              videoRef.current?.load();
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Reconnect
          </button>
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
            This is a Premium Channel. Please login to continue.
          </h2>

          <p className="text-sm text-gray-400 max-w-md mb-6">
            {!currentUser
              ? 'Access 100+ Live HD Channels, Sports, Movies & 4K streams with an active IPTV subscription.'
              : 'Your current plan does not include this premium stream. Please renew or upgrade your subscription.'}
          </p>

          <div className="flex items-center gap-3">
            {!currentUser ? (
              <button
                onClick={onOpenLogin}
                className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-600/25 text-xs uppercase tracking-wider transition-all scale-105"
              >
                Login to Watch
              </button>
            ) : (
              <button
                onClick={onOpenSubscription}
                className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-xl shadow-emerald-600/25 text-xs uppercase tracking-wider transition-all scale-105"
              >
                Renew Subscription
              </button>
            )}

            <button
              onClick={onNextChannel}
              className="px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl text-xs uppercase tracking-wider border border-white/10 transition-colors"
            >
              Skip to Next
            </button>
          </div>
        </div>
      )}

      {/* TRANSPARENT OSD CONTROLS */}
      {!isPremiumLocked && showControls && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-black/80 z-20 flex flex-col justify-between p-6 transition-opacity duration-300">
          {/* Top Channel Header Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="px-3.5 py-1.5 bg-blue-600 text-white font-bold text-lg rounded-xl font-mono shadow-md">
                Ch. {channel.channelNumber}
              </div>
              <img
                src={channel.logo}
                alt={channel.name}
                className="w-10 h-10 rounded-xl object-cover bg-white/5 border border-white/10 shadow-md"
              />
              <div>
                <h3 className="text-white font-bold text-lg tracking-wide flex items-center gap-2">
                  {channel.name}
                  {channel.isPremium && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-bold ${
                      isSubscriptionActive 
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                        : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                    }`}>
                      {isSubscriptionActive ? 'PREMIUM UNLOCKED' : 'PREMIUM'}
                    </span>
                  )}
                </h3>
                <p className="text-blue-400 text-xs font-semibold">{channel.category}</p>
              </div>
            </div>

            {/* Audio Track Selector if available */}
            {audioTracks.length > 1 && (
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-gray-300">
                <Sliders className="w-4 h-4 text-blue-400" />
                <select
                  value={selectedAudio}
                  onChange={e => handleAudioTrackChange(Number(e.target.value))}
                  className="bg-transparent font-bold focus:outline-none cursor-pointer"
                >
                  {audioTracks.map(track => (
                    <option key={track.id} value={track.id} className="bg-black text-white">
                      {track.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Bottom Control & EPG Timeline Bar */}
          <div className="space-y-4">
            {/* EPG Current & Next Program Info */}
            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-md flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                  <span className="font-bold text-white text-sm">
                    {currentEpg?.title || 'Live Transmission Broadcast'}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-gray-400">
                    {currentEpg
                      ? `${currentEpg.startTime} - ${currentEpg.endTime}`
                      : '24/7 HD STREAM'}
                  </span>
                  <span className="text-amber-400 font-black bg-amber-400/20 px-2 py-0.5 rounded border border-amber-400/30 text-[10px]">
                    {epgProgress}%
                  </span>
                  {bufferedPercent > 0 && (
                    <span className="text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 text-[10px] hidden sm:inline-block">
                      {bufferedPercent}% BUFFER
                    </span>
                  )}
                </div>
              </div>

              {/* Dynamic Live Stream Progress Bar */}
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden relative border border-white/10">
                {/* Buffer Fill */}
                {bufferedPercent > 0 && (
                  <div
                    className="bg-emerald-500/30 h-full absolute left-0 top-0 transition-all duration-300"
                    style={{ width: `${Math.max(epgProgress, bufferedPercent)}%` }}
                  />
                )}
                {/* Dynamic Program Progress Fill */}
                <div
                  className={`h-full bg-gradient-to-r ${theme.accentGradient} rounded-full relative z-10 transition-all duration-500 shadow-md`}
                  style={{ width: `${epgProgress}%` }}
                />
              </div>

              {nextEpg && (
                <p className="text-gray-400 text-[11px] font-medium flex items-center gap-1">
                  <span className="text-blue-400 font-bold uppercase">Next:</span> {nextEpg.title}
                </p>
              )}
            </div>

            {/* Transport Action Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={onPrevChannel}
                  className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/10 transition-all hover:scale-105 active:scale-95"
                  title="Previous Channel"
                >
                  <SkipBack className="w-5 h-5" />
                </button>

                <button
                  onClick={togglePlay}
                  className="p-3.5 bg-white hover:bg-gray-200 text-black font-bold rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-6 h-6 fill-black" /> : <Play className="w-6 h-6 fill-black" />}
                </button>

                <button
                  onClick={onNextChannel}
                  className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/10 transition-all hover:scale-105 active:scale-95"
                  title="Next Channel"
                >
                  <SkipForward className="w-5 h-5" />
                </button>

                <button
                  onClick={toggleMute}
                  className="p-3 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-xl border border-white/10 transition-colors"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <div className="w-24 hidden sm:flex items-center">
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05" 
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setVolume(v);
                      if (v === 0) {
                        setIsMuted(true);
                      } else {
                        setIsMuted(false);
                      }
                    }}
                    className="w-full accent-blue-500 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Auto Reconnect ON
                </span>

                <button
                  onClick={toggleFullscreen}
                  className="p-3 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-xl border border-white/10 transition-colors"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Fullscreen TV Remote Channel Number Buffer Overlay */}
      {numberBuffer && (
        <div className="absolute top-4 left-4 z-50 animate-in fade-in duration-150">
          <div className="bg-slate-900/95 border-2 border-amber-400 rounded-2xl p-4 shadow-xl shadow-amber-500/20 backdrop-blur-xl flex flex-col items-center gap-2 min-w-[150px] text-center animate-in fade-in zoom-in-95 duration-200">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">TUNING</span>
            <div className="text-4xl font-black text-white font-mono tracking-widest">
              {numberBuffer}
            </div>
            {(() => {
              const matched = allChannels.find(c => c.channelNumber === parseInt(numberBuffer, 10));
              return (
                <div className="mt-1 flex flex-col items-center gap-1">
                  {matched ? (
                    <>
                      <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <img src={matched.logo} alt={matched.name} className="w-4 h-4 rounded object-cover" />
                        <span className="text-[10px] font-black text-amber-300 truncate max-w-[100px]">{matched.name}</span>
                      </div>
                      <span className="text-[8px] text-slate-400 font-bold">Switching in {countdown}s...</span>
                    </>
                  ) : (
                    <span className="text-[10px] text-rose-400 font-bold">Not found</span>
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
