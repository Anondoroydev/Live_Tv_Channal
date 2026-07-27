import React from 'react';
import { Palette, Check, Sparkles } from 'lucide-react';
import { ThemeId, ThemeConfig } from '../types';

export const THEMES: Record<ThemeId, ThemeConfig> = {
  gold: {
    id: 'gold',
    name: 'VIP Gold Luxury',
    subtitle: 'Golden Amber & Obsidian Black',
    badge: 'DEFAULT VIP',
    bgGradient: 'from-slate-950 via-zinc-950 to-black',
    accentBg: 'bg-amber-500',
    accentGradient: 'from-amber-500 via-orange-500 to-amber-600',
    accentText: 'text-amber-400',
    accentBorder: 'border-amber-500/40',
    accentGlow: 'shadow-amber-500/20',
    secondaryText: 'text-amber-200/80',
    previewColor: '#f59e0b'
  },
  red: {
    id: 'red',
    name: 'Toffee Red Sports',
    subtitle: 'Sports Crimson & Deep Black',
    badge: 'HOT SPORTS',
    bgGradient: 'from-neutral-950 via-red-950/30 to-black',
    accentBg: 'bg-red-600',
    accentGradient: 'from-red-600 via-rose-600 to-orange-500',
    accentText: 'text-red-500',
    accentBorder: 'border-red-500/40',
    accentGlow: 'shadow-red-600/25',
    secondaryText: 'text-rose-200/80',
    previewColor: '#dc2626'
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    subtitle: 'Glowing Cyan & Fuchsia',
    badge: 'ULTRA NEON',
    bgGradient: 'from-slate-950 via-indigo-950/40 to-black',
    accentBg: 'bg-cyan-500',
    accentGradient: 'from-cyan-400 via-teal-400 to-fuchsia-500',
    accentText: 'text-cyan-400',
    accentBorder: 'border-cyan-500/40',
    accentGlow: 'shadow-cyan-500/25',
    secondaryText: 'text-cyan-200/80',
    previewColor: '#06b6d4'
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Night',
    subtitle: 'Mint Green & Deep Teal',
    badge: 'CLEAN MINT',
    bgGradient: 'from-zinc-950 via-emerald-950/30 to-black',
    accentBg: 'bg-emerald-500',
    accentGradient: 'from-emerald-400 via-teal-500 to-cyan-500',
    accentText: 'text-emerald-400',
    accentBorder: 'border-emerald-500/40',
    accentGlow: 'shadow-emerald-500/25',
    secondaryText: 'text-emerald-200/80',
    previewColor: '#10b981'
  },
  purple: {
    id: 'purple',
    name: 'Royal Velvet',
    subtitle: 'Ottoman Purple & Gold',
    badge: 'PREMIUM OTT',
    bgGradient: 'from-slate-950 via-purple-950/40 to-black',
    accentBg: 'bg-purple-600',
    accentGradient: 'from-purple-500 via-violet-600 to-pink-500',
    accentText: 'text-purple-400',
    accentBorder: 'border-purple-500/40',
    accentGlow: 'shadow-purple-500/25',
    secondaryText: 'text-purple-200/80',
    previewColor: '#9333ea'
  }
};

interface ThemeSelectorProps {
  currentTheme: ThemeId;
  onSelectTheme: (theme: ThemeId) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorProps> = ({
  currentTheme,
  onSelectTheme,
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 relative shadow-2xl overflow-hidden">
        {/* Glow Header */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-red-500 to-cyan-500" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 rounded-2xl">
              <Palette className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                Select Visual Theme <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              </h3>
              <p className="text-xs text-slate-400">Personalize your IPTV interface appearance & colors</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors text-xs font-bold"
          >
            ✕
          </button>
        </div>

        {/* Theme Cards List */}
        <div className="space-y-3 my-4 max-h-[60vh] overflow-y-auto pr-1">
          {(Object.keys(THEMES) as ThemeId[]).map((key) => {
            const theme = THEMES[key];
            const isSelected = currentTheme === key;

            return (
              <button
                key={key}
                onClick={() => {
                  onSelectTheme(key);
                  onClose();
                }}
                className={`w-full p-4 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between group ${
                  isSelected
                    ? 'bg-slate-800/90 border-amber-400 ring-2 ring-amber-500/30 shadow-xl'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  {/* Theme Color Circle Preview */}
                  <div
                    className="w-10 h-10 rounded-2xl shadow-inner flex items-center justify-center text-white font-bold text-xs relative overflow-hidden border border-white/20"
                    style={{
                      background: `linear-gradient(135deg, ${theme.previewColor}, #000)`
                    }}
                  >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {isSelected && <Check className="w-5 h-5 text-white" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{theme.name}</span>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                        {theme.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{theme.subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.previewColor }} />
                    <span className="w-3 h-3 rounded-full bg-slate-800" />
                    <span className="w-3 h-3 rounded-full bg-slate-950" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">Theme changes apply instantly across all player screens</p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 text-xs font-black rounded-xl uppercase tracking-wider"
          >
            Apply Theme
          </button>
        </div>
      </div>
    </div>
  );
};
