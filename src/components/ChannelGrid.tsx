import React, { useState } from "react";
import {
  Heart,
  Play,
  Lock,
  Tv,
  LayoutGrid,
  List,
  Sparkles,
  Filter,
} from "lucide-react";
import { Channel, ThemeId } from "../types";
import { THEMES } from "./ThemeSelector";
import { calculateEpgProgress } from "../utils/epgUtils";

interface ChannelGridProps {
  channels: Channel[];
  allChannels?: Channel[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  categories: string[];
  activeChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  favorites: string[];
  onToggleFavorite: (channelId: string) => void;
  focusedChannelIndex: number;
  isGridFocused: boolean;
  onOpenAdmin?: () => void;
  currentTheme?: ThemeId;
}

export const ChannelGrid: React.FC<ChannelGridProps> = ({
  channels,
  allChannels,
  selectedCategory,
  onSelectCategory,
  categories,
  activeChannel,
  onSelectChannel,
  favorites,
  onToggleFavorite,
  focusedChannelIndex,
  isGridFocused,
  onOpenAdmin,
  currentTheme = "gold",
}) => {
  const [layoutMode, setLayoutMode] = useState<"grid" | "toffeeList">(
    "toffeeList",
  );
  const [visibleLimit, setVisibleLimit] = useState<number>(60);
  const theme = THEMES[currentTheme] || THEMES.gold;

  React.useEffect(() => {
    setVisibleLimit(60);
  }, [selectedCategory, channels.length]);

  const visibleChannels = React.useMemo(() => {
    return channels.slice(0, visibleLimit);
  }, [channels, visibleLimit]);

  // Calculate channel counts per category
  const channelPool =
    allChannels && allChannels.length > 0 ? allChannels : channels;
  const getCategoryCount = (cat: string) => {
    if (cat === "All") return channelPool.length;
    return channelPool.filter((c) => c.category === cat).length;
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* IPTV Blink Player Web TV Header Bar */}
      <div className="flex items-center justify-between gap-2 bg-slate-900/80 border border-slate-800/80 p-2.5 rounded-2xl backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded-xl bg-gradient-to-r ${theme.accentGradient} text-slate-950 font-black shadow-md`}
          >
            <Tv className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
              Live TV Categories{" "}
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            </span>
            <h3 className="text-xs font-black text-white flex items-center gap-1.5">
              <span>{selectedCategory}</span>
              <span
                className={`text-[10px] font-bold ${theme.accentText} bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800`}
              >
                {channels.length}{" "}
                {channels.length === 1 ? "Channel" : "Channels"}
              </span>
            </h3>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0 gap-1">
          <button
            onClick={() => setLayoutMode("toffeeList")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              layoutMode === "toffeeList"
                ? `bg-gradient-to-r ${theme.accentGradient} text-slate-950 font-black shadow-md`
                : "text-slate-400 hover:text-white"
            }`}
            title="List / Row View"
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">List</span>
          </button>

          <button
            onClick={() => setLayoutMode("grid")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              layoutMode === "grid"
                ? `bg-gradient-to-r ${theme.accentGradient} text-slate-950 font-black shadow-md`
                : "text-slate-400 hover:text-white"
            }`}
            title="Grid / Tiles View"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Grid</span>
          </button>
        </div>
      </div>

