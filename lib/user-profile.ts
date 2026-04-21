import type { User } from '@prisma/client'
import type { ActivityLevel, Goal, Sex } from '@/lib/calculations'

type UserHealthFields = Pick<
  User,
  'age' | 'sex' | 'heightCm' | 'weightKg' | 'activityLevel' | 'goal' | 'bmi' | 'bmr' | 'tdee'
>

type CompleteHealthFields = {
  age: number
  sex: Sex
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  goal: Goal
  bmi: number
  bmr: number
  tdee: number
}

export type CompleteUserProfile = User & CompleteHealthFields

const VALID_SEX = new Set(['male', 'female'])
const VALID_ACTIVITY = new Set(['sedentary', 'light', 'moderate', 'active', 'athlete'])
const VALID_GOAL = new Set(['lose', 'muscle', 'maintain', 'longevity'])

export function hasCompleteHealthProfile<T extends UserHealthFields>(user: T): user is T & CompleteHealthFields {
  return (
    typeof user.age === 'number' &&
    VALID_SEX.has(String(user.sex)) &&
    typeof user.heightCm === 'number' &&
    typeof user.weightKg === 'number' &&
    VALID_ACTIVITY.has(String(user.activityLevel)) &&
    VALID_GOAL.has(String(user.goal)) &&
    typeof user.bmi === 'number' &&
    typeof user.bmr === 'number' &&
    typeof user.tdee === 'number'
  )
}

export function profileIncompleteResponseBody() {
  return {
    error: 'Complete your health profile before using this feature.',
    code: 'PROFILE_INCOMPLETE',
  }
}
