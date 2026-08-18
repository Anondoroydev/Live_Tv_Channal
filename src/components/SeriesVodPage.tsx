import React, { useState, useMemo } from "react";
import {
  Tv,
  Play,
  Search,
  Star,
  Film,
  Sparkles,
  Lock,
  ArrowLeft,
  X,
  Clapperboard,
  Check,
  ChevronRight,
  Info,
  Clock,
} from "lucide-react";
import { SeriesItem, Episode, User, ThemeConfig, Channel } from "../types";
import { VideoPlayer } from "./VideoPlayer";

interface SeriesVodPageProps {
  onBackToLiveTv: () => void;
  isSubscriptionActive: boolean;
  onOpenSubscription: () => void;
  onOpenLogin: () => void;
  currentUser: User | null;
  theme: ThemeConfig;
  channels: Channel[];
  isCategoryLocked?: (catName: string) => boolean;
  onUnlockAdult?: (catName: string) => void;
}

export const SeriesVodPage: React.FC<SeriesVodPageProps> = ({
  onBackToLiveTv,
  isSubscriptionActive,
  onOpenSubscription,
  onOpenLogin,
  currentUser,
  theme,
  channels,
  isCategoryLocked,
  onUnlockAdult,
}) => {
  const seriesList = useMemo(() => {
    // Only include items that are not standard live TV channels based on typical VOD naming/grouping
    const vodChannels = channels.filter((c) => {
      const cat = (c.category || "").toLowerCase();
      const name = (c.name || "").toLowerCase();
      
      // If category is locked and user doesn't have permanent access, hide from this view
      if (isCategoryLocked && isCategoryLocked(c.category) && !currentUser?.hasAdultAccess) {
        return false;
      }

      // Filter: Explicitly check for VOD/Series indicators
      const isVod = 
        cat.includes("series") ||
        cat.includes("vod") ||
        cat.includes("movie") ||
        cat.includes("drama") ||
        cat.includes("film") ||
        cat.includes("cinema") ||
        name.includes("s0") ||
        name.includes("season") ||
        name.includes("episode") ||
        name.includes("ep ");

      return isVod;
    });

    if (vodChannels.length > 0) {
      return vodChannels.map((c) => ({
        id: c.id,
        title: c.name,
        banglaTitle: "",
        genre: c.category || "VOD / Series",
        description: `VOD / Series stream from playlist: ${c.name}`,
        rating: 8.9,
        year: 2024,
        poster: c.logo || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop&q=80",
        banner: c.logo || "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=80",
        totalSeasons: 1,
        isPremium: c.isPremium,
        episodes: [
          {
            id: `${c.id}-ep1`,
            seasonNumber: 1,
            episodeNumber: 1,
            title: c.name,
            duration: "45m",
            streamUrl: c.streamUrl,
            thumbnail: c.logo || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&auto=format&fit=crop&q=80",
            description: c.name
          }
        ]
      }));
    }

    return [];
  }, [channels, isCategoryLocked, currentUser?.hasAdultAccess]);
  const [selectedGenre, setSelectedGenre] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Episode / Player Modal state
  const [selectedSeries, setSelectedSeries] = useState<SeriesItem | null>(null);
  const [activeSeason, setActiveSeason] = useState<number>(1);
  const [activeEpisode, setActiveEpisode] = useState<Episode | null>(null);

  const genres = useMemo(() => {
    const set = new Set<string>(["All"]);
    seriesList.forEach((s) => {
      if (s.genre) set.add(s.genre);
    });
    return Array.from(set);
  }, [seriesList]);

  const filteredSeries = useMemo(() => {
    return seriesList.filter((s) => {
      const matchesGenre =
        selectedGenre === "All" ||
        (s?.genre || "").toLowerCase() === (selectedGenre || "").toLowerCase();
      const q = (searchQuery || "").toLowerCase().trim();
      const matchesSearch =
        !q ||
        (s?.title || "").toLowerCase().includes(q) ||
        (s?.banglaTitle && typeof s.banglaTitle === "string" && s.banglaTitle.toLowerCase().includes(q)) ||
        (s?.genre || "").toLowerCase().includes(q);

      return matchesGenre && matchesSearch;
    });
  }, [seriesList, selectedGenre, searchQuery]);

  const featuredSeries = seriesList[0] || null;

  const handleOpenSeriesModal = (series: SeriesItem) => {
    setSelectedSeries(series);
    setActiveSeason(1);
    // Default to first episode of season 1
    const ep1 = series.episodes.find((e) => e.seasonNumber === 1) || series.episodes[0] || null;
    setActiveEpisode(null); // Don't auto play until user selects or clicks watch
  };

  const handlePlayEpisode = (series: SeriesItem, ep: Episode) => {
    // Re-verify adult lock on play attempt if needed (though they should be filtered)
    const channel = channels.find(c => c.id === series.id);
    if (channel && isCategoryLocked && isCategoryLocked(channel.category) && !currentUser?.hasAdultAccess) {
      onUnlockAdult?.(channel.category);
      return;
    }

    if (series.isPremium && !isSubscriptionActive) {
      onOpenSubscription();
      return;
    }
    setSelectedSeries(series);
    setActiveEpisode(ep);
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-white flex flex-col overflow-y-auto selection:bg-amber-500 selection:text-slate-950">
      {/* 🚀 VOD TOP NAVIGATION HEADER */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-8 py-3 flex items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onBackToLiveTv}
            className="px-2 sm:px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md group shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 group-hover:-translate-x-0.5 transition-transform" />
            <span className="hidden xs:inline">Live TV</span>
          </button>

          <div className="h-6 w-px bg-slate-800 hidden md:block" />

          <div className="flex items-center gap-2 min-w-0">
            <div className={`p-1.5 sm:p-2 rounded-xl bg-gradient-to-r ${theme.accentGradient} text-slate-950 shadow-lg shrink-0`}>
              <Clapperboard className="w-4 h-4 sm:w-5 sm:h-5 font-black" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-base font-black text-white uppercase tracking-wider flex items-center gap-1.5 truncate">
                Series <span className="hidden xs:inline">& VOD Portal</span>
                <span className="bg-amber-400/20 text-amber-300 text-[8px] sm:text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-amber-400/30 shrink-0">
                  HD
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 font-medium hidden lg:block">
                Exclusive Bengali Web Series, Drama Serials & VOD Episodes
              </p>
            </div>
          </div>
        </div>

        {/* Right Search & User Bar */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="relative w-32 xs:w-40 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {currentUser ? (
            currentUser.subscriptionPlan !== "Free" && currentUser.isApprovedByAdmin === false ? (
              <button
                onClick={onOpenSubscription}
                className="px-3.5 py-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 font-black text-[10px] sm:text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center gap-1.5 hover:bg-amber-500/30 transition-colors"
                title="Your payment is pending admin approval"
              >
                <Clock className="w-3.5 h-3.5 animate-pulse" />
                <span>PENDING</span>
              </button>
            ) : !isSubscriptionActive ? (
              <button
                onClick={onOpenSubscription}
                className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-[10px] sm:text-xs uppercase tracking-wider rounded-xl shadow-lg hover:brightness-110 transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
                <span>Unlock Package</span>
              </button>
            ) : (
              <div className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] sm:text-xs font-black rounded-xl flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Premium Active
              </div>
            )
          ) : (
            <button
              onClick={onOpenLogin}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-[10px] sm:text-xs uppercase tracking-wider rounded-xl shadow-lg hover:brightness-110 transition-all flex items-center gap-1.5"
            >
              <span>Login</span>
            </button>
          )}
        </div>
      </header>

      {/* 🌟 HERO FEATURED BANNER */}
      {featuredSeries && !searchQuery && selectedGenre === "All" && (
        <section className="relative w-full min-h-[320px] sm:min-h-[420px] overflow-hidden border-b border-slate-800/80 flex items-center">
          <div className="absolute inset-0 z-0">
            <img
              src={featuredSeries.banner}
              alt={featuredSeries.title}
              className="w-full h-full object-cover filter brightness-[0.35] contrast-125 scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 py-8 w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="max-w-2xl space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-widest shadow">
                  FEATURED SERIES
                </span>
                <span className="text-amber-400 text-xs font-bold flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  <Star className="w-3 h-3 fill-amber-400" /> {featuredSeries.rating} / 10
                </span>
                <span className="text-slate-400 text-xs font-bold">
                  {featuredSeries.year}
                </span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight">
                {featuredSeries.title}
                {featuredSeries.banglaTitle && (
                  <span className="text-amber-400 text-xl sm:text-2xl ml-2 font-bold font-sans">
                    ({featuredSeries.banglaTitle})
                  </span>
                )}
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed line-clamp-3 max-w-xl">
                {featuredSeries.description}
              </p>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    const ep1 = featuredSeries.episodes[0];
                    if (ep1) handlePlayEpisode(featuredSeries, ep1);
                  }}
                  className={`px-6 py-2.5 rounded-xl bg-gradient-to-r ${theme.accentGradient} text-slate-950 font-black text-xs uppercase tracking-wider shadow-xl hover:scale-105 transition-all flex items-center gap-2`}
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>Watch Season 1 Episode 1</span>
                </button>

                <button
                  onClick={() => handleOpenSeriesModal(featuredSeries)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5"
                >
                  <Info className="w-4 h-4 text-amber-400" />
                  <span>All Episodes ({featuredSeries.episodes.length})</span>
                </button>
              </div>
            </div>

            {/* Poster art */}
            <div className="hidden lg:block w-48 h-72 rounded-2xl overflow-hidden border-2 border-amber-500/30 shadow-2xl shrink-0 group">
              <img
                src={featuredSeries.poster}
                alt={featuredSeries.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          </div>
        </section>
      )}

      {/* 🏷️ GENRE TABS & FILTER BAR */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-900">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none w-full sm:w-auto pb-1 sm:pb-0">
          {genres.map((g) => {
            const isSelected = selectedGenre === g;
            return (
              <button
                key={`genre-${g}`}
                onClick={() => setSelectedGenre(g)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold tracking-wider shrink-0 transition-all ${
                  isSelected
                    ? `bg-gradient-to-r ${theme.accentGradient} text-slate-950 font-black shadow-md`
                    : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>

        <div className="text-xs font-bold text-slate-500 shrink-0">
          Showing <strong className="text-amber-400">{filteredSeries.length}</strong> Series & VODs
        </div>
      </div>

      {/* 📺 SERIES GRID CONTAINER */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 flex-1">
        {filteredSeries.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {filteredSeries.map((s, idx) => (
              <div
                key={`${s.id}_${idx}`}
                onClick={() => handleOpenSeriesModal(s)}
                className="group relative bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden hover:border-amber-400/60 hover:shadow-2xl transition-all duration-300 cursor-pointer flex flex-col"
              >
                {/* Poster image */}
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-950">
                  <img
                    src={s.poster}
                    alt={s.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />

                  {/* Rating Badge */}
                  <div className="absolute top-2 left-2 bg-slate-950/90 border border-slate-800 px-2 py-0.5 rounded-lg text-[10px] font-black text-amber-400 flex items-center gap-1 shadow">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{s.rating}</span>
                  </div>

                  {/* Lock / Free Badge */}
                  <div className="absolute top-2 right-2">
                    {s.isPremium ? (
                      !isSubscriptionActive ? (
                        <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-lg shadow flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> VIP
                        </span>
                      ) : (
                        <span className="bg-emerald-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-lg shadow">
                          VIP
                        </span>
                      )
                    ) : (
                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-black px-2 py-0.5 rounded-lg shadow backdrop-blur-md">
                        FREE
                      </span>
                    )}
                  </div>

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-slate-950/40 backdrop-blur-[2px]">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-r ${theme.accentGradient} text-slate-950 flex items-center justify-center shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-300`}>
                      <Play className="w-6 h-6 fill-slate-950 ml-0.5" />
                    </div>
                  </div>

                  {/* Season / Episode Badge */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] font-bold text-slate-300">
                    <span className="bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800 truncate">
                      {s.genre}
                    </span>
                    <span className="bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800 font-mono text-amber-300">
                      {s.episodes.length} Eps
                    </span>
                  </div>
                </div>

                {/* Info Content */}
                <div className="p-3 flex flex-col flex-1 justify-between bg-slate-900/40">
                  <div>
                    <h3 className="text-xs font-black text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                      {s.title}
                    </h3>
                    {s.banglaTitle && (
                      <p className="text-[10px] font-bold text-amber-400/80 line-clamp-1 mt-0.5">
                        {s.banglaTitle}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 font-medium">
                    <span>{s.year}</span>
                    <span className="text-amber-400 font-bold flex items-center gap-0.5">
                      Explore Episodes <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-slate-800 rounded-3xl bg-slate-900/30 p-6">
            <Clapperboard className="w-12 h-12 text-amber-400 mb-3" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              No Series / VOD Available
            </h3>
            <p className="text-xs text-slate-300 max-w-md mt-1 leading-relaxed">
              No series or VOD items found in the playlist. Add or import an M3U playlist containing VOD/series links in the Admin Panel.
            </p>
          </div>
        )}
      </main>

      {/* 🎥 EPISODE SELECTION & PLAYBACK MODAL */}
      {selectedSeries && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-50 overflow-y-auto p-4 sm:p-6 flex flex-col animate-in fade-in duration-200">
          <div className="max-w-5xl w-full mx-auto flex-1 flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setSelectedSeries(null);
                    setActiveEpisode(null);
                  }}
                  className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl"
                >
                  <ArrowLeft className="w-5 h-5 text-amber-400" />
                </button>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                    {selectedSeries.title}
                    {selectedSeries.banglaTitle && (
                      <span className="text-amber-400 text-sm font-normal">
                        ({selectedSeries.banglaTitle})
                      </span>
                    )}
                  </h2>
                  <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    {selectedSeries.genre} • Rating: ⭐ {selectedSeries.rating} • {selectedSeries.year}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedSeries(null);
                  setActiveEpisode(null);
                }}
                className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* If an episode is actively playing */}
            {activeEpisode ? (
              <div className="flex-1 flex flex-col space-y-4 min-h-0">
                <div className="relative aspect-video w-full bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
                    <VideoPlayer
                    channel={{
                      id: activeEpisode.id,
                      channelNumber: 0,
                      name: `${selectedSeries.title} - ${activeEpisode.title}`,
                      logo: activeEpisode.thumbnail || selectedSeries.poster,
                      category: selectedSeries.genre as any,
                      streamUrl: activeEpisode.streamUrl,
                      isPremium: selectedSeries.isPremium,
                      isActive: true,
                    }}
                    currentUser={currentUser}
                    onPrevChannel={() => {}}
                    onNextChannel={() => {}}
                    onOpenLogin={onOpenLogin}
                    onOpenSubscription={onOpenSubscription}
                    currentTheme={theme.id}
                    isVod={true}
                  />
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
                  <div>
                    <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase rounded">
                      NOW PLAYING
                    </span>
                    <h3 className="text-base font-black text-white mt-1">
                      {activeEpisode.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {activeEpisode.description || selectedSeries.description}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveEpisode(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-xl shrink-0"
                  >
                    Select Another Episode
                  </button>
                </div>
              </div>
            ) : (
              /* Episode Browser List */
              <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0 overflow-y-auto">
                {/* Series Banner / Synopsis */}
                <div className="w-full md:w-80 shrink-0 space-y-4">
                  <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden border border-slate-800 shadow-xl relative">
                    <img
                      src={selectedSeries.poster}
                      alt={selectedSeries.title}
                      className="w-full h-full object-cover"
                    />
                    {selectedSeries.isPremium && !isSubscriptionActive && (
                      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm p-4 flex flex-col items-center justify-center text-center">
                        <Lock className="w-8 h-8 text-amber-400 mb-2" />
                        <h4 className="text-xs font-black text-amber-300 uppercase">
                          VIP Package Required
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-1 mb-3">
                          Subscribe to unlock premium web series episodes
                        </p>
                        <button
                          onClick={onOpenSubscription}
                          className="px-4 py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 text-xs font-black rounded-xl shadow"
                        >
                          Buy Package
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl space-y-2">
                    <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider">
                      Synopsis
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {selectedSeries.description}
                    </p>
                  </div>
                </div>

                {/* Episodes List Column */}
                <div className="flex-1 flex flex-col space-y-4 min-h-0">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    {Array.from({ length: selectedSeries.totalSeasons }, (_, i) => i + 1).map((sNum) => (
                      <button
                        key={`season-${sNum}`}
                        onClick={() => setActiveSeason(sNum)}
                        className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                          activeSeason === sNum
                            ? `bg-gradient-to-r ${theme.accentGradient} text-slate-950 shadow-md`
                            : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                        }`}
                      >
                        Season {sNum}
                      </button>
                    ))}
                  </div>

                  {/* Episodes List */}
                  <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                    {selectedSeries.episodes
                      .filter((e) => e.seasonNumber === activeSeason)
                      .map((ep) => (
                        <div
                          key={ep.id}
                          onClick={() => handlePlayEpisode(selectedSeries, ep)}
                          className="p-3 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-400/50 rounded-2xl flex items-center justify-between gap-3 cursor-pointer group transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 text-amber-400 font-black group-hover:scale-105 transition-transform">
                              <Play className="w-5 h-5 fill-amber-400 ml-0.5" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-black text-white group-hover:text-amber-400 transition-colors truncate">
                                Ep {ep.episodeNumber}: {ep.title}
                              </h4>
                              {ep.description && (
                                <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                  {ep.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                              {ep.duration}
                            </span>
                            <button className="px-3 py-1 bg-amber-500/20 group-hover:bg-amber-500 text-amber-300 group-hover:text-slate-950 text-[10px] font-black rounded-lg transition-colors">
                              Play
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
