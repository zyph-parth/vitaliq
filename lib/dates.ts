// lib/dates.ts — Timezone-aware day boundary helper
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

/**
 * Returns UTC-anchored midnight boundaries for "today" in the given IANA timezone.
 * Falls back to UTC when tz is invalid or omitted.
 *
 * @example
 *   const { today, tomorrow } = getDayBounds('Asia/Kolkata')
 */
export function getDayBounds(tz: string = 'UTC'): { today: Date; tomorrow: Date } {
  let safeTz = tz
  try {
    // Validate the timezone string — Intl will throw on unknown identifiers
    Intl.DateTimeFormat(undefined, { timeZone: tz })
  } catch {
    safeTz = 'UTC'
  }

  const now = new Date()
  const zoned = toZonedTime(now, safeTz)
  zoned.setHours(0, 0, 0, 0)
  const today = fromZonedTime(zoned, safeTz)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return { today, tomorrow }
}
