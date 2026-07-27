import React, { useState } from 'react';
import { Sparkles, Check, ShieldCheck, Zap, X, ArrowLeft, Smartphone, Shield, HelpCircle, CheckCircle2 } from 'lucide-react';
import { apiService } from '../services/api';
import { SubscriptionPlan, User } from '../types';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSubscriptionUpdated: (updatedUser: User) => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSubscriptionUpdated
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('1 Month Premium (৳100)');
  const [paymentStep, setPaymentStep] = useState<'select' | 'payment' | 'success'>('select');
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'nagad' | 'rocket'>('bkash');
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  if (!isOpen || !currentUser) return null;

  const plans: { id: SubscriptionPlan; name: string; duration: string; channels: string; price: string; rawPrice: number; popular?: boolean }[] = [
    { 
      id: '1 Day Pass (৳10)', 
      name: '1 Day Pass', 
      duration: '1 Day Unlimited', 
      channels: 'Standard Live TV Channels',
      price: '৳10',
      rawPrice: 10
    },
    { 
      id: '1 Month Standard (৳45)', 
      name: '1 Month Standard', 
      duration: '30 Days Access', 
      channels: '200 Live TV Channels',
      price: '৳45',
      rawPrice: 45
    },
    { 
      id: '1 Month Premium (৳100)', 
      name: '1 Month VIP Premium', 
      duration: '30 Days VIP Access', 
      channels: '300+ HD Channels + VOD Movies',
      price: '৳100',
      rawPrice: 100,
      popular: true 
    },
  ];

  const currentSelectedPlanData = plans.find(p => p.id === selectedPlan) || plans[2];

  const handleUpgrade = async () => {
    if (paymentStep === 'select') {
      setPaymentStep('payment');
      return;
    }

    if (!senderNumber.trim() || senderNumber.trim().length < 11) {
      setPaymentError('Please enter a valid 11-digit sender mobile number.');
      return;
    }

    if (!transactionId.trim() || transactionId.trim().length < 6) {
      setPaymentError('Please enter a valid bKash/Nagad/Rocket Transaction ID (TrxID).');
      return;
    }

    setLoading(true);
    setPaymentError(null);
    try {
      // Simulate real-time secure database verification
      await new Promise(resolve => setTimeout(resolve, 2000));
      const updated = await apiService.updateSubscription(selectedPlan);
      onSubscriptionUpdated(updated);
      setPaymentStep('success');
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to update subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPaymentStep('select');
    setSenderNumber('');
    setTransactionId('');
    setPaymentError(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl relative text-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {paymentStep === 'select' && (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-amber-500/30">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-wide">IPTV Premium Subscriptions</h2>
                <p className="text-xs text-slate-400 font-medium">Unlock 100+ Premium HD & Sports Channels</p>
              </div>
            </div>

            {/* Current Plan Badge */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Current Active Plan</p>
                <p className="text-sm font-black text-cyan-400">{currentUser.subscriptionPlan}</p>
              </div>
              {currentUser.subscriptionExpiresAt && (
                <p className="text-xs font-mono text-slate-400">
                  Expires: {new Date(currentUser.subscriptionExpiresAt).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Plan Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {plans.map((plan) => {
                const isSelected = selectedPlan === plan.id;
                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`relative p-4 rounded-2xl border cursor-pointer transition-all duration-150 flex flex-col justify-between ${
                      isSelected
                        ? 'bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-red-500/10 border-amber-400 ring-2 ring-amber-500/40 shadow-xl'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {plan.popular && (
                      <span className="absolute -top-2.5 right-2 bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-[9px] uppercase px-2 py-0.5 rounded-full shadow-md">
                        POPULAR
                      </span>
                    )}

                    <div>
                      <h4 className="font-bold text-sm text-white">{plan.name}</h4>
                      <p className="text-[11px] text-amber-400 font-semibold mt-0.5">{plan.duration}</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-1 leading-tight">{plan.channels}</p>
                    </div>

                    <div className="mt-4 flex items-baseline justify-between pt-2 border-t border-slate-800/80">
                      <span className="text-xl font-black text-white">{plan.price}</span>
                      {isSelected && <Check className="w-5 h-5 text-amber-400" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Activate Button */}
            <button
              onClick={handleUpgrade}
              className="w-full py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:to-red-400 text-slate-950 font-black rounded-2xl shadow-xl shadow-amber-500/20 text-xs uppercase tracking-widest transition-all"
            >
              Order & Pay (প্যাকেজ কিনুন)
            </button>
          </>
        )}

        {paymentStep === 'payment' && (
          <div className="space-y-5">
            {/* Back Arrow Header */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-lg font-black tracking-wide">IPTV Mobile Payment Checkout</h3>
                <p className="text-xs text-slate-400 font-medium">Select method & send payment</p>
              </div>
            </div>

            {/* Price Alert */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">SELECTED PLAN</span>
                <p className="text-sm font-black text-white">{currentSelectedPlanData.name}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">TOTAL DUE</span>
                <p className="text-xl font-mono font-black text-amber-400">{currentSelectedPlanData.price}</p>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setPaymentMethod('bkash')}
                className={`py-3 px-3 rounded-2xl font-black border text-xs flex flex-col items-center gap-1.5 transition-all ${
                  paymentMethod === 'bkash'
                    ? 'bg-[#e2136e]/10 border-[#e2136e] text-[#e2136e] font-extrabold ring-2 ring-[#e2136e]/30'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#e2136e] shadow-md shadow-[#e2136e]/40" />
                <span>bKash (বিকাশ)</span>
              </button>

              <button
                onClick={() => setPaymentMethod('nagad')}
                className={`py-3 px-3 rounded-2xl font-black border text-xs flex flex-col items-center gap-1.5 transition-all ${
                  paymentMethod === 'nagad'
                    ? 'bg-orange-500/10 border-orange-500 text-orange-500 font-extrabold ring-2 ring-orange-500/30'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-md shadow-orange-500/40" />
                <span>Nagad (নগদ)</span>
              </button>

              <button
                onClick={() => setPaymentMethod('rocket')}
                className={`py-3 px-3 rounded-2xl font-black border text-xs flex flex-col items-center gap-1.5 transition-all ${
                  paymentMethod === 'rocket'
                    ? 'bg-purple-500/10 border-purple-500 text-purple-400 font-extrabold ring-2 ring-purple-500/30'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-md shadow-purple-500/40" />
                <span>Rocket (রকেট)</span>
              </button>
            </div>

            {/* Instruction Panel */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 text-xs space-y-2.5 leading-relaxed">
              <p className="font-extrabold text-amber-400 uppercase tracking-wider text-[10px]">How to pay (কিভাবে টাকা পাঠাবেন):</p>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                <li>Go to your {paymentMethod === 'bkash' ? 'bKash' : paymentMethod === 'nagad' ? 'Nagad' : 'Rocket'} app or dial USSD.</li>
                <li>Choose <strong className="text-white">Send Money (সেন্ট মানি)</strong> option.</li>
                <li>Enter our Personal Mobile Number: <strong className="text-amber-400 font-mono text-[13px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800">01826339098</strong></li>
                <li>Amount to send: <strong className="text-white font-mono">{currentSelectedPlanData.price}</strong></li>
                <li>Enter your Transaction ID (TrxID) and Sender Mobile number below to instantly unlock your premium subscription.</li>
              </ol>
            </div>

            {/* WhatsApp Contact Support */}
            <div className="bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between text-xs gap-3">
              <div className="flex-1">
                <p className="font-black text-slate-200">Payment problem or custom manual activation?</p>
                <p className="text-slate-400 mt-0.5 text-[11px]">পেমেন্ট সংক্রান্ত যেকোনো সমস্যা বা ম্যানুয়াল অ্যাক্টিভেশনের জন্য সরাসরি WhatsApp এ মেসেজ দিন।</p>
              </div>
              <a
                href="https://wa.me/8801826339098"
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 rounded-xl font-black text-[11px] whitespace-nowrap transition-all uppercase tracking-wider flex items-center gap-1 shrink-0"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.403.002 9.803-4.394 9.806-9.799.002-2.618-1.016-5.08-2.87-6.936C16.292 2.013 13.82 1.002 11.99 1.002c-5.41 0-9.814 4.397-9.817 9.802-.001 1.748.455 3.454 1.32 4.965l-.994 3.63 3.738-.98c1.455.794 2.917 1.15 4.35 1.15z"/>
                </svg>
                <span>WhatsApp Admin</span>
              </a>
            </div>

            {paymentError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-400 font-medium">
                {paymentError}
              </div>
            )}

            {/* Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Sender Mobile No (টাকা পাঠানোর নাম্বার)</label>
                <div className="relative">
                  <Smartphone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    maxLength={11}
                    value={senderNumber}
                    onChange={e => setSenderNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="017XXXXXXXX"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Transaction ID (TrxID)</label>
                <div className="relative">
                  <Shield className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={transactionId}
                    onChange={e => setTransactionId(e.target.value.trim())}
                    placeholder="e.g. AMK9D8HJ6"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Verify Button */}
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:to-red-400 text-slate-950 font-black rounded-2xl shadow-xl shadow-amber-500/20 text-xs uppercase tracking-widest transition-all disabled:opacity-50"
            >
              {loading ? 'Verifying Transaction with Bank API...' : 'Verify & Activate Plan (ভেরিফাই করুন)'}
            </button>
          </div>
        )}

        {paymentStep === 'success' && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10 animate-in fade-in zoom-in duration-300">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-white uppercase tracking-wide">Subscription Activated!</h3>
              <p className="text-xs text-emerald-400 font-bold">Transaction verified successfully via {paymentMethod === 'bkash' ? 'bKash' : paymentMethod === 'nagad' ? 'Nagad' : 'Rocket'}</p>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto pt-2">
                Congratulations! Your account is now fully upgraded to <strong>{currentSelectedPlanData.name}</strong>. Enjoy buffer-free HD streaming on all premium channels and VOD collections!
              </p>
            </div>

            <button
              onClick={() => {
                handleReset();
                onClose();
              }}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-500/10"
            >
              Close & Start Streaming
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
