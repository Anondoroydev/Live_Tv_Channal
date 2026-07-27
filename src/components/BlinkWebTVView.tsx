import React, { useState } from 'react';
import {
  Tv,
  Heart,
  Calendar,
  Clock,
  Radio,
  Search,
  Lock,
  Zap,
  ListFilter,
  Shield,
  Film,
  Clapperboard,
  Activity,
  Palette,
  Menu,
  X,
  LogOut,
  Check
} from 'lucide-react';
import { Channel, EPGProgram, User, ThemeId, ViewMode } from '../types';
import { THEMES } from './ThemeSelector';
import { VideoPlayer } from './VideoPlayer';
import { calculateEpgProgress } from '../utils/epgUtils';

interface BlinkWebTVViewProps {
  channels: Channel[];
  allChannels: Channel[];
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  activeChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  currentEpg: EPGProgram | null;
  nextEpg: EPGProgram | null;
  favorites: string[];
  onToggleFavorite: (channelId: string) => void;
  currentUser: User | null;
  onOpenLogin: () => void;
  onOpenSubscription: () => void;
  onOpenAdmin: () => void;
  onPrevChannel: () => void;
  onNextChannel: () => void;
  currentTheme: ThemeId;
  onOpenThemeSelector: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  timeStr: string;
  recentlyWatched?: string[];
  onLogout?: () => void;
}

