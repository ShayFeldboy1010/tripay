import { useAuth } from "@/components/auth-provider";

export function useSupabaseUserId() {
  const { user, loading } = useAuth();
  return { userId: user?.id ?? null, loading };
}
