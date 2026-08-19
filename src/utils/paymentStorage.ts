import { User, SubscriptionPlan } from "../types";
import { db } from "../firebase";

export interface PaymentRecord {
  id: string;
  userId: string;
  userName: string;
  amount: string;
  plan: string;
  transactionId: string;
  senderNumber: string;
  paymentMethod: string;
  status: "Pending" | "Success" | "Rejected";
  createdAt: string;
}

const STORAGE_KEY = "myiptv_payments";

export function getStoredPaymentsDirect(): PaymentRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

export async function savePaymentRecordDirect(payment: PaymentRecord): Promise<void> {
  try {
    const current = getStoredPaymentsDirect();
    const existingIdx = current.findIndex(
      (p) => p.id === payment.id || (payment.transactionId && p.transactionId === payment.transactionId),
    );
    if (existingIdx >= 0) {
      current[existingIdx] = payment;
    } else {
      current.unshift(payment);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (e) {}

  try {
    if (db) {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "payments", payment.id), payment);
    }
  } catch (e) {
    console.warn("Firestore payment save skipped/error:", e);
  }
}

export async function approvePaymentDirect(
  paymentId: string,
  userId?: string,
  plan?: string,
): Promise<void> {
  const current = getStoredPaymentsDirect();
  const payment = current.find((p) => p.id === paymentId || p.userId === userId);
  if (payment) {
    payment.status = "Success";
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  }

  // Update user subscription
  const targetUserId = userId || payment?.userId;
  if (targetUserId) {
    try {
      const usersStr = localStorage.getItem("myiptv_local_users");
      if (usersStr) {
        const users: User[] = JSON.parse(usersStr);
        const uIdx = users.findIndex((u) => u.id === targetUserId || u.email === payment?.userName || u.username === payment?.userName);
        if (uIdx >= 0) {
          const targetPlan = (plan || payment?.plan || users[uIdx].subscriptionPlan || "1 Month Premium (৳100)") as SubscriptionPlan;
          let days = 30;
          if (targetPlan.includes("365") || targetPlan.includes("1 Year")) days = 365;
          else if (targetPlan.includes("7 Days") || targetPlan.includes("10")) days = 7;

          users[uIdx].subscriptionPlan = targetPlan;
          users[uIdx].isApprovedByAdmin = true;
          users[uIdx].subscriptionStatus = "active";
          users[uIdx].subscriptionExpiresAt = new Date(
            Date.now() + days * 24 * 60 * 60 * 1000,
          ).toISOString();

          localStorage.setItem("myiptv_local_users", JSON.stringify(users));

          const currentSessionUser = localStorage.getItem("myiptv_user_data");
          if (currentSessionUser) {
            const curUser = JSON.parse(currentSessionUser);
            if (curUser.id === users[uIdx].id) {
              localStorage.setItem("myiptv_user_data", JSON.stringify(users[uIdx]));
            }
          }
        }
      }
    } catch (e) {}

    try {
      if (db) {
        const { doc, updateDoc, setDoc } = await import("firebase/firestore");
        if (payment) {
          await setDoc(doc(db, "payments", payment.id), { status: "Success" }, { merge: true });
        }
        await updateDoc(doc(db, "users", targetUserId), {
          isApprovedByAdmin: true,
          subscriptionStatus: "active",
          subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    } catch (e) {}
  }
}

export async function rejectPaymentDirect(paymentId: string, userId?: string): Promise<void> {
  const current = getStoredPaymentsDirect();
  const payment = current.find((p) => p.id === paymentId || p.userId === userId);
  if (payment) {
    payment.status = "Rejected";
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  }

  try {
    if (db && payment) {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "payments", payment.id), { status: "Rejected" }, { merge: true });
    }
  } catch (e) {}
}

export async function deletePaymentDirect(paymentId: string): Promise<void> {
  const current = getStoredPaymentsDirect();
  const updated = current.filter((p) => p.id !== paymentId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  try {
    if (db) {
      const { doc, deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, "payments", paymentId));
    }
  } catch (e) {}
}
