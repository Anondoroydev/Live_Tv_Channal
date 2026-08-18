import React, { useState, useEffect } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { db } from '../../firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const ChannelTable = () => {
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'channels'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChannels(data);
    } catch (error) {
      console.error('Error fetching channels:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchChannels(); }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'channels', id));
      fetchChannels();
    } catch (error) {
      console.error('Error deleting channel:', error);
    }
  };

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
      <table className="w-full text-left text-slate-300">
        <thead className="bg-slate-900/50 text-slate-400 text-sm">
          <tr>
            <th className="p-4">Channel Name</th>
            <th className="p-4">Category</th>
            <th className="p-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={3} className="p-8 text-center"><Loader2 className="animate-spin inline" /></td></tr>
          ) : channels.length === 0 ? (
            <tr><td colSpan={3} className="p-8 text-center">No channels found.</td></tr>
          ) : (
            channels.map((channel) => (
              <tr key={channel.id} className="border-t border-slate-700 hover:bg-slate-700/30">
                <td className="p-4 text-white font-medium">{channel.name || 'N/A'}</td>
                <td className="p-4">{channel.category || 'N/A'}</td>
                <td className="p-4 text-right">
                  <button onClick={() => handleDelete(channel.id)} className="text-slate-400 hover:text-red-400">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
export default ChannelTable;
