import React, { useState } from 'react';
import { LayoutDashboard, Users, Tv, Film, Settings, CreditCard, ShoppingBag, BarChart3, ListVideo } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'channels', label: 'Channels', icon: Tv },
    { id: 'movies', label: 'Movies', icon: Film },
    { id: 'series', label: 'Series', icon: ListVideo },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'offers', label: 'Offers', icon: ShoppingBag },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="w-64 bg-slate-900 h-screen p-4 flex flex-col gap-2 overflow-y-auto">
      <h1 className="text-xl font-bold text-white mb-6 p-2">Admin Panel</h1>
      {menuItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={`flex items-center gap-3 p-3 rounded-xl transition ${activeTab === item.id ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:bg-slate-800'}`}
        >
          <item.icon size={20} />
          {item.label}
        </button>
      ))}
    </div>
  );
};

export default Sidebar;
