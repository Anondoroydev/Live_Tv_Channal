import React, { useState, useEffect } from "react";
import {
  Settings,
  Globe,
  Moon,
  Play,
  Info,
  Trash2,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { SettingsConfig } from "../types";

export const SettingsView: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [settings, setSettings] = useState<SettingsConfig>(() => {
    try {
      const saved = localStorage.getItem("myiptv_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          language: "en",
          theme: "dark",
          autoPlay: true,
          autoReconnect: true,
          bufferSize: 30,
          streamQuality: "auto",
          channelPreloading: true,
          streamProxyEnabled: true, // Default to true
          ...parsed,
        };
      }
    } catch (e) {}
    return {
      language: "bn", // Default to bn (Bengali) as requested/spoke by user
      theme: "dark",
      autoPlay: true,
      autoReconnect: true,
      bufferSize: 30,
      streamQuality: "auto",
      channelPreloading: true,
      streamProxyEnabled: true,
    };
  });

  const [cacheCleared, setCacheCleared] = useState(false);

  const updateSetting = <K extends keyof SettingsConfig>(key: K, value: SettingsConfig[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    try {
      localStorage.setItem("myiptv_settings", JSON.stringify(updated));
      // Notify active video players of immediate settings update
      window.dispatchEvent(
        new CustomEvent("myiptv_settings_updated", { detail: updated })
      );
    } catch (e) {}
  };

  const handleClearCache = () => {
    try {
      localStorage.removeItem("myiptv_active_channel");
    } catch (e) {}
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 3000);
  };

  // Translations dictionary for Bengali & English
  const isBn = settings.language === "bn";

  return (
    <div className="flex flex-col h-full bg-slate-950/95 border border-slate-850 rounded-3xl p-6 overflow-y-auto shadow-2xl text-white select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-wide uppercase">
              {isBn ? "সেটিংস কনফিগারেশন" : "Settings Configuration"}
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              {isBn
                ? "প্লেব্যাক মোড, স্ট্রিম প্রক্সি এবং অ্যাপ ইন্টারফেস পরিবর্তন করুন"
                : "Configure playback modes, stream proxy, and UI themes"}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold rounded-xl transition-colors"
          >
            {isBn ? "বন্ধ করুন ✕" : "Close ✕"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Playback Settings */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-5">
          <h3 className="font-bold text-sm text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <Play className="w-4 h-4" /> {isBn ? "প্লেয়ার ও স্ট্রিম সেটিংস" : "Player & Stream Configuration"}
          </h3>

          {/* Stream Proxy Toggle */}
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  {isBn ? "স্ট্রিম প্রক্সি (Stream Proxy)" : "Enable Stream Proxy"}
                </p>
                <p className="text-[11px] text-slate-400">
                  {isBn
                    ? "CORS সীমাবদ্ধতা এড়াতে প্রক্সি সার্ভার ব্যবহার করুন"
                    : "Route streams through secure proxy to bypass browser limits"}
                </p>
              </div>
              <button
                onClick={() => updateSetting("streamProxyEnabled", !settings.streamProxyEnabled)}
                className={`w-12 h-6 rounded-full transition-colors p-1 flex items-center ${
                  settings.streamProxyEnabled
                    ? "bg-amber-500 justify-end"
                    : "bg-slate-800 justify-start"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-slate-950 shadow-md" />
              </button>
            </div>
            {/* Context/Explanation Box inside settings */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-[11px] leading-relaxed text-slate-300">
              {isBn ? (
                <p>
                  ⚠️ <strong className="text-amber-400">গুরুত্বপূর্ণ নোটিশ:</strong> আপনার IPTV প্রোভাইডার যদি একাধিক ব্যক্তি একসঙ্গে ব্যবহার করার কারণে ব্লক করে দেয় (<span className="text-rose-400">Multi-connection limits</span>), তবে এই প্রক্সি অপশনটি <strong className="text-rose-400">বন্ধ (Off)</strong> করে দিন। বন্ধ রাখলে প্রতিটি মোবাইল সরাসরি IPTV সার্ভারে নিজস্ব আইপি দিয়ে যুক্ত হবে এবং কোনো প্লেব্যাক ফেইলর বা ডিসকানেক্ট সমস্যা হবে না। (মোবাইল অ্যাপ/অ্যান্ড্রয়েড টিভিতে সরাসরি অফ করা সাজেস্টেড)।
                </p>
              ) : (
                <p>
                  ⚠️ <strong className="text-amber-400">Important Notice:</strong> If your IPTV provider blocks playback or disconnects you due to multiple users (<span className="text-rose-400">Multi-connection limits</span>), <strong className="text-rose-400">DISABLE (Off)</strong> this Stream Proxy. Disabling it allows each device to connect directly using its own IP address, matching standard players like VLC or MX Player.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-800/60 pt-3">
            <div>
              <p className="text-xs font-bold text-white">{isBn ? "অটো প্লে স্ট্রিম" : "Auto Play Stream"}</p>
              <p className="text-[11px] text-slate-400">
                {isBn ? "চ্যানেল সিলেক্ট করার সাথে সাথে প্লেব্যাক শুরু করুন" : "Automatically start playing video on channel selection"}
              </p>
            </div>
            <button
              onClick={() => updateSetting("autoPlay", !settings.autoPlay)}
              className={`w-12 h-6 rounded-full transition-colors p-1 flex items-center ${
                settings.autoPlay
                  ? "bg-amber-500 justify-end"
                  : "bg-slate-800 justify-start"
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-slate-950 shadow-md" />
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-slate-800/60 pt-3">
            <div>
              <p className="text-xs font-bold text-white">
                {isBn ? "অটো রিকানেক্ট" : "Auto Reconnect Stream"}
              </p>
              <p className="text-[11px] text-slate-400">
                {isBn ? "কানেকশন কেটে গেলে স্বয়ংক্রিয়ভাবে আবার চেষ্টা করুন" : "Automatically retry when stream drops"}
              </p>
            </div>
            <button
              onClick={() => updateSetting("autoReconnect", !settings.autoReconnect)}
              className={`w-12 h-6 rounded-full transition-colors p-1 flex items-center ${
                settings.autoReconnect
                  ? "bg-amber-500 justify-end"
                  : "bg-slate-800 justify-start"
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-slate-950 shadow-md" />
            </button>
          </div>

          <div className="border-t border-slate-800/60 pt-3">
            <p className="text-xs font-bold text-white mb-1">
              {isBn ? "স্ট্রিম বাফার সাইজ" : "Stream Buffer Size"}
            </p>
            <div className="flex items-center gap-2">
              {[10, 30, 60].map((size) => (
                <button
                  key={size}
                  onClick={() => updateSetting("bufferSize", size)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    settings.bufferSize === size
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800"
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
          <h3 className="font-bold text-sm text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <Moon className="w-4 h-4" /> {isBn ? "অ্যাপ ইন্টারফেস ও ভাষা" : "Interface & Language"}
          </h3>

          <div>
            <p className="text-xs font-bold text-white mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-400" /> {isBn ? "অ্যাপের ভাষা (Language)" : "UI Language"}
            </p>
            <select
              value={settings.language}
              onChange={(e) => updateSetting("language", e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-bold cursor-pointer focus:outline-none focus:border-amber-500"
            >
              <option value="bn">Bangla (বাংলা)</option>
              <option value="en">English (US)</option>
              <option value="hi">Hindi (हिंदी)</option>
              <option value="es">Spanish (Español)</option>
            </select>
          </div>

          <div className="border-t border-slate-800/60 pt-3">
            <p className="text-xs font-bold text-white mb-1.5">{isBn ? "অ্যাপ ডিসপ্লে থিম" : "Dark TV Theme"}</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "dark", label: "TiviMate Dark" },
                { id: "midnight", label: "Midnight Blue" },
                { id: "oled", label: "Pure OLED Black" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => updateSetting("theme", t.id as any)}
                  className={`py-2 px-1 rounded-xl text-[11px] font-bold border text-center transition-colors ${
                    settings.theme === t.id
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-800/60 pt-4">
            <button
              onClick={handleClearCache}
              className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white font-bold rounded-xl text-xs border border-slate-800 flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4 text-rose-400" /> {isBn ? "প্লেব্যাক ও চ্যানেল ক্যাশ রিসেট করুন" : "Reset Playback & Channel Cache"}
            </button>

            {cacheCleared && (
              <p className="text-[10px] text-emerald-400 font-bold text-center mt-2 flex items-center justify-center gap-1 animate-pulse">
                <CheckCircle2 className="w-3.5 h-3.5" /> {isBn ? "ক্যাশ সফলভাবে পরিষ্কার করা হয়েছে!" : "Local channel cache cleared successfully!"}
              </p>
            )}
          </div>
        </div>

        {/* About App */}
        <div className="col-span-1 md:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Info className="w-6 h-6 text-amber-400" />
            <div>
              <p className="font-bold text-sm text-white">
                Blink WebTV v2.5.0 (Android TV & Mobile Pro)
              </p>
              <p className="text-xs text-slate-400">
                {isBn
                  ? "ইঞ্জিন: AndroidX Media3 (ExoPlayer) • HLS/M3U8 ডিরেক্ট প্লেব্যাক • XMLTV EPG ইন্টিগ্রেশন • JWT টোকেন সিকিউরিটি"
                  : "Engine: AndroidX Media3 (ExoPlayer) • Direct HLS/M3U8 Stream Driver • XMLTV EPG Parser • JWT Security"}
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-xs font-mono font-bold rounded-xl border border-amber-500/30">
            PRO BUILD
          </span>
        </div>
      </div>
    </div>
  );
};
