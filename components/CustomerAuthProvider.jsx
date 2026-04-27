"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { listenToAuth, upsertCustomerProfile } from "../lib/firebaseClient";

const CustomerAuthContext = createContext(null);

export function CustomerAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return listenToAuth(async (nextUser) => {
      setUser(nextUser);
      setLoading(false);
      if (nextUser) await upsertCustomerProfile(nextUser);
    });
  }, []);

  const value = useMemo(() => ({ user, loading, isLoggedIn: Boolean(user) }), [user, loading]);

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) throw new Error("useCustomerAuth must be used inside CustomerAuthProvider");
  return context;
}
