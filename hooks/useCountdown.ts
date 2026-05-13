'use client'
import { useEffect, useState } from 'react'

interface CountdownResult {
  days: number
  hours: number
  minutes: number
  seconds: number
  total: number
  isUrgent: boolean
  isExpired: boolean
}

export function useCountdown(endTime: string | Date): CountdownResult {
  const getRemaining = () => {
    const end = new Date(endTime).getTime()
    const now = Date.now()
    const total = Math.max(0, end - now)

    return {
      days: Math.floor(total / (1000 * 60 * 60 * 24)),
      hours: Math.floor((total / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((total / 1000 / 60) % 60),
      seconds: Math.floor((total / 1000) % 60),
      total,
      isUrgent: total < 5 * 60 * 1000,
      isExpired: total <= 0,
    }
  }

  const [remaining, setRemaining] = useState(getRemaining)

  useEffect(() => {
    if (remaining.isExpired) {
      return
    }

    const timerId = setInterval(() => setRemaining(getRemaining()), 1000)
    return () => clearInterval(timerId)
  }, [endTime, remaining.isExpired])

  return remaining
}

export function formatCountdown(countdown: CountdownResult): string {
  if (countdown.isExpired) return 'Closed'
  if (countdown.days > 0) {
    return `${countdown.days}d ${String(countdown.hours).padStart(2, '0')}:${String(countdown.minutes).padStart(2, '0')}`
  }

  return `${String(countdown.hours).padStart(2, '0')}:${String(countdown.minutes).padStart(2, '0')}:${String(countdown.seconds).padStart(2, '0')}`
}
