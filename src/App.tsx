/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { LoginModal } from "./components/LoginModal";
import { SubscriptionModal } from "./components/SubscriptionModal";
import { AdminPanel } from "./components/AdminPanel";
import { ThemeSelectorModal, THEMES } from "./components/ThemeSelector";
import { SettingsView } from "./components/SettingsView";
import { apiService } from "./services/api";
import { Channel, ViewMode, User, EPGProgram, ThemeId } from "./types";
import { AlertCircle } from "lucide-react";

import { BlinkWebTVView } from "./components/BlinkWebTVView";
import { SeriesVodPage } from "./components/SeriesVodPage";
import { PinLockModal } from "./components/PinLockModal";

export default function App() {
  const [currentView, setCurrentView] = useState<ViewMode>("livetv");
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => {
    try {
      return (localStorage.getItem("myiptv_theme") as ThemeId) || "gold";
    } catch (e) {
      return "gold";
    }
  });
  const [isThemeOpen, setIsThemeOpen] = useState(false);

  const [channels, setChannels] = useState<Channel[]>([]);

  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [activeChannel, setActiveChannel] = useState<Channel | null>(() => {
    try {
      const saved = localStorage.getItem("myiptv_active_channel");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [currentEpg, setCurrentEpg] = useState<EPGProgram | null>(null);
  const [nextEpg, setNextEpg] = useState<EPGProgram | null>(null);

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const local = localStorage.getItem("myiptv_user_data");
      if (local) {
        const u = JSON.parse(local);
        if (u && (u.id || u.email || u.username)) return u;
      }
      const token = localStorage.getItem("myiptv_jwt_token");
      if (token) {
        const decoded = JSON.parse(atob(token));
        if (decoded && decoded.id) {
          const isAdmin =
            decoded.role === "admin" ||
            (decoded.email || "").toLowerCase().includes("anondo") ||
            (decoded.username || "").toLowerCase() === "admin";
          return {
            id: decoded.id,
            username: decoded.username || (isAdmin ? "admin" : "User"),
            email: decoded.email || (isAdmin ? "anondoray554@gmail.com" : "user@myiptv.com"),
            role: isAdmin ? "admin" : (decoded.role || "user"),
            subscriptionPlan: isAdmin ? "365 Days" : (decoded.plan || "Free"),
            subscriptionExpiresAt: isAdmin ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : null,
            favorites: [],
            recentlyWatched: [],
            isApprovedByAdmin: isAdmin ? true : Boolean(decoded.isApprovedByAdmin),
          };
        }
      }
    } catch (e) {}
    return null;
  });
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const local = localStorage.getItem("myiptv_user_data");
      if (local) {
        const u = JSON.parse(local);
        if (Array.isArray(u.favorites)) return u.favorites;
      }
    } catch (e) {}
    return [];
  });
  const [recentlyWatched, setRecentlyWatched] = useState<string[]>(() => {
    try {
      const local = localStorage.getItem("myiptv_user_data");
      if (local) {
        const u = JSON.parse(local);
        if (Array.isArray(u.recentlyWatched)) return u.recentlyWatched;
      }
    } catch (e) {}
    return [];
  });

  // Modals
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Playlist & Category Lock State (Default PIN 0000)
  const [playlistPin, setPlaylistPin] = useState<string>(() => {
    try {
      return localStorage.getItem("myiptv_playlist_pin") || "0000";
    } catch (e) {
      return "0000";
    }
  });
  const [unlockedCategories, setUnlockedCategories] = useState<string[]>([]);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinTargetCategory, setPinTargetCategory] = useState<string>("Adult (18+)");
  const [pendingChannel, setPendingChannel] = useState<Channel | null>(null);

  const isCategoryLocked = useCallback(
    (catName: string) => {
      if (
        !catName ||
        catName === "All" ||
        catName === "Watchlist" ||
        catName === "History" ||
        catName === "Favorites"
      )
        return false;
      if (currentUser?.hasAdultAccess) return false;
      if (unlockedCategories.includes(catName)) return false;
      const lower = catName.toLowerCase();
      return (
        lower.includes("adult") ||
        lower.includes("18+") ||
        lower.includes("xxx") ||
        lower.includes("for adult") ||
        lower.includes("erotic") ||
        lower.includes("nsfw") ||
        lower.includes("hot") ||
        lower.includes("mature") ||
        lower.includes("blue") ||
        lower.includes("private") ||
        lower.includes("porn") ||
        lower.includes("sex") ||
        lower.includes("midnight") ||
        lower.includes("erotica") ||
        lower.includes("blue film")
      );
    },
    [unlockedCategories, currentUser],
  );

  const handleSelectCategory = (catName: string) => {
    if (isCategoryLocked(catName)) {
      setPinTargetCategory(catName);
      setPendingChannel(null);
      setIsPinModalOpen(true);
      return;
    }
    setSelectedCategory(catName);
  };

  const handleSelectChannel = (channel: Channel) => {
    if (isCategoryLocked(channel.category)) {
      setPinTargetCategory(channel.category);
      setPendingChannel(channel);
      setIsPinModalOpen(true);
      return;
    }
    setActiveChannel(channel);
    // If we're not in a special category view, switch to the channel's category
    if (selectedCategory !== "All" && selectedCategory !== "Watchlist" && selectedCategory !== "History" && selectedCategory !== "Series / VOD" && selectedCategory !== channel.category) {
       setSelectedCategory(channel.category);
    }
    try {
      localStorage.setItem("myiptv_active_channel", JSON.stringify(channel));
    } catch (e) {}
  };

  const handlePinSuccess = () => {
    setUnlockedCategories((prev) => [...prev, pinTargetCategory]);
    setSelectedCategory(pinTargetCategory);
    if (pendingChannel) {
      setActiveChannel(pendingChannel);
      try {
        localStorage.setItem("myiptv_active_channel", JSON.stringify(pendingChannel));
      } catch (e) {}
      setPendingChannel(null);
    }
  };

  const handleChangePin = (newPin: string) => {
    setPlaylistPin(newPin);
    try {
      localStorage.setItem("myiptv_playlist_pin", newPin);
    } catch (e) {}
  };

  // TV Remote Focus & Navigation State
  const [isSidebarFocused, setIsSidebarFocused] = useState(false);
  const [sidebarFocusedIdx, setSidebarFocusedIdx] = useState(0);
  const [isGridFocused, setIsGridFocused] = useState(true);
  const [gridFocusedIdx, setGridFocusedIdx] = useState(0);

  const selectChannelTimer = useRef<NodeJS.Timeout | null>(null);

  // Clock Ticker
  const [timeStr, setTimeStr] = useState<string>("");
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle switching to Admin Panel smoothly
  const handleOpenAdmin = () => {
    if (currentUser?.role !== "admin") {
      setIsLoginOpen(true);
      return;
    }
    setIsAdminOpen(true);
  };

  const handleLogout = () => {
    apiService.logout();
    setCurrentUser(null);
    setFavorites([]);
    setRecentlyWatched([]);
    setIsAdminOpen(false);
    loadInitialData();
  };

  // Load Initial Data from Backend
  const loadInitialData = async () => {
    try {
      const [chs, cats, user] = await Promise.all([
        apiService.fetchChannels().catch((err) => {
          console.warn("fetchChannels error in loadInitialData:", err);
          return [] as Channel[];
        }),
        apiService.fetchCategories().catch((err) => {
          console.warn("fetchCategories error in loadInitialData:", err);
          return ["All", "Entertainment", "News", "Sports", "Kids", "Music"];
        }),
        apiService.getCurrentUser().catch((err) => {
          console.warn("getCurrentUser error in loadInitialData:", err);
          return null;
        }),
      ]);

      if (Array.isArray(chs)) {
        const seenIds = new Set<string>();
        const uniqueChs = chs.map((c, idx) => {
          let id = c.id || `channel_${idx + 1}`;
          if (seenIds.has(id)) {
            id = `${id}_${idx + 1}`;
          }
          seenIds.add(id);
          return { ...c, id };
        });
        setChannels(uniqueChs);
      } else {
        setChannels([]);
      }
      
      const serverCats = Array.isArray(cats) ? cats : (cats && Array.isArray((cats as any).categories)) ? (cats as any).categories : [];
      const extractedCats = Array.from(new Set((chs || []).map((c) => c.category).filter(Boolean)));
      const combinedCats = Array.from(new Set(["All", ...serverCats.filter((c: string) => c !== "All"), ...extractedCats]));
      setCategories(combinedCats.length > 1 ? combinedCats : ["All", "Sports", "Bangla", "India", "Entertainment", "Kids", "News", "Series / VOD", "Music"]);

      if (user) {
        setCurrentUser(user);
        setFavorites(user.favorites || []);
        setRecentlyWatched(user.recentlyWatched || []);
        try {
          localStorage.setItem("myiptv_user_data", JSON.stringify(user));
        } catch (e) {}
      } else {
        const local = localStorage.getItem("myiptv_user_data");
        if (local) {
          try {
            const parsed = JSON.parse(local);
            if (parsed) {
              setCurrentUser(parsed);
              if (Array.isArray(parsed.favorites)) setFavorites(parsed.favorites);
              if (Array.isArray(parsed.recentlyWatched)) setRecentlyWatched(parsed.recentlyWatched);
            }
          } catch (e) {}
        }
      }

      if (chs.length === 0) {
        setActiveChannel(null);
        try {
          localStorage.removeItem("myiptv_active_channel");
        } catch (e) {}
        return;
      }

      // Update active channel reference if active or saved in new list
      setActiveChannel((prev) => {
        if (prev) {
          const matched = chs.find((c) => c.id === prev.id || c.name === prev.name);
          if (matched) return matched;
        }
        const savedChannelJson = localStorage.getItem("myiptv_active_channel");
        if (savedChannelJson) {
          try {
            const saved = JSON.parse(savedChannelJson) as Channel;
            const found = chs.find((c) => c.id === saved.id || c.name === saved.name);
            if (found) return found;
          } catch (e) {}
        }
        return chs[0] || null;
      });
    } catch (err: any) {
      console.error("Failed to load initial data:", err);
    }
  };

  useEffect(() => {
    // Migrate old settings to enable high-compatibility IPTV proxy by default (essential to bypass CORS and Mixed Content on TV/browsers)
    try {
      const saved = localStorage.getItem("myiptv_settings");
      if (!saved) {
        // Initial setup if not exists
        localStorage.setItem("myiptv_settings", JSON.stringify({
          language: "bn",
          theme: "dark",
          autoPlay: true,
          autoReconnect: true,
          bufferSize: 30,
          streamQuality: "auto",
          channelPreloading: true,
          streamProxyEnabled: true,
        }));
      } else {
        const parsed = JSON.parse(saved);
        if (parsed.streamProxyEnabled !== true) {
          parsed.streamProxyEnabled = true;
          localStorage.setItem("myiptv_settings", JSON.stringify(parsed));
          window.dispatchEvent(
            new CustomEvent("myiptv_settings_updated", { detail: parsed })
          );
        }
      }
    } catch (e) {}

    loadInitialData();
  }, []);

  // Fetch EPG for active channel
  useEffect(() => {
    if (!activeChannel) return;

    // Track recently watched
    setRecentlyWatched((prev) =>
      Array.from(new Set([activeChannel.id, ...prev])).slice(0, 10),
    );

    apiService
      .fetchEPG(activeChannel.id)
      .then((epgList) => {
        if (Array.isArray(epgList) && epgList.length > 0) {
          setCurrentEpg(epgList[0]);
          setNextEpg(epgList[1] || null);
        } else {
          setCurrentEpg(null);
          setNextEpg(null);
        }
      })
      .catch(() => {
        setCurrentEpg(null);
        setNextEpg(null);
      });
  }, [activeChannel]);

  const isSubscriptionActive = Boolean(
    currentUser &&
      (currentUser.role === "admin" ||
        (currentUser.isApprovedByAdmin === true &&
          (currentUser.subscriptionStatus === "active" ||
            (currentUser.subscriptionExpiresAt &&
              new Date(currentUser.subscriptionExpiresAt).getTime() > Date.now())))),
  );

  // Filter channels based on View, Category & Search (Show all channels so free users see VIP lock badges)
  let filteredChannels = channels.filter((c) => c.isActive !== false);

  // Handle Series / VOD view specifically - do NOT show regular TV channels here!
  if (currentView === "series" || selectedCategory === "Series" || selectedCategory === "Series / VOD") {
    filteredChannels = filteredChannels.filter((c) => {
      const cat = (c.category || "").toLowerCase();
      const name = (c.name || "").toLowerCase();
      return (
        cat.includes("series") ||
        cat.includes("season") ||
        cat.includes("episode") ||
        cat.includes("vod") ||
        cat.includes("movie") ||
        cat.includes("cinema") ||
        name.includes("series") ||
        name.includes("season") ||
        name.includes("movie")
      );
    });
  } else if (currentView === "movies" || selectedCategory === "Movies" || selectedCategory === "VOD") {
    filteredChannels = filteredChannels.filter((c) => {
      const cat = (c.category || "").toLowerCase();
      const name = (c.name || "").toLowerCase();
      return (
        cat.includes("vod") ||
        cat.includes("movie") ||
        cat.includes("cinema") ||
        cat.includes("film") ||
        name.includes("movie")
      );
    });
  } else if (currentView === "livetv" && selectedCategory === "All") {
    // Hide VODs and Series from Live TV "All" view to prevent clutter only if other channels exist
    const nonVod = filteredChannels.filter((c) => {
      const cat = (c.category || "").toLowerCase();
      return !(cat.includes("vod") || cat.includes("movie") || cat.includes("cinema") || cat.includes("series") || cat.includes("season"));
    });
    if (nonVod.length > 0) {
      filteredChannels = nonVod;
    }
  } else if (selectedCategory === "Watchlist") {
    filteredChannels = filteredChannels.filter((c) => favorites.includes(c.id));
  } else if (selectedCategory === "History") {
    filteredChannels = filteredChannels.filter((c) =>
      recentlyWatched.includes(c.id),
    );
  } else if (selectedCategory !== "All") {
    filteredChannels = filteredChannels.filter(
      (c) => (c?.category || "").toLowerCase() === (selectedCategory || "").toLowerCase(),
    );
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filteredChannels = filteredChannels.filter(
      (c) =>
        (c?.name || "").toLowerCase().includes(q) ||
        (c?.category || "").toLowerCase().includes(q) ||
        (c?.channelNumber || "").toString().includes(q),
    );
  }

  const handlePrevChannel = useCallback(() => {
    const activeList = filteredChannels;
    if (activeList.length === 0) return;
    
    // Find current index, strictly by ID
    const currentIdx = activeChannel ? activeList.findIndex((c) => c.id === activeChannel.id) : -1;
    
    // If not found, start from the last one or first one based on preference
    const prevIdx = currentIdx <= 0 ? activeList.length - 1 : currentIdx - 1;
    handleSelectChannel(activeList[prevIdx]);
  }, [filteredChannels, activeChannel]);

  const handleNextChannel = useCallback(() => {
    const activeList = filteredChannels;
    if (activeList.length === 0) return;
    
    // Find current index, strictly by ID
    const currentIdx = activeChannel ? activeList.findIndex((c) => c.id === activeChannel.id) : -1;
    
    // If not found, start from the first one
    const nextIdx = (currentIdx === -1 || currentIdx === activeList.length - 1) ? 0 : currentIdx + 1;
    handleSelectChannel(activeList[nextIdx]);
  }, [filteredChannels, activeChannel]);

  // Toggle Favorite
  const handleToggleFavorite = async (channelId: string) => {
    if (!currentUser) {
      setIsLoginOpen(true);
      return;
    }
    try {
      const updatedFavs = await apiService.toggleFavorite(channelId);
      setFavorites(updatedFavs);
    } catch {
      // Local fallback
      setFavorites((prev) =>
        prev.includes(channelId)
          ? prev.filter((id) => id !== channelId)
          : [...prev, channelId],
      );
    }
  };

  // Channel Number Direct Jump Buffer Logic
  // TV remote numeric channel entry buffer
  const numberBufferRef = useRef<string>("");
  const numberTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard Event Listener for Android TV / Smart TV Remote Keys & Keyboard Direct Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore typing inside text inputs
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // 1. Direct channel number entry (0-9 keys)
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        if (numberTimeoutRef.current) clearTimeout(numberTimeoutRef.current);
        numberBufferRef.current += e.key;

        const currentInput = numberBufferRef.current;
        numberTimeoutRef.current = setTimeout(() => {
          const targetNum = parseInt(currentInput, 10);
          numberBufferRef.current = "";
          if (!isNaN(targetNum)) {
            const matched = channels.find((c) => c.channelNumber === targetNum && c.isActive !== false);
            if (matched) {
              handleSelectChannel(matched);
            }
          }
        }, 1200); // Wait 1.2s for multi-digit entry (e.g. "12")
        return;
      }

      // 2. Navigation Keys (Arrow keys, Page/Channel Up/Down)
      switch (e.key) {
        case "ArrowUp":
        case "PageUp":
        case "ChannelUp":
          e.preventDefault();
          handlePrevChannel();
          break;

        case "ArrowDown":
        case "PageDown":
        case "ChannelDown":
          e.preventDefault();
          handleNextChannel();
          break;

        case "ArrowLeft":
          // Quick Category navigation (Previous category)
          e.preventDefault();
          if (categories.length > 0) {
            const currentIdx = categories.indexOf(selectedCategory);
            const prevIdx = currentIdx <= 0 ? categories.length - 1 : currentIdx - 1;
            handleSelectCategory(categories[prevIdx]);
          }
          break;

        case "ArrowRight":
          // Quick Category navigation (Next category)
          e.preventDefault();
          if (categories.length > 0) {
            const currentIdx = categories.indexOf(selectedCategory);
            const nextIdx = (currentIdx === -1 || currentIdx === categories.length - 1) ? 0 : currentIdx + 1;
            handleSelectCategory(categories[nextIdx]);
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (numberTimeoutRef.current) clearTimeout(numberTimeoutRef.current);
    };
  }, [
    channels,
    categories,
    selectedCategory,
    handlePrevChannel,
    handleNextChannel,
  ]);

  const activeTheme = THEMES[currentTheme] || THEMES.gold;

  return (
    <div
      className={`relative h-screen w-screen bg-slate-950 text-white font-sans overflow-hidden select-none`}
    >
      {/* Primary View: Series / VOD Standalone Page OR Blink Web TV Live Portal */}
      {currentView === "series" ? (
        <SeriesVodPage
          onBackToLiveTv={() => setCurrentView("livetv")}
          isSubscriptionActive={isSubscriptionActive}
          onOpenSubscription={() => setIsSubscriptionOpen(true)}
          onOpenLogin={() => setIsLoginOpen(true)}
          currentUser={currentUser}
          theme={activeTheme}
          channels={channels}
          isCategoryLocked={isCategoryLocked}
          onUnlockAdult={(catName) => {
            setPinTargetCategory(catName);
            setIsPinModalOpen(true);
          }}
        />
      ) : (
        <BlinkWebTVView
          channels={filteredChannels}
          allChannels={channels}
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={handleSelectCategory}
          isCategoryLocked={isCategoryLocked}
          activeChannel={activeChannel}
          onSelectChannel={handleSelectChannel}
          currentEpg={currentEpg}
          nextEpg={nextEpg}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
          currentUser={currentUser}
          onOpenLogin={() => setIsLoginOpen(true)}
          onOpenSubscription={() => setIsSubscriptionOpen(true)}
          onOpenAdmin={handleOpenAdmin}
          onPrevChannel={handlePrevChannel}
          onNextChannel={handleNextChannel}
          currentTheme={currentTheme}
          onOpenThemeSelector={() => setIsThemeOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          currentView={currentView}
          onSelectView={setCurrentView}
          timeStr={timeStr}
          recentlyWatched={recentlyWatched}
          onLogout={handleLogout}
        />
      )}

      {/* Admin Panel Modal Overlay */}
      {isAdminOpen && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-50 overflow-y-auto pt-safe sm:p-6 flex flex-col animate-in fade-in-50 duration-200">
          <div className="max-w-7xl w-full mx-auto flex-1 flex flex-col px-4 sm:px-0">
            <div className="sticky top-0 z-50 flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 mb-6 shrink-0 gap-4 bg-slate-950 pt-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                  <AlertCircle className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">
                    Admin Control
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLogout}
                  className="px-4 py-3 bg-rose-500/15 hover:bg-rose-500 border border-rose-500/30 hover:border-rose-400 text-rose-400 hover:text-slate-950 text-[10px] font-black rounded-2xl transition-all shadow-md uppercase tracking-wider flex items-center gap-1.5 shrink-0"
                >
                  Logout ✕
                </button>
                <button
                  onClick={() => {
                    setIsAdminOpen(false);
                    loadInitialData(); // Reload updated playlist data
                  }}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-black text-sm font-black rounded-2xl transition-all shadow-lg shadow-amber-500/20 uppercase tracking-wider shrink-0"
                >
                  Close ✕
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 bg-slate-900/40 border border-slate-800/60 rounded-3xl p-4 sm:p-6 overflow-y-auto">
              <AdminPanel onDataChanged={loadInitialData} />
            </div>
          </div>
        </div>
      )}

      {/* Auth & Subscription Modals */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setFavorites(user.favorites || []);
          loadInitialData();
        }}
      />

      <SubscriptionModal
        isOpen={isSubscriptionOpen}
        onClose={() => setIsSubscriptionOpen(false)}
        currentUser={currentUser}
        onSubscriptionUpdated={(updatedUser) => {
          setCurrentUser(updatedUser);
        }}
      />

      <ThemeSelectorModal
        isOpen={isThemeOpen}
        onClose={() => setIsThemeOpen(false)}
        currentTheme={currentTheme}
        onSelectTheme={(theme) => {
          setCurrentTheme(theme);
          try {
            localStorage.setItem("myiptv_theme", theme);
          } catch (e) {}
        }}
      />

      {/* Settings Modal Overlay */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-50 overflow-y-auto sm:p-6 flex flex-col items-center sm:justify-center animate-in fade-in-50 duration-200">
          <div className="max-w-4xl w-full mx-auto min-h-full sm:min-h-0 flex flex-col">
            <SettingsView onClose={() => setIsSettingsOpen(false)} />
          </div>
        </div>
      )}

      {/* Playlist & Category PIN Lock Modal */}
      <PinLockModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPendingChannel(null);
        }}
        onSuccess={handlePinSuccess}
        targetName={pinTargetCategory}
        currentPin={playlistPin}
        onChangePin={handleChangePin}
      />
    </div>
  );
}
