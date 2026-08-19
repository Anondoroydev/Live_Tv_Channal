import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, Loader2, Trash2, Plus, RefreshCw, XCircle, User, CreditCard, Phone, Calendar, Hash, Tag } from 'lucide-react';
import { db } from '../../firebase';
import { collection, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { apiService } from '../../services/api';

const PaymentTable = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true);
    }
    try {
      let data: any[] = [];
      
      // 1. Fetch directly from Firestore collection first (Reliable source)
      try {
        if (db) {
          const { collection, getDocs } = await import('firebase/firestore');
          const querySnapshot = await getDocs(collection(db, 'payments'));
          data = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
          
          // Filter out deleted
          const deletedSnap = await getDocs(collection(db, 'deleted_payments'));
          const deletedSet = new Set<string>();
          if (!deletedSnap.empty) {
            deletedSnap.docs.forEach(d => deletedSet.add(d.id));
          }
          data = data.filter(item => !deletedSet.has(item.id));
        }
      } catch (error) {
        console.warn('Firestore fetch error in PaymentTable:', error);
      }

      // 2. Fetch from server API to merge/update status
      try {
        const apiData = await apiService.adminFetchPayments();
        if (Array.isArray(apiData)) {
          // Merge API data with Firestore data
          apiData.forEach(apiItem => {
            const existingIndex = data.findIndex(c => c.id === apiItem.id || c.userId === apiItem.userId);
            if (existingIndex !== -1) {
              data[existingIndex] = { ...data[existingIndex], ...apiItem };
            } else {
              data.push(apiItem);
            }
          });
        }
      } catch (err) {
        console.warn('API fetch payments error:', err);
      }

      // 3. Final deduplicate & Sort
      const finalMap = new Map<string, any>();
      data.forEach(item => {
        const key = item.userId || item.id;
        if (key) {
           const existing = finalMap.get(key);
           if (!existing || (item.status === 'Success' && existing.status !== 'Success')) {
             finalMap.set(key, { ...item });
           }
        }
      });
      data = Array.from(finalMap.values());

      data.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      setPayments(data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleAddSample = async () => {
    setLoading(true);
    try {
      const updated = await apiService.adminAddSamplePayments();
      setPayments(updated);
    } catch (e) {
      console.error("Error adding sample payment:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (payment: any) => {
    // Optimistically update UI
    setPayments(prev => prev.map(p => (p.id === payment.id || p.userId === payment.userId) ? { ...p, status: 'Success' } : p));
    try {
      await apiService.adminApprovePayment(payment.id, payment.userId, payment.plan);
      try {
        if (db) {
          const { setDoc, doc } = await import('firebase/firestore');
          if (payment.id) await setDoc(doc(db, 'payments', payment.id), { status: 'Success', userId: payment.userId }, { merge: true });
          if (payment.userId) {
            await setDoc(doc(db, 'payments', payment.userId), { status: 'Success', userId: payment.userId }, { merge: true });
            await setDoc(doc(db, 'payments', `req_${payment.userId}`), { status: 'Success', userId: payment.userId }, { merge: true });
            await setDoc(doc(db, 'users', payment.userId), { paymentStatus: 'Success', isApprovedByAdmin: true }, { merge: true });
          }
        }
      } catch (e) {}
    } catch (error) {
      console.error('Error accepting payment:', error);
    } finally {
      fetchPayments(false);
    }
  };

  const handleReject = async (payment: any) => {
    // Optimistically update UI
    setPayments(prev => prev.map(p => (p.id === payment.id || p.userId === payment.userId) ? { ...p, status: 'Rejected' } : p));
    try {
      await apiService.adminRejectPayment(payment.id, payment.userId);
      try {
        if (db) {
          const { setDoc, doc } = await import('firebase/firestore');
          if (payment.id) await setDoc(doc(db, 'payments', payment.id), { status: 'Rejected', userId: payment.userId }, { merge: true });
          if (payment.userId) {
            await setDoc(doc(db, 'payments', payment.userId), { status: 'Rejected', userId: payment.userId }, { merge: true });
            await setDoc(doc(db, 'payments', `req_${payment.userId}`), { status: 'Rejected', userId: payment.userId }, { merge: true });
            await setDoc(doc(db, 'users', payment.userId), { paymentStatus: 'Rejected', isApprovedByAdmin: false, subscriptionPlan: 'Free', subscriptionStatus: 'inactive' }, { merge: true });
          }
        }
      } catch (e) {}
    } catch (error) {
      console.error('Error rejecting payment:', error);
    } finally {
      fetchPayments(false);
    }
  };

  const handleDelete = async (payment: any) => {
    const targetId = typeof payment === "string" ? payment : payment?.id;
    const targetUserId = typeof payment === "object" ? payment?.userId : null;
    const targetUserName = typeof payment === "object" ? (payment?.userName || payment?.email) : null;
    const targetTrxId = typeof payment === "object" ? payment?.transactionId : null;

    // 1. Immediate optimistic UI remove
    setPayments((prev) =>
      prev.filter(
        (p) =>
          p.id !== targetId &&
          (!targetUserId || p.userId !== targetUserId) &&
          p.id !== `req_${targetUserId}` &&
          (!targetUserName || (p.userName !== targetUserName && p.email !== targetUserName)) &&
          (!targetTrxId || p.transactionId !== targetTrxId)
      )
    );

    try {
      if (targetId) {
        await apiService.adminDeletePayment(targetId, {
          userId: targetUserId || undefined,
          userName: targetUserName || undefined,
          transactionId: targetTrxId || undefined
        });
      }

      try {
        if (db) {
          const { deleteDoc, setDoc, doc } = await import("firebase/firestore");
          const keys = [targetId, targetUserId, targetUserId ? `req_${targetUserId}` : null, targetUserName, targetTrxId].filter(Boolean) as string[];
          for (const key of keys) {
            await setDoc(doc(db, "deleted_payments", key), { isDeleted: true });
            await deleteDoc(doc(db, "payments", key));
          }
        }
      } catch (e) {}
    } catch (error) {
      console.error("Error deleting payment:", error);
    } finally {
      fetchPayments(false);
    }
  };

  return (
    <div className="bg-slate-800/90 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Table Header */}
      <div className="p-4 bg-slate-900/80 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-400" /> bKash / Nagad / Rocket Payment Requests
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            ইউজারের বিকাশ/নগদ পেমেন্ট নম্বর ও ট্রানজেকশন আইডি দেখে **Accept** অথবা **Reject** করুন
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchPayments()}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors shadow-sm active:scale-95"
            title="Refresh payment requests"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Payment Requests Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-slate-300">
          <thead className="bg-slate-950/60 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-700/80">
            <tr>
              <th className="p-3.5"><div className="flex items-center gap-1.5"><User size={13} /> User Details</div></th>
              <th className="p-3.5"><div className="flex items-center gap-1.5"><Tag size={13} /> Package & Price</div></th>
              <th className="p-3.5"><div className="flex items-center gap-1.5"><Phone size={13} /> Sender Mobile & Method</div></th>
              <th className="p-3.5"><div className="flex items-center gap-1.5"><Hash size={13} /> TrxID (Transaction ID)</div></th>
              <th className="p-3.5"><div className="flex items-center gap-1.5"><Calendar size={13} /> Request Time</div></th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-right">Action (Accept / Reject)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60 text-sm">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-12 text-center">
                  <Loader2 className="animate-spin inline text-amber-400 w-8 h-8 mb-2" />
                  <p className="text-xs text-slate-400 font-medium">Loading payment verification data...</p>
                </td>
              </tr>
            ) : payments.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-slate-400">
                  <p className="text-sm font-semibold text-slate-300">No payment requests found.</p>
                  <p className="text-xs text-slate-500 mt-1">Users will appear here as soon as they submit payment details.</p>
                </td>
              </tr>
            ) : (
              payments.map((payment, idx) => (
                <tr key={payment.id ? `pay-${payment.id}-${idx}` : `pay-idx-${idx}`} className="hover:bg-slate-700/30 transition-colors">
                  {/* User Details */}
                  <td className="p-3.5">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span className="w-7 h-7 rounded-full bg-slate-700 text-amber-400 font-black text-xs flex items-center justify-center uppercase border border-slate-600">
                        {(payment.userName || "U")[0]}
                      </span>
                      <div>
                        <div>{payment.userName || 'Unknown User'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">ID: {payment.userId || 'N/A'}</div>
                      </div>
                    </div>
                  </td>

                  {/* Plan & Amount */}
                  <td className="p-3.5">
                    <div className="font-bold text-amber-300 text-sm">{payment.plan || 'Standard Plan'}</div>
                    <div className="text-xs font-semibold text-emerald-400 mt-0.5">{payment.amount || '৳100'}</div>
                  </td>

                  {/* Sender Number & Method */}
                  <td className="p-3.5">
                    <div className="font-mono text-xs font-bold text-white bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-700/80 inline-block">
                      {payment.senderNumber || '01700000000'}
                    </div>
                    <div className="mt-1">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">
                        {payment.paymentMethod || 'bKash'}
                      </span>
                    </div>
                  </td>

                  {/* Transaction ID */}
                  <td className="p-3.5">
                    <div className="font-mono text-xs font-bold text-amber-200 tracking-wider bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 inline-block">
                      {payment.transactionId || payment.id}
                    </div>
                  </td>

                  {/* Date & Time */}
                  <td className="p-3.5 text-xs text-slate-400">
                    {payment.createdAt ? new Date(payment.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Just now'}
                  </td>

                  {/* Status Badge */}
                  <td className="p-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm ${
                      payment.status === 'Success'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : payment.status === 'Rejected'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    }`}>
                      {payment.status === 'Success' && <CheckCircle size={13} className="text-emerald-400" />}
                      {payment.status === 'Rejected' && <XCircle size={13} className="text-rose-400" />}
                      {(!payment.status || payment.status === 'Pending') && <Clock size={13} className="text-amber-400 animate-pulse" />}
                      {payment.status === 'Success' ? 'APPROVED' : payment.status === 'Rejected' ? 'REJECTED' : 'PENDING'}
                    </span>
                  </td>

                  {/* Action Buttons (Accept / Reject / Delete) */}
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {payment.status !== 'Success' && payment.status !== 'Rejected' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAccept(payment)}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-lg shadow-emerald-500/20 rounded-xl text-xs font-bold uppercase transition-all transform hover:scale-105 active:scale-95 flex items-center gap-1 border border-emerald-400/50"
                            title="Accept payment and unlock 30 days subscription"
                          >
                            <CheckCircle size={14} /> Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(payment)}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-lg shadow-rose-600/20 rounded-xl text-xs font-bold uppercase transition-all transform hover:scale-105 active:scale-95 flex items-center gap-1 border border-rose-400/50"
                            title="Reject payment request"
                          >
                            <XCircle size={14} /> Reject
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(payment)}
                        className="p-1.5 bg-slate-700/80 hover:bg-rose-600/80 text-slate-300 hover:text-white rounded-xl transition-colors flex items-center shadow-sm cursor-pointer"
                        title="Delete record"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
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

export default PaymentTable;
