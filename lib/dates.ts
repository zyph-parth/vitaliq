// lib/dates.ts — Timezone-aware day boundary helper
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

export function getSafeTimeZone(tz: string = 'UTC'): string {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return tz
  } catch {
    return 'UTC'
  }
}

/**
 * Returns UTC-anchored midnight boundaries for "today" in the given IANA timezone.
 * Falls back to UTC when tz is invalid or omitted.
 *
 * @example
 *   const { today, tomorrow } = getDayBounds('Asia/Kolkata')
 */
export function getDayBounds(
  tz: string = 'UTC',
  referenceDate: Date = new Date()
): { today: Date; tomorrow: Date } {
  const safeTz = getSafeTimeZone(tz)

  const zoned = toZonedTime(referenceDate, safeTz)
  zoned.setHours(0, 0, 0, 0)
  const today = fromZonedTime(zoned, safeTz)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return { today, tomorrow }
}
