// lib/streak.ts — Centralized streak update logic used by all log routes

import { VALID_BADGE_IDS, type ValidBadgeId } from './badges'
import { getDayBounds } from './dates'
import { prisma } from './prisma'

export function computeNextStreakState(
  streak: { currentDays: number; bestDays: number; lastLogDate: Date | null },
  today: Date,
  yesterday: Date
): { shouldUpdate: boolean; newCurrent: number; newBest: number } {
  const lastLog = streak.lastLogDate
  const isNewDay = !lastLog || new Date(lastLog) < today

  if (!isNewDay) {
    return {
      shouldUpdate: false,
      newCurrent: streak.currentDays,
      newBest: streak.bestDays,
    }
  }

  const isConsecutive = Boolean(
    lastLog &&
    new Date(lastLog) >= yesterday &&
    new Date(lastLog) < today
  )

  const newCurrent = isConsecutive ? streak.currentDays + 1 : 1
  const newBest = Math.max(streak.bestDays, newCurrent)

  return { shouldUpdate: true, newCurrent, newBest }
}

/**
 * Updates the user's streak record after any logging action.
 * - Skips if already updated today (idempotent)
 * - Increments if yesterday was the last log date (consecutive)
 * - Resets to 1 if the streak was broken
 * - Updates bestDays if current exceeds it
 * Also awards streak milestone badges (7d, 30d, 100d).
 */
export async function updateStreak(userId: string, tz: string = 'UTC'): Promise<void> {
  const { today } = getDayBounds(tz)
  const { today: yesterday } = getDayBounds(tz, new Date(today.getTime() - 1))

  const streak = await prisma.streak.findUnique({ where: { userId } })

  if (!streak) {
    // No streak record — shouldn't happen for registered users but handle gracefully
    return
  }

  const { shouldUpdate, newCurrent, newBest } = computeNextStreakState(streak, today, yesterday)
  if (!shouldUpdate) return

  await prisma.streak.update({
    where: { userId },
    data: {
      currentDays: newCurrent,
      bestDays: newBest,
      lastLogDate: new Date(),
    },
  })

  // Award streak milestone badges (idempotent — upsert with unique constraint)
  const milestones: Array<{ days: number; badgeId: ValidBadgeId }> = [
    { days: 7, badgeId: 'streak_7' },
    { days: 30, badgeId: 'streak_30' },
    { days: 100, badgeId: 'century' },
  ]

  await Promise.all(
    milestones
      .filter(({ days, badgeId }) => newCurrent >= days && VALID_BADGE_IDS.has(badgeId))
      .map(({ badgeId }) =>
        prisma.userBadge.upsert({
          where: { userId_badgeId: { userId, badgeId } },
          create: { userId, badgeId },
          update: {}, // no-op if already exists
        })
      )
  )
}
