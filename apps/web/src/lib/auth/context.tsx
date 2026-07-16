"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { loginApi, logoutApi, registerOrganizationApi } from "@/lib/api/auth";
import {
  clearAccessToken,
  setAccessToken,
  attemptRefresh,
} from "@/lib/api/client";
import { getMe } from "@/lib/api/users";
import type { AuthContextValue, RegisterOrgData, User } from "./types";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isTransitioningGhostMode, setIsTransitioningGhostMode] = useState(false);

  const loadUser = useCallback(async () => {
    try {
      const u = await getMe();
      setUser(u);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function init() {
      try {
        const success = await attemptRefresh();
        if (ignore) return;
        if (success) {
          await loadUser();
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    void init();

    return () => {
      ignore = true;
    };
  }, [loadUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { access_token } = await loginApi({ email, password });
      setAccessToken(access_token);
      await loadUser();
    },
    [loadUser],
  );

  const register = useCallback(
    async (data: RegisterOrgData) => {
      const { access_token } = await registerOrganizationApi(data);
      setAccessToken(access_token);
      await loadUser();
    },
    [loadUser],
  );

  const logout = useCallback(async () => {
    await logoutApi();
    clearAccessToken();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  const enterGhostMode = useCallback(async () => {
    setIsTransitioningGhostMode(true);
    try {
      // Try to refresh existing ghost session first
      let res = await fetch("/api/auth/ghost/refresh", { method: "POST" });
      if (!res.ok) {
        // If no existing ghost session, spawn a new one
        res = await fetch("/api/auth/ghost/spawn", { method: "POST" });
      }

      if (res.ok) {
        const data = (await res.json()) as { access_token: string };
        setAccessToken(data.access_token);
        await loadUser();
      } else {
        throw new Error("Failed to enter ghost mode");
      }
    } finally {
      setIsTransitioningGhostMode(false);
    }
  }, [loadUser]);

  const exitGhostMode = useCallback(async () => {
    setIsTransitioningGhostMode(true);
    try {
      await fetch("/api/auth/ghost/exit", { method: "POST" });
      // Restore normal session
      const res = await fetch("/api/auth/refresh", { method: "POST" });
      if (res.ok) {
        const data = (await res.json()) as { access_token: string };
        setAccessToken(data.access_token);
        await loadUser();
      } else {
        // If normal session refresh fails, just clear it
        clearAccessToken();
        setUser(null);
      }
    } finally {
      setIsTransitioningGhostMode(false);
    }
  }, [loadUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: user !== null,
        isGhostMode: user?.is_anonymous ?? false,
        isTransitioningGhostMode,
        login,
        register,
        logout,
        refreshUser,
        enterGhostMode,
        exitGhostMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
