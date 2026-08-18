import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Upload,
  Tv,
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Plus,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Sparkles,
  BarChart3,
  RefreshCw,
  Hash,
  ListPlus,
  Clock,
  Link as LinkIcon,
  Server,
  KeyRound,
  Calendar,
  Globe,
  FileCode,
  FileUp,
  AlertCircle,
  X,
} from "lucide-react";
import { List } from "react-window";

import { apiService } from "../services/api";
import { Channel, User, SubscriptionPlan } from "../types";
import PaymentTable from "./admin/PaymentTable";

interface AdminPanelProps {
  onDataChanged?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onDataChanged }) => {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "m3u" | "xtream" | "m3u_url" | "channels" | "users" | "payments"
  >("dashboard");
  const [stats, setStats] = useState<{
    totalChannels: number;
    activeChannels: number;
    premiumChannels: number;
    totalUsers: number;
    activeSubscriptions: number;
  }>({
    totalChannels: 0,
    activeChannels: 0,
    premiumChannels: 0,
    totalUsers: 0,
    activeSubscriptions: 0,
  });

  const [playlistSource, setPlaylistSource] = useState<{
    type: "default" | "m3u_text" | "m3u_url" | "xtream";
    url: string;
    xtreamServer: string;
    xtreamUser: string;
    lastSyncedAt: string;
    totalChannels: number;
  } | null>(null);

  // M3U Text State
  const [m3uText, setM3uText] = useState("");

  // M3U File Drag-and-Drop state
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const m3uTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  // M3U URL State
  const [m3uUrlInput, setM3uUrlInput] = useState("");

  // Xtream Codes State
  const [xtreamServer, setXtreamServer] = useState("");
  const [xtreamUser, setXtreamUser] = useState("");
  const [xtreamPass, setXtreamPass] = useState("");

  const [overwritePlaylist, setOverwritePlaylist] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [startNumber, setStartNumber] = useState(0);

  // Search/filter states for tables
  const [channelSearch, setChannelSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  // Inline delete confirmation states
  const [userDeleteConfirmId, setUserDeleteConfirmId] = useState<string | null>(
    null,
  );
  const [channelDeleteConfirmId, setChannelDeleteConfirmId] = useState<
    string | null
  >(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const loadData = async (notifyParent = true) => {
    try {
      const [s, chsData, us, pSource] = await Promise.all([
        apiService.adminFetchStats(),
        apiService.adminFetchChannels().catch(() => ({ channels: [], total: 0 })),
        apiService.adminFetchUsers(),
        apiService.getPlaylistSource().catch(() => null),
      ]);
      setStats(s);
      setChannels(chsData.channels || []);
      setUsers(us);
      if (pSource) setPlaylistSource(pSource);
      if (notifyParent) {
        onDataChanged?.();
      }
    } catch (err: any) {
      console.error("Failed to load admin data", err);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  // Handle M3U Text or File Upload Parsing
  const handleM3uUpload = async () => {
    const rawText = m3uTextAreaRef.current?.value || m3uText;
    if (!rawText.trim()) {
      setUploadErrorMsg(
        "Please drag & drop an M3U file, browse a file, or paste your M3U playlist text containing #EXTINF links.",
      );
      return;
    }
    setUploadLoading(true);
    setUploadSuccessMsg(null);
    setUploadErrorMsg(null);
    try {
      const res = await apiService.uploadM3U(rawText, overwritePlaylist);
      setUploadSuccessMsg(res.message);
      if (m3uTextAreaRef.current) m3uTextAreaRef.current.value = "";
      setM3uText("");
      setSelectedFileName(null);
      loadData();
    } catch (err: any) {
      setUploadErrorMsg(
        err.message || "Failed to upload and parse M3U playlist",
      );
    } finally {
      setUploadLoading(false);
    }
  };

  // M3U File Handlers
  const handleFileRead = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (m3uTextAreaRef.current) {
        m3uTextAreaRef.current.value = text;
      }
      setM3uText(text);
      setSelectedFileName(file.name);
      setUploadSuccessMsg(
        `Loaded "${file.name}" (${(file.size / 1024).toFixed(1)} KB) successfully. Ready to import.`,
      );
      setUploadErrorMsg(null);
    };
    reader.onerror = () => {
      setUploadErrorMsg("Error occurred while reading the M3U file.");
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileRead(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileRead(e.target.files[0]);
    }
  };

  const clearSelectedFile = () => {
    setM3uText("");
    setSelectedFileName(null);
    setUploadSuccessMsg(null);
    setUploadErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleM3uUrlImport = async () => {
    if (!m3uUrlInput.trim()) {
      setUploadErrorMsg("Please enter a valid HTTP/HTTPS M3U Playlist URL.");
      return;
    }
    setUploadLoading(true);
    setUploadSuccessMsg(null);
    setUploadErrorMsg(null);
    try {
      const res = await apiService.importM3uUrl(m3uUrlInput, overwritePlaylist);
      setUploadSuccessMsg(res.message);
      setM3uUrlInput("");
      loadData();
    } catch (err: any) {
      setUploadErrorMsg(err.message || "Failed to import M3U URL");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleXtreamConnect = async () => {
    if (!xtreamServer.trim() || !xtreamUser.trim() || !xtreamPass.trim()) {
      setUploadErrorMsg(
        "Please fill in your Xtream Server URL, Username, and Password.",
      );
      return;
    }
    setUploadLoading(true);
    setUploadSuccessMsg(null);
    setUploadErrorMsg(null);
    try {
      const res = await apiService.importXtreamCodes(
        xtreamServer,
        xtreamUser,
        xtreamPass,
        overwritePlaylist,
      );
      setUploadSuccessMsg(res.message);
      loadData();
    } catch (err: any) {
      setUploadErrorMsg(
        err.message || "Failed to connect Xtream Codes account",
      );
    } finally {
      setUploadLoading(false);
    }
  };

  const handleToggleChannelActive = async (channel: Channel) => {
    try {
      await apiService.adminUpdateChannel(channel.id, {
        isActive: !channel.isActive,
      });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleChannelPremium = async (channel: Channel) => {
    try {
      await apiService.adminUpdateChannel(channel.id, {
        isPremium: !channel.isPremium,
      });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteChannel = async (id: string) => {
    try {
      await apiService.adminDeleteChannel(id);
      setChannels((prev) => prev.filter((c) => c.id !== id));
      setStats((prev) => ({
        ...prev,
        totalChannels: Math.max(0, prev.totalChannels - 1),
      }));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReassignNumbers = async () => {
    try {
      await apiService.adminAssignNumbers(startNumber);
      alert("Channel numbers reassigned successfully!");
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const [newUserModalOpen, setNewUserModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPlan, setNewUserPlan] = useState<SubscriptionPlan>(
    "1 Month Standard (৳45)",
  );
  const [newUserRole, setNewUserRole] = useState<"user" | "admin">("user");

  const handleUserSubChange = async (
    userId: string,
    plan: SubscriptionPlan,
  ) => {
    try {
      await apiService.adminUpdateUserSubscription(userId, plan);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUserAdultAccessChange = async (
    userId: string,
    hasAdultAccess: boolean,
  ) => {
    try {
      await apiService.adminUpdateUserAdultAccess(userId, hasAdultAccess);
      setUploadSuccessMsg(`Adult access ${hasAdultAccess ? 'enabled' : 'restricted'} for user.`);
      setTimeout(() => setUploadSuccessMsg(""), 3000);
      loadData();
    } catch (err: any) {
      setUploadErrorMsg(err.message || "Failed to update adult access");
      setTimeout(() => setUploadErrorMsg(""), 3000);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return alert("Username is required");
    try {
      await apiService.adminCreateUser({
        username: newUsername.trim(),
        email: newUserEmail.trim() || undefined,
        role: newUserRole,
        subscriptionPlan: newUserPlan,
      });
      setNewUserModalOpen(false);
      setNewUsername("");
      setNewUserEmail("");
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to create user");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await apiService.adminDeleteUser(userId);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleClearChannels = async () => {
    try {
      setUploadLoading(true);
      const res = await apiService.adminClearChannels();
      setUploadSuccessMsg(res.message);
      setShowClearConfirm(false);
      await loadData();
      onDataChanged?.();
    } catch (err: any) {
      setUploadErrorMsg(err.message || "Failed to clear channels");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleResetDefaultChannels = async () => {
    try {
      setUploadLoading(true);
      const res = await apiService.adminResetDefaultChannels();
      setUploadSuccessMsg(res.message);
      await loadData();
      onDataChanged?.();
    } catch (err: any) {
      setUploadErrorMsg(err.message || "Failed to restore default channels");
    } finally {
      setUploadLoading(false);
    }
  };

  const sampleM3U = `#EXTM3U
#EXTINF:-1 tvg-id="atn.bd" tvg-name="ATN Bangla" tvg-logo="https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=200" group-title="Bangla",ATN Bangla
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
#EXTINF:-1 tvg-id="sony.sports.1" tvg-name="Sony Sports 1 HD" tvg-logo="https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=200" group-title="Sports",Sony Sports 1 HD
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4
#EXTINF:-1 tvg-id="bbc.news" tvg-name="BBC World News" tvg-logo="https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=200" group-title="News",BBC World News
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4`;

  // Filter channels based on search
  const filteredChannels = (channels || []).filter(
    (ch) =>
      (ch?.name || "").toLowerCase().includes((channelSearch || "").toLowerCase()) ||
      (ch?.category || "").toLowerCase().includes((channelSearch || "").toLowerCase()) ||
      String(ch?.channelNumber || "").includes(channelSearch || ""),
  );

  // Filter users based on search
  const filteredUsers = (users || []).filter(
    (u) =>
      (u?.username || "").toLowerCase().includes((userSearch || "").toLowerCase()) ||
      (u?.email && typeof u.email === "string" && u.email.toLowerCase().includes((userSearch || "").toLowerCase())),
  );

  const ChannelRow = useCallback(({
    index,
    style,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => {
    const ch = filteredChannels[index];
    if (!ch) return null;

    return (
      <div
        style={style}
        className="flex items-center border-b border-slate-800/40 hover:bg-slate-900/50 transition-colors px-3 text-[11px]"
      >
        <div className="w-12 font-mono font-black text-amber-500 shrink-0">
          {ch.channelNumber || "—"}
        </div>
        <div className="w-12 shrink-0">
          <img
            src={
              ch.logo ||
              "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=100"
            }
            alt=""
            className="w-7 h-7 rounded-lg object-contain bg-slate-900 border border-slate-800/40"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=100";
            }}
          />
        </div>
        <div className="flex-1 min-w-0 pr-4">
          <div className="font-bold text-slate-100 truncate">{ch.name}</div>
          <div className="text-[9px] text-slate-500 truncate font-mono">
            {ch.id}
          </div>
        </div>
        <div className="w-32 shrink-0">
          <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded-md text-[9px] font-bold uppercase truncate block w-fit">
            {ch.category}
          </span>
        </div>
        <div className="w-24 shrink-0">
          <button
            onClick={() => handleToggleChannelPremium(ch)}
            className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide transition-colors ${
              ch.isPremium
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
                : "bg-slate-800 text-slate-400 border border-slate-700/50 hover:bg-slate-700"
            }`}
          >
            {ch.isPremium ? "VIP PREMIUM" : "FREE WATCH"}
          </button>
        </div>
        <div className="w-24 shrink-0">
          <button
            onClick={() => handleToggleChannelActive(ch)}
            className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide transition-colors ${
              ch.isActive
                ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20"
            }`}
          >
            {ch.isActive ? "ACTIVE" : "OFFLINE"}
          </button>
        </div>
        <div className="w-20 shrink-0 text-right">
          {channelDeleteConfirmId === ch.id ? (
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={() => {
                  handleDeleteChannel(ch.id);
                  setChannelDeleteConfirmId(null);
                }}
                className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[9px] font-bold"
              >
                Yes
              </button>
              <button
                onClick={() => setChannelDeleteConfirmId(null)}
                className="px-1.5 py-0.5 bg-slate-700 text-white rounded text-[9px] font-bold"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setChannelDeleteConfirmId(ch.id)}
              className="p-1.5 text-slate-500 hover:text-rose-500 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }, [filteredChannels, channelDeleteConfirmId, handleDeleteChannel, handleToggleChannelPremium, handleToggleChannelActive]);

  return (
    <div className="flex flex-col h-[640px] text-slate-100">
      {/* Sub Header / Tab Bar */}
      <div className="flex flex-col gap-4 border-b border-slate-800/80 pb-4 mb-5">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/60 p-1 rounded-2xl border border-slate-800/80">
          <button
            onClick={() => {
              setActiveTab("dashboard");
              setUploadSuccessMsg(null);
              setUploadErrorMsg(null);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 uppercase tracking-wide ${
              activeTab === "dashboard"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Dashboard
          </button>

          <button
            onClick={() => {
              setActiveTab("m3u");
              setUploadSuccessMsg(null);
              setUploadErrorMsg(null);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 uppercase tracking-wide ${
              activeTab === "m3u"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
            }`}
          >
            <Upload className="w-3.5 h-3.5" /> M3U Upload / Paste
          </button>

          <button
            onClick={() => {
              setActiveTab("m3u_url");
              setUploadSuccessMsg(null);
              setUploadErrorMsg(null);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 uppercase tracking-wide ${
              activeTab === "m3u_url"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" /> M3U Link URL
          </button>

          <button
            onClick={() => {
              setActiveTab("xtream");
              setUploadSuccessMsg(null);
              setUploadErrorMsg(null);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 uppercase tracking-wide ${
              activeTab === "xtream"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
            }`}
          >
            <Server className="w-3.5 h-3.5" /> Xtream API
          </button>

          <button
            onClick={() => {
              setActiveTab("channels");
              setUploadSuccessMsg(null);
              setUploadErrorMsg(null);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 uppercase tracking-wide ${
              activeTab === "channels"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
            }`}
          >
            <Tv className="w-3.5 h-3.5" /> Channels ({channels.length})
          </button>

          <button
            onClick={() => {
              setActiveTab("users");
              setUploadSuccessMsg(null);
              setUploadErrorMsg(null);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 uppercase tracking-wide ${
              activeTab === "users"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Subscribers ({users.length})
          </button>

          <button
            onClick={() => {
              setActiveTab("payments");
              setUploadSuccessMsg(null);
              setUploadErrorMsg(null);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 uppercase tracking-wide ${
              activeTab === "payments"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Payments
          </button>
        </div>
      </div>

      {/* Global Success/Error Status banners */}
      {uploadSuccessMsg && (
        <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs font-bold text-emerald-400 flex items-start gap-2.5 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-extrabold uppercase text-[10px] block text-emerald-500 mb-0.5">
              Success Status
            </span>
            {uploadSuccessMsg}
          </div>
          <button
            onClick={() => setUploadSuccessMsg(null)}
            className="text-emerald-400 hover:text-emerald-200 ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {uploadErrorMsg && (
        <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs font-bold text-rose-400 flex items-start gap-2.5 shadow-sm">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-extrabold uppercase text-[10px] block text-rose-500 mb-0.5">
              Operation Failed
            </span>
            {uploadErrorMsg}
          </div>
          <button
            onClick={() => setUploadErrorMsg(null)}
            className="text-rose-400 hover:text-rose-200 ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* DASHBOARD TAB */}
      {activeTab === "dashboard" && (
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 border border-slate-800/70 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-700/80 transition-all shadow-md">
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">
                  TOTAL CHANNELS
                </span>
                <p className="text-2xl font-black text-white font-mono">
                  {stats.totalChannels}
                </p>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold mt-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {stats.activeChannels} Active Streams
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/70 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-700/80 transition-all shadow-md">
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">
                  PREMIUM CHANNELS
                </span>
                <p className="text-2xl font-black text-amber-400 font-mono">
                  {stats.premiumChannels}
                </p>
              </div>
              <span className="text-[10px] text-amber-300 font-bold mt-2">
                Requires Active VIP Plan
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/70 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-700/80 transition-all shadow-md">
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">
                  TOTAL SUBSCRIBERS
                </span>
                <p className="text-2xl font-black text-cyan-400 font-mono">
                  {stats.totalUsers}
                </p>
              </div>
              <span className="text-[10px] text-cyan-300 font-bold mt-2">
                {stats.activeSubscriptions} Active Paid accounts
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/70 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-700/80 transition-all shadow-md">
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">
                  PLAYLIST SOURCE
                </span>
                <p className="text-sm font-black text-emerald-400 truncate uppercase mt-1">
                  {playlistSource?.type === "xtream"
                    ? "Xtream Codes"
                    : playlistSource?.type === "m3u_url"
                      ? "M3U URL"
                      : playlistSource?.type === "m3u_text"
                        ? "M3U Paste/File"
                        : "Default Setup"}
                </p>
              </div>
              <span className="text-[10px] text-slate-400 font-mono mt-2 truncate">
                Sync:{" "}
                {playlistSource
                  ? new Date(playlistSource.lastSyncedAt).toLocaleDateString()
                  : "Active Now"}
              </span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/70 p-5 rounded-2xl shadow-md">
            <h3 className="font-extrabold text-sm text-slate-200 uppercase tracking-wide flex items-center gap-2 mb-1.5">
              <Hash className="w-4 h-4 text-amber-400" /> Channel Number
              Auto-Assigner
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Instantly re-assign channel digits (e.g. 101, 102, 103...) across
              the entire database. This allows clients to trigger high speed
              remote buffer switching and enter exact digital buffer keys.
            </p>
            <div className="flex flex-wrap items-center gap-3.5 bg-slate-950 p-3 rounded-xl border border-slate-800/60 w-fit">
              <span className="text-xs font-bold text-slate-400">
                Start Sequence:
              </span>
              <input
                type="number"
                value={startNumber}
                onChange={(e) => setStartNumber(Number(e.target.value))}
                className="w-20 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-xs text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={handleReassignNumbers}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-xs uppercase tracking-wider transition-all"
              >
                Reassign Sequence Numbers
              </button>
            </div>
          </div>

          <div className="bg-rose-500/5 border border-rose-500/20 p-5 rounded-2xl shadow-md">
            <h3 className="font-extrabold text-sm text-rose-400 uppercase tracking-wide flex items-center gap-2 mb-1.5">
              <Trash2 className="w-4 h-4 text-rose-500" /> Factory Reset /
              Format
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              DANGER: This will instantly delete all custom M3U playlists,
              Xtream connections, and manually added channels. The database will
              be formatted and reset to factory default channels only.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleResetDefaultChannels}
                disabled={uploadLoading}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-md shadow-amber-500/10 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${uploadLoading ? "animate-spin" : ""}`} />
                Restore Verified Default Working Channels
              </button>

              <button
                onClick={async () => {
                  if (
                    window.confirm(
                      "Are you absolutely sure? This will FORMAT the database and reset all channels to defaults.",
                    )
                  ) {
                    try {
                      await apiService.resetDatabase();
                      alert("Database formatted successfully!");
                      loadData();
                    } catch (err: any) {
                      alert(err.message);
                    }
                  }
                }}
                className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/30 text-rose-500 hover:text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all"
              >
                Format & Reset Database ✕
              </button>
            </div>
          </div>

          {/* Quick Business Tips banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black text-amber-300 uppercase tracking-wide mb-1">
                  Business Administration Quick Guide
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Connect your monthly paid IPTV playlist using the{" "}
                  <strong>M3U Link URL</strong> tab to enable automatic cloud
                  updates, or drag an <code>.m3u</code> file directly in the{" "}
                  <strong>M3U Upload</strong> section. Under{" "}
                  <strong>Subscribers</strong>, you can create and sell custom
                  accounts, and customize plan limits.
                </p>
              </div>
            </div>

            <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-2xl flex items-start gap-3">
              <Users className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <h4 className="text-xs font-black text-cyan-300 uppercase tracking-wide">
                  ইউজার রেজিস্ট্রেশন করলে এডমিন কিভাবে এক্সেস দিবে? (How to Give
                  Access?)
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  ১. নতুন কোনো ইউজার অ্যাকাউন্ট রেজিস্টার করলে সে ডিফল্টভাবে{" "}
                  <strong className="text-cyan-400">Free Account</strong> হিসেবে
                  যুক্ত হয়।
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  ২. ইউজারকে প্রিমিয়াম এক্সেস দিতে উপরে{" "}
                  <strong className="text-slate-200">
                    Subscribers (গ্রাহকবৃন্দ)
                  </strong>{" "}
                  ট্যাবে যান।
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  ৩. ওই ইউজারের নামের পাশে{" "}
                  <strong className="text-amber-400">Update Plan Limit</strong>{" "}
                  ড্রপডাউন থেকে পছন্দের প্যাকেজটি সিলেক্ট করে দিন। সাথে সাথে তার
                  অ্যাকাউন্টটি আপগ্রেড হয়ে যাবে!
                </p>
                <div className="pt-1.5 border-t border-slate-800/80 mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="text-slate-300 font-bold">WhatsApp:</span>
                  <a
                    href="https://wa.me/8801826339098"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 font-bold hover:underline"
                  >
                    01826339098
                  </a>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-300 font-bold">
                    bKash/Nagad/Rocket:
                  </span>
                  <span className="text-amber-400 font-mono font-bold">
                    01826339098
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* M3U UPLOAD & FILE DROP TAB */}
      {activeTab === "m3u" && (
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="bg-slate-900/60 border border-slate-800/70 p-5 rounded-2xl space-y-4 shadow-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div>
                <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide flex items-center gap-2">
                  <FileUp className="w-4.5 h-4.5 text-amber-400" /> Upload or
                  Paste M3U Playlist File
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Parse channels, stream paths, and channel groups instantly.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setM3uText(sampleM3U);
                  setSelectedFileName("sample-channels.m3u");
                  setUploadSuccessMsg(
                    "Loaded sample playlist text. Press 'Parse & Save Playlist' below to test.",
                  );
                }}
                className="text-xs font-extrabold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg border border-amber-500/20 transition-colors uppercase tracking-wider text-[10px]"
              >
                Insert Test Demo M3U
              </button>
            </div>

            {/* M3U File Drag & Drop Target Component */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragActive
                  ? "border-amber-500 bg-amber-500/5"
                  : selectedFileName
                    ? "border-emerald-500/50 bg-emerald-500/5"
                    : "border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/60"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".m3u,.m3u8,.txt"
                onChange={handleFileChange}
                className="hidden"
              />

              {selectedFileName ? (
                <div className="space-y-2">
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl w-fit mx-auto border border-emerald-500/20">
                    <FileCode className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white font-mono">
                      {selectedFileName}
                    </p>
                    <p className="text-xs text-emerald-400 font-bold mt-1">
                      File Loaded Successfully!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearSelectedFile();
                    }}
                    className="mt-2 px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-rose-400 text-[10px] font-black rounded-lg uppercase tracking-wide transition-colors"
                  >
                    Remove File
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="p-3 bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl w-fit mx-auto group-hover:text-amber-400 transition-colors">
                    <Upload className="w-8 h-8 text-amber-500/80" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-200 uppercase tracking-wider">
                      Drag & Drop M3U File Here
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      or click to browse your computer (supports{" "}
                      <code>.m3u</code>, <code>.m3u8</code>, or{" "}
                      <code>.txt</code>)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Collapsible Manual Raw Paste input area */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Or Paste Playlist Raw Code / Edit Loaded File:
              </label>
              <textarea
                ref={m3uTextAreaRef}
                rows={5}
                defaultValue={m3uText}
                placeholder='#EXTM3U&#10;#EXTINF:-1 tvg-logo="http://logo.png" group-title="Sports", Channel 1&#10;http://stream.url/m3u8'
                className="w-full bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2.5 text-xs font-bold text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overwritePlaylist}
                    onChange={(e) => setOverwritePlaylist(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-800 focus:ring-0 cursor-pointer"
                  />
                  <span>Replace / overwrite existing playlists completely</span>
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm("Are you sure you want to PERMANENTLY CLEAR ALL channels? This cannot be undone.")) {
                      try {
                        setUploadLoading(true);
                        const res = await apiService.adminClearChannels();
                        setUploadSuccessMsg(res.message);
                        await loadData();
                        onDataChanged?.();
                      } catch (err: any) {
                        setUploadErrorMsg(err.message || "Failed to clear channels");
                      } finally {
                        setUploadLoading(false);
                      }
                    }
                  }}
                  className="text-[10px] font-black text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 px-3 py-1 rounded-lg border border-rose-500/20 transition-all uppercase tracking-wider cursor-pointer"
                >
                  Clear All Channels
                </button>
              </div>

              <button
                onClick={handleM3uUpload}
                disabled={uploadLoading}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploadLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Parsing & Saving...</span>
                  </>
                ) : (
                  <span>Parse & Save Playlist</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* M3U URL IMPORT TAB */}
      {activeTab === "m3u_url" && (
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="bg-slate-900/60 border border-slate-800/70 p-5 rounded-2xl space-y-4 shadow-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div>
                <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide flex items-center gap-2">
                  <LinkIcon className="w-4.5 h-4.5 text-amber-400" /> Connect
                  Cloud M3U URL
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">
                  Keep channel lists synchronized with your provider server.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 text-[10px] font-mono font-bold rounded-lg border border-amber-500/20 uppercase tracking-wider">
                Sync Enabled
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Input your provider M3U subscription link (e.g.,{" "}
              <code className="text-amber-400 font-mono">
                http://server-address.com:8080/get.php?username=XXX&password=YYY&type=m3u_plus
              </code>
              ). The backend will automatically fetch updated category playlists
              and stream references.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wide">
                M3U Playlist Subscription Link(s) (HTTP/HTTPS)
              </label>
              <textarea
                value={m3uUrlInput}
                onChange={(e) => setM3uUrlInput(e.target.value)}
                rows={4}
                placeholder="https://example-iptv.com/get.php?username=XXX&password=YYY&type=m3u_plus&#10;https://another-provider.com/playlist.m3u"
                className="w-full bg-slate-950 border border-slate-800/80 rounded-2xl px-4 py-3.5 text-xs text-amber-400 font-mono focus:outline-none focus:border-amber-500 transition-all placeholder:text-slate-700"
              />
              <p className="text-[10px] text-slate-500 mt-2 italic">
                * You can now add multiple URLs! Just separate them with newlines or commas. The system will fetch and merge channels from all provided sources.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2.5 text-xs font-bold text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overwritePlaylist}
                    onChange={(e) => setOverwritePlaylist(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-800 focus:ring-0 cursor-pointer"
                  />
                  <span>Delete previous list and overwrite</span>
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm("Are you sure you want to PERMANENTLY CLEAR ALL channels? This cannot be undone.")) {
                      try {
                        setUploadLoading(true);
                        const res = await apiService.adminClearChannels();
                        setUploadSuccessMsg(res.message);
                        await loadData();
                        onDataChanged?.();
                      } catch (err: any) {
                        setUploadErrorMsg(err.message || "Failed to clear channels");
                      } finally {
                        setUploadLoading(false);
                      }
                    }
                  }}
                  className="text-[10px] font-black text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 px-3 py-1 rounded-lg border border-rose-500/20 transition-all uppercase tracking-wider cursor-pointer"
                >
                  Clear All Channels
                </button>
              </div>

              <button
                onClick={handleM3uUrlImport}
                disabled={uploadLoading}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50"
              >
                {uploadLoading
                  ? "Downloading Link..."
                  : "Fetch & Sync M3U Link"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* XTREAM CODES API TAB */}
      {activeTab === "xtream" && (
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="bg-slate-900/60 border border-slate-800/70 p-5 rounded-2xl space-y-4 shadow-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div>
                <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide flex items-center gap-2">
                  <Server className="w-4.5 h-4.5 text-amber-400" /> Xtream Codes
                  API Authentication
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Stream direct Live TV, Series, and VOD streams from your reseller
                  server.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 text-[10px] font-mono font-bold rounded-lg border border-amber-500/20 uppercase tracking-wider">
                Reseller API
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Connect via your reseller credential parameters. The system will
              retrieve category listings, custom digital numbers, and EPG
              programming schedules dynamically.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Xtream Server URL
                </label>
                <input
                  type="text"
                  value={xtreamServer}
                  onChange={(e) => setXtreamServer(e.target.value)}
                  placeholder="e.g. http://server.dns.net:8080"
                  className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={xtreamUser}
                  onChange={(e) => setXtreamUser(e.target.value)}
                  placeholder="Your Xtream account user"
                  className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={xtreamPass}
                  onChange={(e) => setXtreamPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2.5 text-xs font-bold text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overwritePlaylist}
                    onChange={(e) => setOverwritePlaylist(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-800 focus:ring-0 cursor-pointer"
                  />
                  <span>Delete previous entries and sync</span>
                </label>
                <button
                  type="button"
                  onClick={handleClearChannels}
                  className="text-[10px] font-black text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 px-3 py-1 rounded-lg border border-rose-500/20 transition-all uppercase tracking-wider cursor-pointer"
                >
                  Clear All Channels
                </button>
              </div>

              <button
                onClick={handleXtreamConnect}
                disabled={uploadLoading}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50"
              >
                {uploadLoading
                  ? "Verifying Xtream Account..."
                  : "Verify & Load Xtream API"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHANNELS MANAGER TAB */}
      {activeTab === "channels" && (
        <div className="flex-1 flex flex-col min-h-0 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-2xl border border-slate-800/60">
            <div>
              <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">
                Loaded Channels List ({channels.length})
              </h3>
              <p className="text-[10px] text-slate-400">
                Search streams or toggle status / premium parameters
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Filter by name or category group..."
                value={channelSearch}
                onChange={(e) => setChannelSearch(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 w-full sm:w-64"
              />
              {channels.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearChannels}
                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30 rounded-xl text-xs transition-all uppercase tracking-wider shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear All ({channels.length})
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 border border-slate-800/80 rounded-2xl bg-slate-950/60 shadow-sm min-h-0 overflow-hidden">
            {filteredChannels.length === 0 ? (
              <div className="py-12 text-center">
                <Tv className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-bold">
                  No channels matched your search query.
                </p>
              </div>
            ) : (
              <div className="flex flex-col h-full overflow-x-auto scrollbar-thin">
                <div className="flex items-center bg-slate-900/80 text-slate-400 font-extrabold uppercase tracking-wider border-b border-slate-800 px-3 py-2 text-[9px] min-w-[700px]">
                  <div className="w-12 shrink-0">Digit</div>
                  <div className="w-12 shrink-0">Logo</div>
                  <div className="flex-1 pr-4">Channel Stream Title</div>
                  <div className="w-32 shrink-0">Category Group</div>
                  <div className="w-24 shrink-0">Access Plan</div>
                  <div className="w-24 shrink-0">View Status</div>
                  <div className="w-20 shrink-0 text-right">Action</div>
                </div>
                <div className="flex-1 min-h-0 min-w-[700px]">
                  <List
                    className="w-full h-full"
                    rowCount={filteredChannels.length}
                    rowHeight={44}
                    rowComponent={ChannelRow as any}
                    rowProps={{}}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAYMENTS MANAGER TAB */}
      {activeTab === "payments" && (
        <div className="flex-1 overflow-y-auto min-h-0 space-y-3.5 pr-1">
          <PaymentTable />
        </div>
      )}

      {/* USERS MANAGER TAB */}
      {activeTab === "users" && (
        <div className="flex-1 flex flex-col min-h-0 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-2xl border border-slate-800/60">
            <div>
              <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">
                Database Users ({users.length})
              </h3>
              <p className="text-[10px] text-slate-400">
                Search customer emails or change subscription plan thresholds
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search user ID or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 w-full sm:w-48"
              />
              <button
                onClick={() => setNewUserModalOpen(true)}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-md text-[10px] uppercase tracking-wider flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Create Subscriber
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto scrollbar-thin border border-slate-800/80 rounded-2xl bg-slate-950/60 shadow-sm min-h-0">
            {filteredUsers.length === 0 ? (
              <div className="py-12 text-center min-w-[800px]">
                <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-bold">
                  No active users matched your search criteria.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse min-w-[800px]">
                <thead className="bg-slate-900/80 text-slate-400 font-extrabold uppercase tracking-wider border-b border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="p-3 text-[10px]">Client / Username</th>
                    <th className="p-3 text-[10px]">Registered Email</th>
                    <th className="p-3 text-[10px]">Role</th>
                    <th className="p-3 text-[10px]">Active Plan Tier</th>
                    <th className="p-3 text-[10px]">Expires Date</th>
                    <th className="p-3 text-[10px]">Update Plan Limit</th>
                    <th className="p-3 text-[10px]">Payment Verification</th>
                    <th className="p-3 text-[10px]">Adult Access (18+)</th>
                    <th className="p-3 text-[10px] text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 font-medium">
                  {filteredUsers.map((u, idx) => (
                    <tr
                      key={u.id ? `user-${u.id}-${idx}` : `user-idx-${idx}`}
                      className="hover:bg-slate-900/50 transition-colors"
                    >
                      <td className="p-3 font-bold text-slate-100 flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${u.isApprovedByAdmin ? "bg-emerald-400" : "bg-rose-400"}`} />
                        {u.username}
                      </td>
                      <td className="p-3 text-slate-400 font-mono text-[11px]">
                        {u.email || "—"}
                      </td>
                      <td className="p-3 uppercase text-[9px] font-extrabold tracking-wider">
                        <span
                          className={`px-1.5 py-0.5 rounded ${u.role === "admin" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-slate-800 text-slate-400"}`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3">
                        {u.subscriptionPlan !== "Free" && u.isApprovedByAdmin === false ? (
                          <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded font-bold text-amber-400 font-mono text-[11px] flex items-center gap-1 w-max">
                            <Clock size={10} className="animate-pulse" /> Pending
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded font-bold text-amber-300 font-mono text-[11px]">
                            {u.subscriptionPlan}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400 font-mono text-[11px]">
                        {u.subscriptionExpiresAt
                          ? new Date(
                              u.subscriptionExpiresAt,
                            ).toLocaleDateString()
                          : "Unlimited / Lifetime"}
                      </td>
                      <td className="p-3">
                        <select
                          value={u.subscriptionPlan}
                          onChange={(e) =>
                            handleUserSubChange(
                              u.id,
                              e.target.value as SubscriptionPlan,
                            )
                          }
                          className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-bold cursor-pointer focus:border-amber-400 focus:outline-none"
                        >
                          <option value="Free">Free Account</option>
                          <option value="1 Day Pass (৳10)">
                            1 Day Pass (৳10)
                          </option>
                          <option value="1 Month Standard (৳45)">
                            1 Month Standard - 200 Ch (৳45)
                          </option>
                          <option value="1 Month Premium (৳100)">
                            1 Month VIP Premium - 300+ Ch (৳100)
                          </option>
                          <option value="365 Days">365 Days Unlimited</option>
                          <option value="Expired">Expired</option>
                        </select>
                      </td>
                      <td className="p-3">
                        {u.isApprovedByAdmin ? (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold uppercase flex items-center gap-1 w-max">
                            <CheckCircle2 size={11} /> Approved
                          </span>
                        ) : (
                          <button
                            onClick={() => setActiveTab("payments")}
                            className="px-2.5 py-1 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm hover:scale-105"
                            title="Go to Payments tab to verify & approve transaction ID"
                          >
                            <Clock size={11} className="text-amber-400 animate-pulse" /> Verify Payment
                          </button>
                        )}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() =>
                            handleUserAdultAccessChange(u.id, !u.hasAdultAccess)
                          }
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                            u.hasAdultAccess
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30"
                              : "bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800"
                          }`}
                          title="Click to toggle adult content permission"
                        >
                          {u.hasAdultAccess ? "Allowed (On)" : "Restricted (Off)"}
                        </button>
                      </td>
                      <td className="p-3 text-right">
                        {u.role !== "admin" ? (
                          userDeleteConfirmId === u.id ? (
                            <div className="flex items-center justify-end gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                              <button
                                onClick={() => {
                                  handleDeleteUser(u.id);
                                  setUserDeleteConfirmId(null);
                                }}
                                className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white font-black text-[9px] rounded-lg uppercase tracking-wider"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setUserDeleteConfirmId(null)}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-[9px] rounded-lg uppercase tracking-wider"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setUserDeleteConfirmId(u.id)}
                              className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-900 transition-colors"
                              title="Delete Subscriber"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        ) : (
                          <span className="text-[10px] text-slate-600 font-bold px-1">
                            Protected
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Add User Modal */}
          {newUserModalOpen && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">
                    Add Custom Subscriber
                  </h3>
                  <button
                    onClick={() => setNewUserModalOpen(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Create subscription credentials manually to issue access
                  accounts.
                </p>

                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Username / Client ID
                    </label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="e.g. customer55"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Email (Optional)
                    </label>
                    <input
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="e.g. user@domain.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Subscription Plan
                    </label>
                    <select
                      value={newUserPlan}
                      onChange={(e) =>
                        setNewUserPlan(e.target.value as SubscriptionPlan)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="1 Day Pass (৳10)">1 Day Pass (৳10)</option>
                      <option value="1 Month Standard (৳45)">
                        1 Month Standard - 200 Ch (৳45)
                      </option>
                      <option value="1 Month Premium (৳100)">
                        1 Month VIP Premium - 300+ Ch (৳100)
                      </option>
                      <option value="365 Days">365 Days Unlimited</option>
                      <option value="Free">Free Account</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Account Role
                    </label>
                    <select
                      value={newUserRole}
                      onChange={(e) =>
                        setNewUserRole(e.target.value as "user" | "admin")
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="user">Standard Customer</option>
                      <option value="admin">Admin Manager</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setNewUserModalOpen(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-lg uppercase tracking-wider"
                    >
                      Create Account
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
