// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { useDelayedLoading } from "@/hooks/useDelayedLoading"

describe("useDelayedLoading", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it("skips short loads", () => {
    const { result, rerender } = renderHook(({ loading }) => useDelayedLoading(loading, { delayMs: 100 }), {
      initialProps: { loading: false }
    })

    act(() => {
      rerender({ loading: true })
      vi.advanceTimersByTime(50)
      rerender({ loading: false })
      vi.advanceTimersByTime(100)
    })

    expect(result.current).toBe(false)
  })

  it("keeps visible for minimum time", () => {
    const { result, rerender } = renderHook(({ loading }) => useDelayedLoading(loading, { delayMs: 100, minVisibleMs: 300 }), {
      initialProps: { loading: true }
    })

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current).toBe(true)

    act(() => {
      rerender({ loading: false })
    })

    expect(result.current).toBe(true)

    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(result.current).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe(false)
  })
})
