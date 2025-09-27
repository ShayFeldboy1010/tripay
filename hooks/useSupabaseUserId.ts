import { useEffect, useState } from "react";

const TEST_USER_KEY = "__AI_CHAT_TEST_USER__";

function resolveInjectedUserId() {
  if (typeof window === "undefined") return null;
  const injected = (window as unknown as Record<string, unknown>)[TEST_USER_KEY];
  return typeof injected === "string" ? injected : null;
}

export function useSupabaseUserId() {
  const initialUserId = resolveInjectedUserId();
  const [userId, setUserId] = useState<string | null>(initialUserId);
  const [loading, setLoading] = useState(() => initialUserId === null);

  useEffect(() => {
    if (initialUserId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { supabase } = await import("@/lib/supabase/client");
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        setUserId(data.user?.id ?? null);
      } catch (error) {
        if (!cancelled) {
          console.error("[ai-chat] failed to resolve user", error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialUserId]);

  return { userId, loading };
}
