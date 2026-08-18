import React from 'react';
import { CheckCircle, Clock, XCircle } from 'lucide-react';

const OrderTable = () => {
  const orders = [
    { id: 'ORD-001', user: 'Ajoy Sarker', amount: '$49.99', status: 'Completed' },
    { id: 'ORD-002', user: 'John Doe', amount: '$29.99', status: 'Pending' },
    { id: 'ORD-003', user: 'Jane Smith', amount: '$19.99', status: 'Cancelled' },
  ];

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
      <table className="w-full text-left text-slate-300">
        <thead className="bg-slate-900/50 text-slate-400 text-sm">
          <tr>
            <th className="p-4">Order ID</th>
            <th className="p-4">User</th>
            <th className="p-4">Amount</th>
            <th className="p-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-t border-slate-700 hover:bg-slate-700/30">
              <td className="p-4 text-white font-medium">{order.id}</td>
              <td className="p-4">{order.user}</td>
              <td className="p-4">{order.amount}</td>
              <td className="p-4">
                <span className={`flex items-center gap-1 text-xs font-semibold ${
                  order.status === 'Completed' ? 'text-emerald-400' : 
                  order.status === 'Pending' ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {order.status === 'Completed' && <CheckCircle size={14} />}
                  {order.status === 'Pending' && <Clock size={14} />}
                  {order.status === 'Cancelled' && <XCircle size={14} />}
                  {order.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default OrderTable;
