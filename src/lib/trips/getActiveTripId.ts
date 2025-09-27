export function getActiveTripId(): string | null {
  if (typeof window === "undefined") return null;
  const match = window.location.pathname.match(/\/trip\/([^/]+)/);
  return match ? match[1] : null;
}
