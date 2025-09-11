import { useEffect, useRef, useState } from "react"

interface Options {
  delayMs?: number
  minVisibleMs?: number
}

export function useDelayedLoading(
  loading: boolean,
  options: Options = {}
) {
  const { delayMs = 100, minVisibleMs = 300 } = options
  const [show, setShow] = useState(false)
  const delayTimeout = useRef<NodeJS.Timeout | null>(null)
  const hideTimeout = useRef<NodeJS.Timeout | null>(null)
  const visibleAt = useRef<number | null>(null)

  useEffect(() => {
    if (loading) {
      if (hideTimeout.current) {
        clearTimeout(hideTimeout.current)
        hideTimeout.current = null
      }
      if (!delayTimeout.current && !show) {
        delayTimeout.current = setTimeout(() => {
          setShow(true)
          visibleAt.current = Date.now()
          delayTimeout.current = null
        }, delayMs)
      }
    } else {
      if (delayTimeout.current) {
        clearTimeout(delayTimeout.current)
        delayTimeout.current = null
      }
      if (show) {
        const elapsed = Date.now() - (visibleAt.current ?? 0)
        if (elapsed >= minVisibleMs) {
          setShow(false)
          visibleAt.current = null
        } else {
          hideTimeout.current = setTimeout(() => {
            setShow(false)
            visibleAt.current = null
            hideTimeout.current = null
          }, minVisibleMs - elapsed)
        }
      }
    }

    return () => {
      if (delayTimeout.current) {
        clearTimeout(delayTimeout.current)
      }
      if (hideTimeout.current) {
        clearTimeout(hideTimeout.current)
      }
    }
  }, [loading, delayMs, minVisibleMs, show])

  return show
}
