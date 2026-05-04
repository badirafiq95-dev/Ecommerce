"use client";

import { initializeApp, getApps } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export function listenToAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function loginWithGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export function loginAnonymously() {
  return signInAnonymously(auth);
}

export function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function createEmailAccount(email, password, name) {
  return createUserWithEmailAndPassword(auth, email, password).then(async (credential) => {
    if (name) await updateProfile(credential.user, { displayName: name });
    return credential;
  });
}

export function logoutCustomer() {
  return signOut(auth);
}

export async function upsertCustomerProfile(user, patch = {}) {
  if (!user) return;
  if (patch.name && user.displayName !== patch.name) {
    await updateProfile(user, { displayName: patch.name });
  }
  const profileRef = doc(db, "customers", user.uid);
  const existing = await getDoc(profileRef);
  await setDoc(
    profileRef,
    {
      uid: user.uid,
      name: patch.name ?? user.displayName ?? existing.data()?.name ?? "",
      email: user.email ?? existing.data()?.email ?? "",
      isAnonymous: user.isAnonymous,
      gender: patch.gender ?? existing.data()?.gender ?? "",
      phone: patch.phone ?? existing.data()?.phone ?? "",
      address: patch.address ?? existing.data()?.address ?? "",
      addresses: patch.addresses ?? existing.data()?.addresses ?? [],
      paymentNote: patch.paymentNote ?? existing.data()?.paymentNote ?? "",
      updatedAt: serverTimestamp(),
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp()
    },
    { merge: true }
  );
}

export function listenCustomerProfile(uid, callback) {
  return onSnapshot(doc(db, "customers", uid), (snapshot) => callback(snapshot.exists() ? snapshot.data() : null));
}

export async function saveCustomerOrder(order, user) {
  if (!user) return;
  await upsertCustomerProfile(user);
  await setDoc(
    doc(db, "orders", order.id),
    {
      ...order,
      userId: user.uid,
      userEmail: user.email || order.email,
      customerName: order.customerName || user.displayName || "Guest customer",
      status: order.status || "Payment review",
      createdAt: order.createdAt || new Date().toISOString(),
      syncedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export function listenCustomerOrders(uid, callback) {
  return onSnapshot(query(collection(db, "orders"), where("userId", "==", uid)), (snapshot) => {
    callback(
      snapshot.docs
        .map((orderDoc) => ({ id: orderDoc.id, ...orderDoc.data() }))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    );
  });
}

export function listenAllOrders(callback) {
  return onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snapshot) => {
    callback(snapshot.docs.map((orderDoc) => ({ id: orderDoc.id, ...orderDoc.data() })));
  });
}

export function updateFirestoreOrder(orderId, patch) {
  return updateDoc(doc(db, "orders", orderId), {
    ...patch,
    updatedAt: new Date().toISOString(),
    syncedAt: serverTimestamp()
  });
}
