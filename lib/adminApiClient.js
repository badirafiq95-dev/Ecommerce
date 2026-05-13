"use client";

import { auth, getAppCheckHeaders } from "./firebaseClient";

export async function getAdminToken() {
  const token = await auth.currentUser?.getIdToken(true);
  if (!token) throw new Error("Admin login required");
  return token;
}

export async function adminFetchJson(path, options = {}) {
  const token = await getAdminToken();
  const appCheckHeaders = await getAppCheckHeaders();
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...appCheckHeaders,
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Admin request failed");
  }
  return data;
}