export const BlinkWebTVView: React.FC<BlinkWebTVViewProps> = ({
  channels,
  allChannels,
  categories,
  selectedCategory,
  onSelectCategory,
  activeChannel,
  onSelectChannel,
  currentEpg,
  nextEpg,
  favorites,
  onToggleFavorite,
  currentUser,
  onOpenLogin,
  onOpenSubscription,
  onOpenAdmin,
  onPrevChannel,
  onNextChannel,
  currentTheme,
  onOpenThemeSelector,
  searchQuery,
  setSearchQuery,
  currentView,
  onSelectView,
  timeStr,
  recentlyWatched = [],
  onLogout
}) => {
  const theme = THEMES[currentTheme] || THEMES.gold;
  const [filterQuery, setFilterQuery] = useState('');

  const isSubscriptionActive = !!currentUser && (
    currentUser.role === 'admin' ||
    (currentUser.subscriptionPlan !== 'Free' &&
     currentUser.subscriptionPlan !== 'Expired' &&
     (!currentUser.subscriptionExpiresAt || new Date(currentUser.subscriptionExpiresAt).getTime() > Date.now()))
  );

  const displayChannels = channels.filter(c =>
    filterQuery
      ? c.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
        c.channelNumber.toString().includes(filterQuery)
      : true
  );

  const getCategoryCount = (cat: string) => {
    if (cat === 'All') return allChannels.length;
    if (cat === 'Watchlist') return allChannels.filter(c => favorites.includes(c.id)).length;
    if (cat === 'History') return recentlyWatched.length;
    return allChannels.filter(c => c.category === cat).length;
  };

  return (
    <div className={`flex flex-col h-screen w-screen bg-gradient-to-br ${theme.bgGradient} text-white font-sans overflow-hidden select-none`}>
      {/* 🌟 TOP WEB TV PORTAL GLASS HEADER */}
      <header className="h-14 sm:h-16 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl px-3 sm:px-4 flex items-center justify-between shrink-0 z-40 shadow-2xl">
        {/* Left: Brand Logo & Status */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br ${theme.accentGradient} flex items-center justify-center font-black text-slate-950 shadow-lg shrink-0 ${theme.accentGlow}`}>
              <Radio className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-base font-black tracking-tight text-white flex items-center gap-1 leading-none truncate">
                BLINK<span className={theme.accentText}>WEBTV</span>
                <span className="hidden xs:inline-block text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700 shrink-0">XC 3.0</span>
              </h1>
              <p className="text-[8px] sm:text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mt-0.5 flex items-center gap-1 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span className="truncate">STREAMING PORTAL</span>
              </p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1 text-[11px] font-bold text-slate-300 shrink-0">
            <span className="text-slate-500">SERVER:</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> ONLINE
            </span>
          </div>
        </div>

        {/* Right: Theme Selector, Time & User */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Admin Control Link - Visible for admin only */}
          {currentUser?.role === 'admin' && (
            <button
              onClick={onOpenAdmin}
              className="px-2.5 sm:px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] sm:text-xs uppercase tracking-wider shadow-lg rounded-xl flex items-center gap-1 hover:scale-105 transition-transform shrink-0"
            >
              <span>Admin Console</span>
            </button>
          )}

          {/* Theme customizer button */}
          <button
            onClick={onOpenThemeSelector}
            className={`p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border ${theme.accentBorder} text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm`}
            title="Customize Theme Colors"
          >
            <Palette className={`w-4 h-4 ${theme.accentText}`} />
            <span className="hidden md:inline font-extrabold uppercase text-[10px]">{currentTheme}</span>
          </button>

          {/* Clock */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-xl text-xs font-mono font-black text-slate-200 shadow-inner">
            <Clock className={`w-3.5 h-3.5 ${theme.accentText}`} />
            <span>{timeStr || '12:00 PM'}</span>
          </div>

          {/* User Profile or VIP Badge */}
          {currentUser ? (
            <button
              onClick={onOpenSubscription}
              className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-gradient-to-r ${theme.accentGradient} text-slate-950 font-black text-[10px] sm:text-xs uppercase tracking-wider shadow-lg flex items-center gap-1 hover:scale-105 transition-transform shrink-0`}
            >
              <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-slate-950" />
              <span>VIP</span>
            </button>
          ) : (
            <button
              onClick={onOpenLogin}
              className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-gradient-to-r ${theme.accentGradient} text-slate-950 font-black text-[10px] sm:text-xs uppercase tracking-wider shadow-lg hover:scale-105 transition-transform shrink-0`}
            >
              LOGIN
            </button>
          )}

          {/* Logout button */}
          {currentUser && (
            <button
              onClick={onLogout}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-rose-400 hover:text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              title="Logout Account"
            >
              <LogOut className="w-4 h-4 text-rose-500" />
              <span className="hidden md:inline font-extrabold uppercase text-[10px]">Logout</span>
            </button>
          )}
        </div>
      </header>

      {/* 📺 RESPONSIVE PORTAL MAIN CONTAINER */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2 sm:p-3 gap-2 sm:gap-3">
        
        {/* COLUMN 1: CATEGORIES RAIL (Desktop Sidebar / Mobile Horizontal Scroll Bar) */}
        <aside className="w-full lg:w-56 xl:w-60 bg-slate-950/90 border border-slate-800/80 rounded-xl sm:rounded-2xl p-2 sm:p-2.5 shrink-0 overflow-hidden shadow-xl backdrop-blur-md flex flex-col">
          <div className="flex items-center justify-between px-2 mb-1.5 sm:mb-2 pb-1.5 border-b border-slate-800/80 shrink-0">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <ListFilter className="w-3.5 h-3.5 text-amber-400" /> CATEGORIES
            </span>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded-md">
              {categories.length + 3}
            </span>
          </div>

          {/* Desktop Vertical List / Mobile Horizontal Scroll */}
          <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto gap-1.5 pr-1 scrollbar-thin">
            {['All', 'Watchlist', 'History', ...categories].map((cat) => {
              const isSelected = selectedCategory === cat;
              const count = getCategoryCount(cat);

              return (
                <button
                  key={cat}
                  onClick={() => onSelectCategory(cat)}
                  className={`px-3 py-1.5 sm:py-2.5 rounded-xl text-xs font-bold text-left transition-all duration-200 flex items-center justify-between gap-2 shrink-0 group ${
                    isSelected
                      ? `bg-gradient-to-r ${theme.accentGradient} text-slate-950 font-black shadow-lg scale-[1.02]`
                      : 'bg-slate-900/80 lg:bg-transparent text-slate-300 hover:text-white hover:bg-slate-900/90'
                  }`}
                >
                  <span className="truncate max-w-[120px] sm:max-w-none">
                    {cat === 'All' ? 'All Channels' : cat}
                  </span>
                  <span
                    className={`text-[9px] sm:text-[10px] font-mono font-black px-1.5 py-0.2 sm:py-0.5 rounded-md shrink-0 ${
                      isSelected
                        ? 'bg-slate-950/20 text-slate-950'
                        : 'bg-slate-950/60 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* COLUMN 2: CHANNEL LIST STREAM PANEL */}
        <section className="w-full lg:w-72 xl:w-80 bg-slate-950/90 border border-slate-800/80 rounded-xl sm:rounded-2xl flex flex-col p-2 sm:p-2.5 shrink-0 overflow-hidden shadow-xl backdrop-blur-md max-h-[260px] sm:max-h-[340px] lg:max-h-none">
          {/* Search Header */}
          <div className="relative mb-2 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={`Search ${displayChannels.length} channels...`}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Channel Scroll List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
            {displayChannels.map((ch) => {
              const isActive = activeChannel?.id === ch.id;
              const isFav = favorites.includes(ch.id);

              return (
                <div
                  key={ch.id}
                  onClick={() => onSelectChannel(ch)}
                  className={`p-2 rounded-xl sm:rounded-2xl border transition-all duration-200 flex items-center justify-between gap-2 cursor-pointer select-none group min-w-0 ${
                    isActive
                      ? `bg-slate-900 border-amber-400 ring-2 ring-amber-400/40 shadow-xl`
                      : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  {/* Left Logo + Info */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center p-1 shrink-0 shadow-inner">
                      <img
                        src={ch.logo}
                        alt={ch.name}
                        className="w-full h-full object-contain filter drop-shadow group-hover:scale-105 transition-transform"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`px-1 py-0.2 bg-slate-950 ${theme.accentText} font-mono font-black text-[9px] rounded border border-slate-800 shrink-0`}>
                          {ch.channelNumber}
                        </span>
                        <h4 className="text-white font-bold text-xs truncate leading-snug min-w-0 group-hover:text-amber-400 transition-colors">
                          {ch.name}
                        </h4>
                      </div>

                      <p className="text-slate-400 text-[9px] sm:text-[10px] truncate mt-0.5">
                        {ch.category}
                      </p>

                      {/* Mini Dynamic EPG Progress Line */}
                      {(() => {
                        const chProgress = isActive && currentEpg
                          ? calculateEpgProgress(currentEpg)
                          : Math.min(95, Math.max(10, ((ch.channelNumber * 11 + new Date().getMinutes()) % 80) + 10));
                        return (
                          <div className="w-full bg-slate-950 h-1 rounded-full mt-1 overflow-hidden border border-slate-800 relative">
                            <div
                              className={`h-full bg-gradient-to-r ${theme.accentGradient} transition-all duration-500`}
                              style={{ width: `${chProgress}%` }}
                            />
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex flex-col items-end gap-1 shrink-0 ml-1">
                    {ch.isPremium ? (
                      isSubscriptionActive ? (
                        <span className="bg-emerald-500/20 text-emerald-400 text-[8px] font-black px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-0.5 shrink-0">
                          <Check className="w-2.5 h-2.5" /> UNLOCKED
                        </span>
                      ) : (
                        <span className="bg-amber-500/20 text-amber-300 text-[8px] font-black px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-0.5 shrink-0">
                          <Lock className="w-2 h-2" /> VIP
                        </span>
                      )
                    ) : (
                      <span className="bg-emerald-500/20 text-emerald-400 text-[8px] font-black px-1.5 py-0.5 rounded border border-emerald-500/30 shrink-0">
                        FREE
                      </span>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(ch.id);
                      }}
                      className={`p-1 rounded-lg transition-colors ${
                        isFav ? 'text-rose-500 bg-rose-500/10' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500' : ''}`} />
                    </button>
                  </div>
                </div>
              );
            })}

            {displayChannels.length === 0 && (
              <div className="p-4 text-center text-slate-500 text-xs">
                No channels match your search.
              </div>
            )}
          </div>
        </section>

        {/* COLUMN 3: MAIN CINEMA PLAYER STAGE & EPG DASHBOARD */}
        <main className="flex-1 bg-slate-950/90 border border-slate-800/80 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex flex-col gap-3 overflow-y-auto shadow-2xl backdrop-blur-md min-w-0">
          {/* Video Player Container */}
          <div className="w-full h-52 sm:h-80 lg:h-[400px] xl:h-[440px] rounded-xl sm:rounded-2xl overflow-hidden border border-slate-800 bg-black relative shadow-2xl shrink-0">
            <VideoPlayer
              channel={activeChannel}
              currentEpg={currentEpg}
              nextEpg={nextEpg}
              currentUser={currentUser}
              onPrevChannel={onPrevChannel}
              onNextChannel={onNextChannel}
              onOpenLogin={onOpenLogin}
              onOpenSubscription={onOpenSubscription}
              currentTheme={currentTheme}
              allChannels={allChannels}
              onSelectChannel={onSelectChannel}
            />
          </div>

          {/* Active Stream Details & EPG Timeline Bar */}
          {activeChannel && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl min-w-0">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-slate-950 border border-slate-800 p-1.5 flex items-center justify-center shrink-0 shadow-lg">
                  <img src={activeChannel.logo} alt={activeChannel.name} className="w-full h-full object-contain filter drop-shadow" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className={`px-1.5 py-0.2 bg-slate-950 ${theme.accentText} font-mono font-black text-[10px] sm:text-xs rounded border border-slate-800 shrink-0`}>
                      Ch. {activeChannel.channelNumber}
                    </span>
                    <h3 className="text-sm sm:text-lg font-black text-white truncate min-w-0">{activeChannel.name}</h3>
                    <span className={`text-[8px] sm:text-[10px] font-black text-slate-950 uppercase px-1.5 py-0.2 rounded bg-gradient-to-r ${theme.accentGradient} shrink-0`}>
                      LIVE HD
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-400 mt-1 flex items-center gap-2 truncate">
                    <span className="truncate">Category: <strong className="text-slate-200">{activeChannel.category}</strong></span>
                    <span>•</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1 shrink-0">
                      <Activity className="w-3 h-3" /> 1080p @ 60 FPS
                    </span>
                  </p>
                </div>
              </div>

              {/* Current EPG Program Info */}
              {(() => {
                const progPct = calculateEpgProgress(currentEpg);
                return (
                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-2.5 sm:p-3 w-full sm:w-72 shrink-0">
                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] mb-1 font-bold">
                      <span className={theme.accentText}>NOW PLAYING</span>
                      <div className="flex items-center gap-1.5 font-mono text-slate-400">
                        <span>{currentEpg ? `${currentEpg.startTime} - ${currentEpg.endTime}` : 'LIVE TRANSMISSION'}</span>
                        <span className="text-amber-400 font-black bg-amber-400/20 px-1.5 py-0.2 rounded border border-amber-400/30 text-[9px]">
                          {progPct}%
                        </span>
                      </div>
                    </div>
                    <h5 className="text-xs font-black text-white truncate">
                      {currentEpg ? currentEpg.title : `${activeChannel.name} Live Broadcast`}
                    </h5>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full mt-1.5 overflow-hidden border border-slate-800 relative">
                      <div
                        className={`h-full bg-gradient-to-r ${theme.accentGradient} transition-all duration-500`}
                        style={{ width: `${progPct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
