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
  signInWithRedirect,
  signOut,
  updateProfile
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore";
import { FIREBASE_PROJECT_ID } from "./firebaseProject";
import { readCustomerLocalOrders } from "./orders";

function resolveClientProjectId() {
  const configuredProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || FIREBASE_PROJECT_ID;
  if (configuredProjectId !== FIREBASE_PROJECT_ID) {
    throw new Error(
      `Firebase frontend project mismatch. Expected "${FIREBASE_PROJECT_ID}" but got "${configuredProjectId}".`
    );
  }
  return configuredProjectId;
}

const projectId = resolveClientProjectId();
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

function logFirestoreWarning(action, error) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[Firebase] ${action} skipped:`, error?.message || error);
  }
}

async function getDocSafely(reference) {
  try {
    return await getDoc(reference);
  } catch (error) {
    logFirestoreWarning("document read", error);
    return null;
  }
}

export function readLocalCustomerProfile(uid) {
  return null;
}

function writeLocalCustomerProfile(uid, profile) {
  // Customer profile PII is intentionally not persisted in browser storage.
  // Firestore remains the source of truth.
}

function getProfileUpdatedTime(profile) {
  if (!profile?.updatedAt) return 0;
  if (typeof profile.updatedAt?.toMillis === "function") return profile.updatedAt.toMillis();
  const parsed = Date.parse(profile.updatedAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function pickNewestProfile(localProfile, cloudProfile) {
  if (!localProfile) return cloudProfile || null;
  if (!cloudProfile) return localProfile;
  return getProfileUpdatedTime(localProfile) >= getProfileUpdatedTime(cloudProfile) ? localProfile : cloudProfile;
}

export function listenToAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    if (error?.code === "auth/popup-blocked") {
      return signInWithRedirect(auth, provider);
    }
    throw error;
  }
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
    updateProfile(user, { displayName: patch.name }).catch((error) => {
      logFirestoreWarning("auth profile update", error);
    });
  }
  const profileRef = doc(db, "customers", user.uid);
  const existing = readLocalCustomerProfile(user.uid) || {};
  const localProfile = {
    uid: user.uid,
    name: patch.name ?? user.displayName ?? existing.name ?? "",
    email: user.email ?? existing.email ?? "",
    isAnonymous: user.isAnonymous,
    gender: patch.gender ?? existing.gender ?? "",
    phone: patch.phone ?? existing.phone ?? "",
    address: patch.address ?? existing.address ?? "",
    addresses: patch.addresses ?? existing.addresses ?? [],
    paymentNote: patch.paymentNote ?? existing.paymentNote ?? "",
    updatedAt: new Date().toISOString(),
    createdAt: existing.createdAt ?? new Date().toISOString()
  };

  writeLocalCustomerProfile(user.uid, localProfile);

  try {
    const cloudSnapshot = await getDocSafely(profileRef);
    const cloudData = cloudSnapshot?.exists() ? cloudSnapshot.data() : {};
    await setDoc(
      profileRef,
      {
        uid: user.uid,
        name: localProfile.name || cloudData.name || "",
        email: localProfile.email || cloudData.email || "",
        isAnonymous: user.isAnonymous,
        gender: localProfile.gender || cloudData.gender || "",
        phone: localProfile.phone || cloudData.phone || "",
        address: localProfile.address || cloudData.address || "",
        addresses: localProfile.addresses?.length ? localProfile.addresses : cloudData.addresses ?? [],
        paymentNote: localProfile.paymentNote || cloudData.paymentNote || "",
        updatedAt: serverTimestamp(),
        createdAt: cloudSnapshot?.exists() ? cloudData.createdAt : serverTimestamp()
      },
      { merge: true }
    );
  } catch (error) {
    logFirestoreWarning("profile cloud sync", error);
  }

  return localProfile;
}

export function listenCustomerProfile(uid, callback) {
  const localProfile = readLocalCustomerProfile(uid);
  if (localProfile) callback(localProfile);

  return onSnapshot(
    doc(db, "customers", uid),
    (snapshot) => {
      const latestLocalProfile = readLocalCustomerProfile(uid);
      const cloudProfile = snapshot.exists() ? snapshot.data() : null;
      const profile = pickNewestProfile(latestLocalProfile, cloudProfile);
      if (profile) writeLocalCustomerProfile(uid, profile);
      callback(profile);
    },
    (error) => {
      logFirestoreWarning("profile listener", error);
      callback(readLocalCustomerProfile(uid));
    }
  );
}

export async function saveCustomerOrder(order, user) {
  if (!user) return;
  await upsertCustomerProfile(user);
  const paymentScreenshot = order.paymentScreenshot
    ? {
        name: order.paymentScreenshot.name || "",
        type: order.paymentScreenshot.type || ""
      }
    : null;
  await setDoc(
    doc(db, "orders", order.id),
    {
      ...order,
      paymentScreenshot,
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

function mergeOrders(localOrders, cloudOrders) {
  const orderMap = new Map();
  localOrders.forEach((order) => orderMap.set(order.id, order));
  cloudOrders.forEach((order) => orderMap.set(order.id, { ...orderMap.get(order.id), ...order }));
  return Array.from(orderMap.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export function listenCustomerOrders(uid, callback, email = "") {
  const localFallback = () => readCustomerLocalOrders(uid, email);

  return onSnapshot(
    query(collection(db, "orders"), where("userId", "==", uid)),
    (snapshot) => {
      const cloudOrders = snapshot.docs
          .map((orderDoc) => ({ id: orderDoc.id, ...orderDoc.data() }));
      callback(mergeOrders(localFallback(), cloudOrders));
    },
    (error) => {
      logFirestoreWarning("customer orders listener", error);
      callback(localFallback());
    }
  );
}
