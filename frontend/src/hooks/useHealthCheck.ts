import { useState, useEffect, useCallback } from 'react'

export function useHealthCheck(interval = 10000) {
  const [healthy, setHealthy] = useState<boolean>(false)
  const [checking, setChecking] = useState(true)

  const check = useCallback(async () => {
    try {
      const res = await fetch('/api/../health', { signal: AbortSignal.timeout(3000) })
      setHealthy(res.ok)
    } catch {
      try {
        const res = await fetch('http://localhost:8000/health', { signal: AbortSignal.timeout(3000) })
        setHealthy(res.ok)
      } catch {
        setHealthy(false)
      }
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    check()
    const timer = setInterval(check, interval)
    return () => clearInterval(timer)
  }, [check, interval])

  return { healthy, checking }
}
