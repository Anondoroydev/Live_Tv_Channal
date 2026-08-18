import React from 'react';
import { Users, Tv, CreditCard } from 'lucide-react';

const Dashboard = () => {
  const stats = [
    { label: 'Total Users', value: '1,234', icon: Users, color: 'text-blue-500' },
    { label: 'Active Channels', value: '56', icon: Tv, color: 'text-emerald-500' },
    { label: 'Total Revenue', value: '$12,345', icon: CreditCard, color: 'text-rose-500' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Dashboard Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 flex items-center gap-4">
            <div className={`p-4 rounded-xl bg-slate-900 ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-slate-400 text-sm">{stat.label}</p>
              <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
