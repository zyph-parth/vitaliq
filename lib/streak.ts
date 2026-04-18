// lib/streak.ts — Centralized streak update logic used by all log routes

import { prisma } from '@/lib/prisma'

/**
 * Updates the user's streak record after any logging action.
 * - Skips if already updated today (idempotent)
 * - Increments if yesterday was the last log date (consecutive)
 * - Resets to 1 if the streak was broken
 * - Updates bestDays if current exceeds it
 * Also awards streak milestone badges (7d, 30d, 100d).
 */
export async function updateStreak(userId: string): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const streak = await prisma.streak.findUnique({ where: { userId } })

  if (!streak) {
    // No streak record — shouldn't happen for registered users but handle gracefully
    return
  }

  const lastLog = streak.lastLogDate
  const isNewDay = !lastLog || new Date(lastLog) < today

  if (!isNewDay) return // already logged today, skip

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const isConsecutive = lastLog && new Date(lastLog) >= yesterday

  const newCurrent = isConsecutive ? streak.currentDays + 1 : 1
  const newBest = Math.max(streak.bestDays, newCurrent)

  await prisma.streak.update({
    where: { userId },
    data: {
      currentDays: newCurrent,
      bestDays: newBest,
      lastLogDate: new Date(),
    },
  })

  // Award streak milestone badges (idempotent — upsert with unique constraint)
  const milestones: Array<{ days: number; badgeId: string }> = [
    { days: 7, badgeId: 'streak_7' },
    { days: 30, badgeId: 'streak_30' },
    { days: 100, badgeId: 'century' },
  ]

  for (const { days, badgeId } of milestones) {
    if (newCurrent >= days) {
      await prisma.userBadge.upsert({
        where: { userId_badgeId: { userId, badgeId } },
        create: { userId, badgeId },
        update: {}, // no-op if already exists
      })
    }
  }
}
