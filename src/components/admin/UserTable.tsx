import React, { useState, useEffect } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { db } from '../../firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const UserTable = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'users', id));
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
      <table className="w-full text-left text-slate-300">
        <thead className="bg-slate-900/50 text-slate-400 text-sm">
          <tr>
            <th className="p-4">Name</th>
            <th className="p-4">Email</th>
            <th className="p-4">Role</th>
            <th className="p-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={4} className="p-8 text-center"><Loader2 className="animate-spin inline" /></td></tr>
          ) : users.length === 0 ? (
            <tr><td colSpan={4} className="p-8 text-center">No users found.</td></tr>
          ) : (
            users.map((user) => (
              <tr key={user.id} className="border-t border-slate-700 hover:bg-slate-700/30">
                <td className="p-4 text-white font-medium">{user.name || 'N/A'}</td>
                <td className="p-4">{user.email || 'N/A'}</td>
                <td className="p-4">{user.role || 'User'}</td>
                <td className="p-4 text-right">
                  <button onClick={() => handleDelete(user.id)} className="text-slate-400 hover:text-red-400">
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
export default UserTable;
