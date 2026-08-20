import React, { useState, useRef, useEffect } from 'react';
import { Plus, Upload, Trash2, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { db } from '../../firebase';
import { collection, getDocs, deleteDoc, doc, query, orderBy, setDoc } from 'firebase/firestore';
import { apiService } from '../../services/api';

const PlaylistManager = () => {
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [playlists, setPlaylists] = useState<{ id: string; url: string; createdAt: string; count?: number }[]>([]);
  const [fetching, setFetching] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPlaylists = async () => {
    setFetching(true);
    try {
      if (db) {
        const q = query(collection(db, 'playlists'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as { id: string; url: string; createdAt: string; count?: number }[];
        setPlaylists(data);
      }
    } catch (error) {
      console.error('Error fetching playlists:', error);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const handleAdd = async (source: string) => {
    const cleanSource = (source || '').trim();
    if (!cleanSource) return;
    setLoading(true);
    setStatusMsg(null);

    try {
      let resultMessage = '';
      let parsedCount = 0;

      const isUrl = cleanSource.startsWith('http://') || cleanSource.startsWith('https://');

      if (isUrl) {
        const res = await apiService.importM3uUrl(cleanSource, true);
        resultMessage = res.message;
        parsedCount = res.totalChannels;
      } else {
        const res = await apiService.uploadM3U(cleanSource, true);
        resultMessage = res.message;
        parsedCount = res.totalChannels;
      }

      if (db) {
        // Save playlist record in Firestore
        const newPlaylistId = 'pl_' + Date.now();
        await setDoc(doc(db, 'playlists', newPlaylistId), {
          url: isUrl ? cleanSource : (cleanSource.substring(0, 80) + ' (M3U File Content)'),
          fullContent: isUrl ? '' : cleanSource.substring(0, 10000),
          count: parsedCount,
          createdAt: new Date().toISOString(),
        });
      }

      setStatusMsg({
        type: 'success',
        text: resultMessage || `Playlist saved and synced with ${parsedCount} channels across all devices!`,
      });

      setPlaylistUrl('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchPlaylists();
    } catch (error: any) {
      console.error('Error adding playlist:', error);
      setStatusMsg({
        type: 'error',
        text: error?.message || 'Failed to parse and save playlist.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (db) {
        await deleteDoc(doc(db, 'playlists', id));
      }
      fetchPlaylists();
    } catch (error) {
      console.error('Error deleting playlist:', error);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        handleAdd(content);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-700 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Playlist Manager</h3>
            <p className="text-xs text-slate-400 mt-1">
              Add M3U URLs or upload playlist files. Channels will automatically sync to all connected devices.
            </p>
          </div>
          <button
            onClick={fetchPlaylists}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-700 transition"
            title="Refresh playlists"
          >
            <RefreshCw size={18} className={fetching ? "animate-spin" : ""} />
          </button>
        </div>

        {statusMsg && (
          <div
            className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border border-red-500/30 text-red-300'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={playlistUrl}
            onChange={(e) => setPlaylistUrl(e.target.value)}
            placeholder="Enter M3U / M3U8 Playlist URL (http://... or https://...)"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={() => handleAdd(playlistUrl)}
            disabled={loading || !playlistUrl.trim()}
            className="bg-amber-500 text-slate-900 px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-amber-400 transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
            Add & Sync Playlist
          </button>
        </div>

        <div className="border-t border-slate-700 pt-5">
          <p className="text-slate-400 mb-3 text-sm">Or upload an M3U playlist file directly:</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="bg-slate-700 text-white px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-slate-600 transition disabled:opacity-50"
          >
            <Upload size={18} /> Upload M3U File
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".m3u,.m3u8,.txt"
            className="hidden"
          />
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="p-4 bg-slate-900/60 border-b border-slate-700 flex justify-between items-center">
          <span className="font-bold text-sm text-slate-300">Saved Playlists in Cloud</span>
          <span className="text-xs text-slate-400">{playlists.length} active playlists</span>
        </div>
        <table className="w-full text-left text-slate-300 text-sm">
          <thead className="bg-slate-900/30 text-slate-400 text-xs">
            <tr>
              <th className="p-4">Playlist Source</th>
              <th className="p-4">Channels</th>
              <th className="p-4">Synced Date</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {fetching ? (
              <tr><td colSpan={4} className="p-8 text-center text-slate-500">Loading playlists...</td></tr>
            ) : playlists.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-slate-500">No playlists added yet. Add a playlist above.</td></tr>
            ) : (
              playlists.map((pl) => (
                <tr key={pl.id} className="border-t border-slate-700 hover:bg-slate-700/30 transition">
                  <td className="p-4 text-white truncate max-w-xs">{pl.url}</td>
                  <td className="p-4 text-amber-400 font-semibold">{pl.count ? `${pl.count} chs` : 'Imported'}</td>
                  <td className="p-4 text-xs text-slate-400">{pl.createdAt ? new Date(pl.createdAt).toLocaleString() : 'Recently'}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDelete(pl.id)}
                      className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition"
                      title="Delete playlist"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PlaylistManager;
