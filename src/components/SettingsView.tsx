import React, { useState } from 'react';
import { Settings, Globe, Moon, Play, RefreshCw, HardDrive, Info, Trash2, CheckCircle2 } from 'lucide-react';
import { SettingsConfig } from '../types';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<SettingsConfig>({
    language: 'en',
    theme: 'dark',
    autoPlay: true,
    autoReconnect: true,
    bufferSize: 30,
    streamQuality: 'auto'
  });

  const [cacheCleared, setCacheCleared] = useState(false);

  const handleClearCache = () => {
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 3000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/80 border border-slate-800/80 rounded-3xl p-6 overflow-y-auto shadow-2xl backdrop-blur-xl text-white select-none">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-800 mb-6">
        <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-2xl border border-cyan-500/20">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black tracking-wide">IPTV Application Settings</h2>
          <p className="text-xs text-slate-400 font-medium">Configure Android TV Playback, Cache & Interface</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Playback Settings */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
          <h3 className="font-bold text-sm text-cyan-400 uppercase tracking-wider flex items-center gap-2">
            <Play className="w-4 h-4" /> Player & Stream Configuration
          </h3>

          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-xs font-bold text-white">Auto Play Stream</p>
              <p className="text-[11px] text-slate-400">Automatically start playing video on channel selection</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, autoPlay: !settings.autoPlay })}
              className={`w-12 h-6 rounded-full transition-colors p-1 flex items-center ${
                settings.autoPlay ? 'bg-cyan-500 justify-end' : 'bg-slate-800 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-slate-950 shadow-md" />
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-slate-800/60 pt-3">
            <div>
              <p className="text-xs font-bold text-white">Auto Reconnect Stream</p>
              <p className="text-[11px] text-slate-400">Automatically retry when connection drops</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, autoReconnect: !settings.autoReconnect })}
              className={`w-12 h-6 rounded-full transition-colors p-1 flex items-center ${
                settings.autoReconnect ? 'bg-cyan-500 justify-end' : 'bg-slate-800 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-slate-950 shadow-md" />
            </button>
          </div>

          <div className="border-t border-slate-800/60 pt-3">
            <p className="text-xs font-bold text-white mb-1">Stream Buffer Size</p>
            <div className="flex items-center gap-2">
              {[10, 30, 60].map((size) => (
                <button
                  key={size}
                  onClick={() => setSettings({ ...settings, bufferSize: size })}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    settings.bufferSize === size
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {size}s Buffer
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Interface & Theme */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
          <h3 className="font-bold text-sm text-cyan-400 uppercase tracking-wider flex items-center gap-2">
            <Moon className="w-4 h-4" /> Interface & Language
          </h3>

          <div>
            <p className="text-xs font-bold text-white mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-400" /> UI Language
            </p>
            <select
              value={settings.language}
              onChange={(e) => setSettings({ ...settings, language: e.target.value as any })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-bold cursor-pointer"
            >
              <option value="en">English (US)</option>
              <option value="bn">Bangla (বাংলা)</option>
              <option value="hi">Hindi (हिंदी)</option>
              <option value="es">Spanish (Español)</option>
            </select>
          </div>

          <div className="border-t border-slate-800/60 pt-3">
            <p className="text-xs font-bold text-white mb-1.5">Dark TV Theme</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'dark', label: 'TiviMate Dark' },
                { id: 'midnight', label: 'Midnight Blue' },
                { id: 'oled', label: 'Pure OLED Black' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSettings({ ...settings, theme: t.id as any })}
                  className={`py-2 px-1 rounded-xl text-[11px] font-bold border text-center transition-colors ${
                    settings.theme === t.id
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-800/60 pt-3">
            <button
              onClick={handleClearCache}
              className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white font-bold rounded-xl text-xs border border-slate-800 flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4 text-rose-400" /> Clear Local Channel & EPG Cache
            </button>

            {cacheCleared && (
              <p className="text-[10px] text-emerald-400 font-bold text-center mt-2 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Local channel cache cleared!
              </p>
            )}
          </div>
        </div>

        {/* About App */}
        <div className="col-span-1 md:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Info className="w-6 h-6 text-cyan-400" />
            <div>
              <p className="font-bold text-sm text-white">My IPTV v2.4.0 (Android TV Edition)</p>
              <p className="text-xs text-slate-400">
                Engine: AndroidX Media3 (ExoPlayer) • HLS/M3U8 Parser • XMLTV EPG Matrix • JWT Token Security
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold rounded-xl border border-cyan-500/30">
            PRO BUILD
          </span>
        </div>
      </div>
    </div>
  );
};
