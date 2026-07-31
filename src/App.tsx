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

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentlyWatched, setRecentlyWatched] = useState<string[]>([]);

  // Modals
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
        apiService.fetchChannels(),
        apiService.fetchCategories(),
        apiService.getCurrentUser(),
      ]);

      setChannels(chs);
      setCategories(cats);

      if (user) {
        setCurrentUser(user);
        setFavorites(user.favorites || []);
        setRecentlyWatched(user.recentlyWatched || []);
      }

      if (chs.length === 0) {
        setActiveChannel(null);
        try {
          localStorage.removeItem("myiptv_active_channel");
        } catch (e) {}
        return;
      }

      // Try to restore last watched channel from the new list
      const savedChannelJson = localStorage.getItem("myiptv_active_channel");
      if (savedChannelJson) {
        try {
          const saved = JSON.parse(savedChannelJson) as Channel;
          const found = chs.find((c) => c.id === saved.id);
          if (found) {
            setActiveChannel(found);
            return;
          }
        } catch (e) {}
      }

      if (chs.length > 0 && !activeChannel) {
        setActiveChannel(chs[0]);
      }
    } catch (err: any) {
      console.error("Failed to load initial data:", err);
      // Try to identify which one failed
      try {
        await apiService.fetchCategories();
      } catch (catErr) {
        console.error("Specifically failed to fetch categories:", catErr);
      }
    }
  };

  useEffect(() => {
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

  // Handle Channel Switch
  const handleSelectChannel = useCallback((channel: Channel) => {
    setActiveChannel(channel);
    try {
      localStorage.setItem("myiptv_active_channel", JSON.stringify(channel));
    } catch (e) {}
  }, []);

  const isSubscriptionActive = Boolean(
    currentUser &&
      (currentUser.role === "admin" ||
        currentUser.subscriptionStatus === "active" ||
        (currentUser.subscriptionExpiresAt &&
          new Date(currentUser.subscriptionExpiresAt).getTime() > Date.now())),
  );

  // Filter channels based on View, Category & Search (Show all channels so free users see VIP lock badges)
  const filteredChannels = useMemo(() => {
    let list = channels.filter((c) => c.isActive);

    if (
      currentView === "series" ||
      selectedCategory === "Series" ||
      selectedCategory === "Series / VOD"
    ) {
      list = list.filter((c) => {
        const cat = (c.category || "").toLowerCase();
        const name = (c.name || "").toLowerCase();
        return (
          cat.includes("series") ||
          cat.includes("vod") ||
          cat.includes("drama") ||
          name.includes("series") ||
          name.includes("season")
        );
      });
    } else if (selectedCategory === "Watchlist") {
      list = list.filter((c) => favorites.includes(c.id));
    } else if (selectedCategory === "History") {
      list = list.filter((c) => recentlyWatched.includes(c.id));
    } else if (selectedCategory !== "All") {
      const targetCat = selectedCategory.toLowerCase();
      list = list.filter((c) => (c.category || "").toLowerCase() === targetCat);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.channelNumber.toString().includes(q),
      );
    }

    return list;
  }, [channels, currentView, selectedCategory, favorites, recentlyWatched, searchQuery]);

  const handlePrevChannel = useCallback(() => {
    setActiveChannel((prevActive) => {
      const activeList = filteredChannels.length > 0 ? filteredChannels : channels;
      if (activeList.length === 0) return prevActive;
      if (!prevActive) return activeList[0];
      const currentIdx = activeList.findIndex((c) => c.id === prevActive.id || c.name === prevActive.name);
      const prevIdx = currentIdx === -1 ? 0 : (currentIdx - 1 + activeList.length) % activeList.length;
      return activeList[prevIdx];
    });
  }, [channels, filteredChannels]);

  const handleNextChannel = useCallback(() => {
    setActiveChannel((prevActive) => {
      const activeList = filteredChannels.length > 0 ? filteredChannels : channels;
      if (activeList.length === 0) return prevActive;
      if (!prevActive) return activeList[0];
      const currentIdx = activeList.findIndex((c) => c.id === prevActive.id || c.name === prevActive.name);
      const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % activeList.length;
      return activeList[nextIdx];
    });
  }, [channels, filteredChannels]);

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
  // Keyboard Event Listener for Android TV Remote Keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore typing inside text inputs
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          if (isGridFocused) {
            setGridFocusedIdx((prev) => Math.max(0, prev - 4));
          } else if (isSidebarFocused) {
            setSidebarFocusedIdx((prev) => Math.max(0, prev - 1));
          }
          break;

        case "ArrowDown":
          e.preventDefault();
          if (isGridFocused) {
            setGridFocusedIdx((prev) =>
              Math.min(filteredChannels.length - 1, prev + 4),
            );
          } else if (isSidebarFocused) {
            setSidebarFocusedIdx((prev) => Math.min(20, prev + 1));
          }
          break;

        case "ArrowLeft":
          e.preventDefault();
          if (isGridFocused && gridFocusedIdx % 4 === 0) {
            setIsGridFocused(false);
            setIsSidebarFocused(true);
          } else if (isGridFocused) {
            setGridFocusedIdx((prev) => Math.max(0, prev - 1));
          }
          break;

        case "ArrowRight":
          e.preventDefault();
          if (isSidebarFocused) {
            setIsSidebarFocused(false);
            setIsGridFocused(true);
          } else if (isGridFocused) {
            setGridFocusedIdx((prev) =>
              Math.min(filteredChannels.length - 1, prev + 1),
            );
          }
          break;

        case "Enter":
          e.preventDefault();
          if (isGridFocused && filteredChannels[gridFocusedIdx]) {
            setActiveChannel(filteredChannels[gridFocusedIdx]);
          }
          break;

        case "Backspace":
        case "Escape":
          e.preventDefault();
          setIsSidebarFocused(true);
          setIsGridFocused(false);
          break;

        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isGridFocused,
    isSidebarFocused,
    gridFocusedIdx,
    sidebarFocusedIdx,
    channels,
  ]);

  const activeTheme = THEMES[currentTheme] || THEMES.gold;

  return (
    <div
      className={`relative h-screen w-screen bg-slate-950 text-white font-sans overflow-hidden select-none`}
    >
      {/* Primary View: Blink Web TV Live Portal */}
      <BlinkWebTVView
          channels={filteredChannels}
          allChannels={channels}
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
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

      {/* Admin Panel Modal Overlay */}
      {isAdminOpen && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-50 overflow-y-auto p-4 sm:p-6 flex flex-col animate-in fade-in-50 duration-200">
          <div className="max-w-7xl w-full mx-auto flex-1 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                  <AlertCircle className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">
                    Admin Control Panel
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                    Manage playlists, streams, categories, and users
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-rose-500/15 hover:bg-rose-500 border border-rose-500/30 hover:border-rose-400 text-rose-400 hover:text-slate-950 text-xs font-black rounded-xl transition-all shadow-md uppercase tracking-wider flex items-center gap-1.5 shrink-0"
                >
                  Logout Account ✕
                </button>
                <button
                  onClick={() => {
                    setIsAdminOpen(false);
                    loadInitialData(); // Reload updated playlist data
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs font-black text-white rounded-xl transition-all shadow-md uppercase tracking-wider shrink-0"
                >
                  Close Panel ✕
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
          if (user.role === "admin") {
            setIsAdminOpen(true);
          }
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
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-50 overflow-y-auto p-4 sm:p-6 flex items-center justify-center animate-in fade-in-50 duration-200">
          <div className="max-w-4xl w-full mx-auto">
            <SettingsView onClose={() => setIsSettingsOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
