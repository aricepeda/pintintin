import { useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "./supabase";

export type CurrentUser = {
  username: string;
  email: string | null;
  avatarUri?: string;
  level: number;
  balance: number;
  isGuest: boolean;
};

const GUEST_FALLBACK: CurrentUser = {
  username: "Invitado",
  email: null,
  level: 1,
  balance: 1000,
  isGuest: true,
};

export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<CurrentUser>(GUEST_FALLBACK);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supa = getSupabase();
    if (!supa) return;

    let cancelled = false;
    supa.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
      setUser({
        username:
          (meta.username as string) ||
          (meta.full_name as string) ||
          data.user.email?.split("@")[0] ||
          "Jugador",
        email: data.user.email ?? null,
        avatarUri: meta.avatar_url as string | undefined,
        level: (meta.level as number) ?? 1,
        balance: (meta.balance as number) ?? 1000,
        isGuest: false,
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return user;
}
