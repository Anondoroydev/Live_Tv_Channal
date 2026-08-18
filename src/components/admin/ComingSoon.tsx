import React from 'react';

const ComingSoon = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-64 bg-slate-800 rounded-2xl border border-slate-700">
    <h3 className="text-xl font-bold text-white">{title}</h3>
    <p className="text-slate-400">Coming soon in a future update.</p>
  </div>
);

export default ComingSoon;
