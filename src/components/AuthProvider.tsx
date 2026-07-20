"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch } from "@/lib/api-client";
import type { AuthUser } from "@/lib/db/types";

interface AuthContextValue {
  me: AuthUser | null | undefined;
  refresh: () => Promise<AuthUser | null>;
  setMe: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [me, setMe] = useState<AuthUser | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const user = await apiFetch<AuthUser>("/api/me");
      setMe(user);
      return user;
    } catch {
      setMe(null);
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [pathname, refresh]);

  const value = useMemo(
    () => ({ me, refresh, setMe }),
    [me, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
