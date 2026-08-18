import React from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';

const OfferBoard = () => {
  const offers = [
    { id: 1, title: 'Summer Sale', discount: '20%', status: 'Active' },
    { id: 2, title: 'Winter Blast', discount: '50%', status: 'Expired' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Offer Board</h2>
        <button className="bg-amber-500 text-slate-900 px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-amber-400">
          <Plus size={18} /> Add Offer
        </button>
      </div>
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <table className="w-full text-left text-slate-300">
          <thead className="bg-slate-900/50 text-slate-400 text-sm">
            <tr>
              <th className="p-4">Title</th>
              <th className="p-4">Discount</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((offer) => (
              <tr key={offer.id} className="border-t border-slate-700 hover:bg-slate-700/30">
                <td className="p-4 text-white font-medium">{offer.title}</td>
                <td className="p-4">{offer.discount}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${offer.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {offer.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button className="text-slate-400 hover:text-white p-1"><Edit2 size={16} /></button>
                  <button className="text-slate-400 hover:text-red-400 p-1 ml-2"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OfferBoard;