      {/* Category Pills Bar with Channel Counts */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none select-none shrink-0 pb-0.5">
        {(() => {
          // Robustly handle unique categories, preventing duplicates like 'All' and 'all'
          const uniqueCats = ["All"];
          const lowerCats = new Set(["all"]);

          categories.forEach((c) => {
            const trimmed = c.trim();
            if (trimmed && !lowerCats.has(trimmed.toLowerCase())) {
              uniqueCats.push(trimmed);
              lowerCats.add(trimmed.toLowerCase());
            }
          });

          return uniqueCats;
        })().map((cat) => {
          const isSelected = selectedCategory === cat;
          const count = getCategoryCount(cat);

          return (
            <button
              key={`cat-${cat}`}
              onClick={() => onSelectCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all duration-200 border flex items-center gap-1.5 ${
                isSelected
                  ? `bg-gradient-to-r ${theme.accentGradient} text-slate-950 font-black border-amber-400/50 shadow-lg ${theme.accentGlow} scale-[1.02]`
                  : "bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 border-slate-800"
              }`}
            >
              <span>{cat}</span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                  isSelected
                    ? "bg-slate-950/20 text-slate-950"
                    : "bg-slate-950 text-slate-400 border border-slate-800"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* TOFFEE LIST VIEW MODE */}
      {layoutMode === "toffeeList" ? (
        <div className="flex flex-col gap-2 overflow-y-auto pr-1 flex-1 scrollbar-thin">
          {visibleChannels.map((channel, idx) => {
            const isActive = activeChannel?.id === channel.id;
            const isFav = favorites.includes(channel.id);
            const isFocused = isGridFocused && focusedChannelIndex === idx;

            return (
              <div
                key={channel.id}
                onClick={() => onSelectChannel(channel)}
                className={`group relative bg-slate-900/70 border rounded-2xl p-2.5 flex items-center justify-between gap-3 cursor-pointer transition-all duration-200 select-none ${
                  isActive
                    ? `border-amber-400 bg-slate-900 ring-2 ring-amber-400/50 shadow-xl ${theme.accentGlow}`
                    : "border-slate-800/80 hover:border-slate-700 hover:bg-slate-900"
                } ${
                  isFocused
                    ? `border-2 border-amber-400 ring-2 ring-amber-500/50 scale-[1.01] bg-slate-800 z-10`
                    : ""
                }`}
              >
                {/* Left: Logo & Channel Details */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center p-2 group-hover:border-slate-700 shadow-lg transition-all">
                    <img
                      src={channel.logo}
                      alt={channel.name}
                      className="w-full h-full object-contain filter drop-shadow group-hover:scale-105 transition-transform"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    {isActive && (
                      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center">
                        <div
                          className={`w-8 h-8 rounded-full bg-gradient-to-br ${theme.accentGradient} flex items-center justify-center text-slate-950 shadow-md`}
                        >
                          <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 bg-slate-950 ${theme.accentText} font-mono font-black text-xs rounded-md border border-slate-800 shrink-0`}
                      >
                        Ch. {channel.channelNumber}
                      </span>
                      <h4 className="text-white font-extrabold text-sm sm:text-base truncate group-hover:text-amber-400 transition-colors">
                        {channel.name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-slate-400 text-xs font-semibold truncate">
                        {channel.category}
                      </span>
                      {isActive && (
                        <span
                          className={`text-[10px] font-black text-slate-950 uppercase tracking-wider flex items-center gap-1 bg-gradient-to-r ${theme.accentGradient} px-2 py-0.5 rounded-md shadow-sm`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />{" "}
                          PLAYING LIVE
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Badges & Favorite */}
                <div className="flex items-center gap-2 shrink-0">
                  {channel.isPremium ? (
                    <span className="bg-amber-500/20 text-amber-300 text-[9px] font-black px-2 py-0.5 rounded-md border border-amber-500/30 flex items-center gap-1 uppercase">
                      <Lock className="w-2.5 h-2.5" /> VIP
                    </span>
                  ) : (
                    <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/30 uppercase">
                      FREE
                    </span>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(channel.id);
                    }}
                    className={`p-2 rounded-xl transition-colors ${
                      isFav
                        ? "text-rose-500 bg-rose-500/10 border border-rose-500/20"
                        : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                    }`}
                    title={isFav ? "Remove Favorite" : "Add Favorite"}
                  >
                    <Heart
                      className={`w-4 h-4 ${isFav ? "fill-rose-500" : ""}`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
          {channels.length > visibleLimit && (
            <div className="py-3 text-center shrink-0">
              <button
                onClick={() => setVisibleLimit((prev) => prev + 60)}
                className={`px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 font-extrabold text-xs rounded-xl border border-slate-700 shadow-lg transition-all active:scale-95`}
              >
                Load More Channels ({channels.length - visibleLimit} remaining)
              </button>
            </div>
          )}
        </div>
      ) : (
        /* GRID VIEW MODE */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 overflow-y-auto pr-1 flex-1">
          {visibleChannels.map((channel, idx) => {
            const isActive = activeChannel?.id === channel.id;
            const isFav = favorites.includes(channel.id);
            const isFocused = isGridFocused && focusedChannelIndex === idx;

            return (
              <div
                key={channel.id}
                onClick={() => onSelectChannel(channel)}
                className={`group relative bg-slate-900/80 border rounded-2xl p-2.5 flex flex-col justify-between cursor-pointer transition-all duration-200 hover:scale-[1.02] select-none ${
                  isActive
                    ? `border-amber-400 bg-slate-900 ring-2 ring-amber-400/50 shadow-xl ${theme.accentGlow}`
                    : "border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                } ${
                  isFocused
                    ? `border-2 border-amber-400 ring-4 ring-amber-500/30 scale-[1.04] bg-slate-800 z-20 shadow-2xl`
                    : ""
                }`}
              >
                {/* Top Row */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`px-2 py-0.5 bg-slate-950 ${theme.accentText} font-mono font-black text-[10px] rounded-md border border-slate-800`}
                  >
                    Ch. {channel.channelNumber}
                  </span>

                  <div className="flex items-center gap-1">
                    {channel.isPremium ? (
                      <span className="bg-amber-500/20 text-amber-300 text-[8px] font-black px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-0.5 uppercase">
                        <Lock className="w-2 h-2" /> VIP
                      </span>
                    ) : (
                      <span className="bg-emerald-500/20 text-emerald-400 text-[8px] font-black px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase">
                        FREE
                      </span>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(channel.id);
                      }}
                      className={`p-1 rounded-lg transition-colors ${
                        isFav
                          ? "text-rose-500 bg-rose-500/10"
                          : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${isFav ? "fill-rose-500" : ""}`}
                      />
                    </button>
                  </div>
                </div>

                {/* Logo Frame */}
                <div className="relative aspect-video w-full rounded-xl bg-slate-950 overflow-hidden mb-2 border border-slate-800 p-2 flex items-center justify-center group-hover:border-slate-700 transition-colors">
                  <img
                    src={channel.logo}
                    alt={channel.name}
                    className="w-full h-full object-contain filter drop-shadow group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />

                  {/* Hover Play Button Overlay */}
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div
                      className={`w-9 h-9 rounded-full bg-gradient-to-br ${theme.accentGradient} text-slate-950 flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform`}
                    >
                      <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
                    </div>
                  </div>

                  {isActive && (
                    <div
                      className={`absolute bottom-1.5 right-1.5 bg-gradient-to-r ${theme.accentGradient} text-slate-950 font-black text-[8px] px-2 py-0.5 rounded-md flex items-center gap-1 shadow-md`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />{" "}
                      LIVE
                    </div>
                  )}
                </div>

                {/* Title & Category */}
                <div>
                  <h4 className="text-white font-bold text-xs truncate group-hover:text-amber-400 transition-colors">
                    {channel.name}
                  </h4>
                  <p className="text-slate-400 text-[10px] font-medium truncate mt-0.5">
                    {channel.category}
                  </p>
                  <div className="h-1 bg-slate-950 w-full rounded-full mt-1.5 overflow-hidden border border-slate-800 relative">
                    <div
                      className={`h-full bg-gradient-to-r ${theme.accentGradient} transition-all duration-500`}
                      style={{
                        width: `${
                          isActive
                            ? calculateEpgProgress()
                            : Math.min(
                                95,
                                Math.max(
                                  10,
                                  ((channel.channelNumber * 13 +
                                    new Date().getMinutes()) %
                                    80) +
                                    10,
                                ),
                              )
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          {channels.length > visibleLimit && (
            <div className="col-span-full py-3 text-center">
              <button
                onClick={() => setVisibleLimit((prev) => prev + 60)}
                className={`px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 font-extrabold text-xs rounded-xl border border-slate-700 shadow-lg transition-all active:scale-95`}
              >
                Load More Channels ({channels.length - visibleLimit} remaining)
              </button>
            </div>
          )}
        </div>
      )}

      {channels.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-900/60 border border-slate-800 rounded-3xl my-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
            <Tv className="w-8 h-8 text-amber-400" />
          </div>
          <h3 className="text-lg font-black text-white mb-1">
            No M3U Playlist Loaded
          </h3>
          <p className="text-xs text-slate-300 max-w-md mb-4 leading-relaxed">
            No live TV channels are available yet. Please add or import your M3U Playlist Link URL or M3U File in the Admin Panel to load your channels instantly.
          </p>
          {onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className={`px-6 py-3 bg-gradient-to-r ${theme.accentGradient} text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-lg transition-transform active:scale-95 flex items-center gap-2`}
            >
              Open Admin Panel & Add M3U Link
            </button>
          )}
        </div>
      )}
    </div>
  );
};
