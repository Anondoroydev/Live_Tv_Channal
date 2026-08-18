import React, { useState, useRef, useEffect } from 'react';
import { Plus, Upload, Trash2, Loader2 } from 'lucide-react';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, writeBatch } from 'firebase/firestore';

const PlaylistManager = () => {
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [playlists, setPlaylists] = useState<{ id: string; url: string; createdAt: string }[]>([]);
  const [fetching, setFetching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPlaylists = async () => {
    setFetching(true);
    try {
      const q = query(collection(db, 'playlists'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as { id: string; url: string; createdAt: string }[];
      setPlaylists(data);
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
    if (!source) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      // Delete existing
      const q = query(collection(db, 'playlists'));
      const querySnapshot = await getDocs(q);
      querySnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Add new
      const newPlaylistRef = doc(collection(db, 'playlists'));
      batch.set(newPlaylistRef, {
        url: source.length > 50 ? source.substring(0, 50) + '...' : source,
        fullContent: source,
        createdAt: new Date().toISOString(),
      });
      
      await batch.commit();
      
      setPlaylistUrl('');
      fetchPlaylists();
    } catch (error) {
      console.error('Error adding playlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'playlists', id));
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
      <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 space-y-6">
        <h3 className="text-xl font-bold text-white mb-4">Add New Playlist</h3>
        <div className="flex gap-4">
          <input
            type="text"
            value={playlistUrl}
            onChange={(e) => setPlaylistUrl(e.target.value)}
            placeholder="Enter playlist URL..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={() => handleAdd(playlistUrl)}
            disabled={loading}
            className="bg-amber-500 text-slate-900 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-amber-400 transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
            Add
          </button>
        </div>

        <div className="border-t border-slate-700 pt-6">
          <p className="text-slate-400 mb-3 text-sm">Or upload an M3U file:</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-slate-700 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-slate-600 transition"
          >
            <Upload size={20} /> Upload M3U File
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".m3u,.m3u8"
            className="hidden"
          />
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <table className="w-full text-left text-slate-300">
          <thead className="bg-slate-900/50 text-slate-400 text-sm">
            <tr>
              <th className="p-4">Playlist URL</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {fetching ? (
              <tr><td colSpan={2} className="p-8 text-center text-slate-500">Loading...</td></tr>
            ) : playlists.length === 0 ? (
              <tr><td colSpan={2} className="p-8 text-center text-slate-500">No playlists found.</td></tr>
            ) : (
              playlists.map((pl) => (
                <tr key={pl.id} className="border-t border-slate-700 hover:bg-slate-700/30">
                  <td className="p-4 text-white truncate max-w-xs">{pl.url}</td>
                  <td className="p-4 text-right">
                    <button onClick={() => handleDelete(pl.id)} className="text-slate-400 hover:text-red-400">
                      <Trash2 size={18} />
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
