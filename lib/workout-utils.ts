export type ParsedRepsOrDuration = {
  reps: number | null
  durationSec: number | null
  isAmrap: boolean
}

export interface WorkoutDraftTimerSnapshot {
  timer?: number
  timerRunning?: boolean
  savedAt?: number
  timerStartedAtMs?: number | null
}

export interface WorkoutTimerState {
  timer: number
  timerRunning: boolean
  timerStartedAtMs: number | null
}

function toPositiveRoundedNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function sumMatchedDurations(
  text: string,
  pattern: RegExp,
  multiplier: number
): number {
  let total = 0

  for (const match of text.matchAll(pattern)) {
    total += Number(match[1]) * multiplier
  }

  return total
}

export function parseWorkoutRepsOrDuration(value: unknown): ParsedRepsOrDuration {
  if (typeof value !== 'string') {
    return { reps: null, durationSec: null, isAmrap: false }
  }

  const text = value.trim().toLowerCase()
  if (!text) {
    return { reps: null, durationSec: null, isAmrap: false }
  }

  const durationSec =
    sumMatchedDurations(text, /(\d+(?:\.\d+)?)\s*(min|mins|minute|minutes)\b/g, 60) +
    sumMatchedDurations(text, /(\d+(?:\.\d+)?)\s*(sec|secs|second|seconds|s)\b/g, 1)

  if (durationSec > 0) {
    return { reps: null, durationSec: Math.round(durationSec), isAmrap: false }
  }

  const setMatch = text.match(/(\d+)\s*[x×]\s*(\d+)/)
  if (setMatch) {
    return { reps: parseInt(setMatch[2], 10), durationSec: null, isAmrap: false }
  }

  const repMatch = text.match(/(\d+(?:\.\d+)?)\s*reps?\b/)
  if (repMatch) {
    return { reps: Math.round(Number(repMatch[1])), durationSec: null, isAmrap: false }
  }

  const eachMatch = text.match(/(\d+(?:\.\d+)?)\s*each(?:\s+\w+)?\b/)
  if (eachMatch) {
    return { reps: Math.round(Number(eachMatch[1])), durationSec: null, isAmrap: false }
  }

  if (text.includes('amrap')) {
    return { reps: null, durationSec: null, isAmrap: true }
  }

  return { reps: null, durationSec: null, isAmrap: false }
}

export function parseWorkoutWeightKg(value: unknown): number | null {
  if (typeof value === 'number') {
    const parsed = toPositiveRoundedNumber(value)
    return parsed == null ? null : Number(parsed.toFixed(1))
  }

  if (typeof value !== 'string') return null

  const text = value.trim().toLowerCase()
  if (!text) return null
  if (/%|\b1rm\b|\brpe\b/.test(text)) return null
  if (
    /^(bodyweight|light|moderate|heavy|easy|recovery|challenging|moderate-heavy|light-moderate)$/.test(text)
  ) {
    return null
  }
  if (/\d+\s*(?:-|–|to)\s*\d+/.test(text)) return null

  const matches = [...text.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]))
  if (matches.length !== 1) return null

  let parsed = matches[0]
  if (/\b(lb|lbs|pound|pounds)\b/.test(text)) {
    parsed *= 0.45359237
  }

  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Number(parsed.toFixed(1))
}

export function getElapsedWorkoutSeconds(
  timer: number,
  timerRunning: boolean,
  timerStartedAtMs: number | null,
  nowMs: number = Date.now()
): number {
  if (!timerRunning || timerStartedAtMs == null || !Number.isFinite(timerStartedAtMs)) {
    return Math.max(0, Math.floor(timer))
  }

  return Math.max(0, Math.floor((nowMs - timerStartedAtMs) / 1000))
}

export function recoverWorkoutTimerState(
  draft: WorkoutDraftTimerSnapshot,
  nowMs: number = Date.now()
): WorkoutTimerState {
  const timer = Math.max(0, Math.floor(Number(draft.timer) || 0))
  const timerRunning = Boolean(draft.timerRunning)

  if (!timerRunning) {
    return { timer, timerRunning: false, timerStartedAtMs: null }
  }

  const storedStart = Number(draft.timerStartedAtMs)
  const timerStartedAtMs = Number.isFinite(storedStart)
    ? storedStart
    : Number.isFinite(Number(draft.savedAt))
      ? Number(draft.savedAt) - timer * 1000
      : nowMs - timer * 1000

  return {
    timer: getElapsedWorkoutSeconds(timer, true, timerStartedAtMs, nowMs),
    timerRunning: true,
    timerStartedAtMs,
  }
}

export function getWorkoutStartedAtIso(
  elapsedSeconds: number,
  nowMs: number = Date.now()
): string | undefined {
  const safeElapsedSeconds = Math.max(0, Math.floor(elapsedSeconds))
  if (safeElapsedSeconds <= 0) return undefined

  return new Date(nowMs - safeElapsedSeconds * 1000).toISOString()
}
