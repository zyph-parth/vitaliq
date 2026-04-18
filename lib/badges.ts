export const KNOWN_BADGE_IDS = [
  'streak_7',
  'streak_30',
  'century',
  'first_pr',
  'macro_master',
  'sleep_week',
  'longevity',
] as const

export type ValidBadgeId = (typeof KNOWN_BADGE_IDS)[number]

export const VALID_BADGE_IDS = new Set<ValidBadgeId>(KNOWN_BADGE_IDS)

export function isValidBadgeId(badgeId: string): badgeId is ValidBadgeId {
  return VALID_BADGE_IDS.has(badgeId as ValidBadgeId)
}
