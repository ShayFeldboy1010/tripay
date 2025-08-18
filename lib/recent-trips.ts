const KEY = 'recentTripIds'

export type RecentTrip = { id: string; name?: string; at: number }

export function getRecentTrips(): RecentTrip[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as RecentTrip[]) : []
  } catch {
    return []
  }
}

function saveRecentTrips(list: RecentTrip[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

export function addRecentTrip(t: { id: string; name?: string }) {
  const now = Date.now()
  const list = getRecentTrips().filter((x) => x.id !== t.id)
  list.unshift({ id: t.id, name: t.name, at: now })
  saveRecentTrips(list.slice(0, 5))
}

export function removeRecentTrip(id: string) {
  saveRecentTrips(getRecentTrips().filter((x) => x.id !== id))
}

export function forgetRecentTrips() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
