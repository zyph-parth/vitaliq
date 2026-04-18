// lib/store.ts — Zustand global state for VitalIQ
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface UserProfile {
  id: string
  name: string
  email: string
  age: number
  sex: 'male' | 'female'
  heightCm: number
  weightKg: number
  activityLevel: string
  goal: string
  bmi: number
  bmr: number
  tdee: number
  bodyFatPct?: number
}

// CODE QUALITY 3: Proper types replacing `any`
export interface NutritionToday {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface SleepSummary {
  hours: number
  quality: number
  hrv: number | null
  deepHours: number | null
  remHours: number | null
}

export interface DashboardData {
  readiness: {
    score: number
    label: string
    recommendation: string
    pillars: Record<string, number>
  }
  pillars: {
    nutrition: { today: NutritionToday; target: number; remaining: number; mealCount: number } | null
    sleep: SleepSummary | null
    training: {
      sessionsThisWeek: number
      lastSession: { title: string; type: string; daysAgo: number } | null
    } | null
    mental: { mood: number; energy: number; stress: number } | null
  }
  weeklyCalChart: Array<{ day: string; calories: number; date: string }>
  weightTrend: Array<{ date: string; weight: number }>
  insights: string[]
  streak: { current: number; best: number; message: string }
  user?: {
    id: string
    name: string
    goal: string
    sex: string
    weightKg: number
    heightCm: number
    age: number
    activityLevel: string
    tdee: number
    bmi: number
    bmr: number | null
    bodyFatPct: number | null
    targets: { calories: number; protein: number; carbs: number; fat: number; fibre: number }
  }
}

interface AppState {
  // Auth
  user: UserProfile | null
  setUser: (user: UserProfile | null) => void

  // Onboarding form state
  onboardingData: {
    step: number
    name: string
    email: string
    password: string
    age: string
    sex: string
    heightCm: string
    weightKg: string
    activityLevel: string
    goal: string
    metrics: Record<string, unknown> | null
  }
  setOnboardingData: (data: Partial<AppState['onboardingData']>) => void
  resetOnboarding: () => void

  // Dashboard
  dashboard: DashboardData | null
  dashboardLoading: boolean
  setDashboard: (data: DashboardData) => void
  setDashboardLoading: (v: boolean) => void
  clearDashboard: () => void  // UX 5 ADDENDUM — bust cache after logging

  // Nutrition
  meals: Array<{
    id: string; description: string; calories: number;
    proteinG: number; carbsG: number; fatG: number; fibreG: number;
    mealType: string; aiInsight?: string | null;
  }>
  mealTotals: { calories: number; protein: number; carbs: number; fat: number; fibre: number }
  setMeals: (meals: AppState['meals']) => void
  addMeal: (meal: AppState['meals'][0]) => void

  // Workout
  activeSession: Record<string, unknown> | null
  setActiveSession: (session: Record<string, unknown> | null) => void
  completedSets: Record<string, boolean>  // setId → completed
  toggleSet: (setId: string) => void

  // Coach
  chatHistory: Array<{ role: 'user' | 'ai'; content: string; time: string }>
  addChatMessage: (msg: { role: 'user' | 'ai'; content: string; time: string }) => void
  clearChat: () => void
}

const defaultOnboarding = {
  step: 1,
  name: '',
  email: '',
  password: '',
  age: '',
  sex: 'male',
  heightCm: '',
  weightKg: '',
  activityLevel: 'moderate',
  goal: 'lose',
  metrics: null,
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Auth
      user: null,
      setUser: (user) => set({ user }),

      // Onboarding
      onboardingData: defaultOnboarding,
      setOnboardingData: (data) =>
        set((s) => ({ onboardingData: { ...s.onboardingData, ...data } })),
      resetOnboarding: () => set({ onboardingData: defaultOnboarding }),

      // Dashboard
      dashboard: null,
      dashboardLoading: false,
      setDashboard: (data) => set({ dashboard: data }),
      setDashboardLoading: (v) => set({ dashboardLoading: v }),
      clearDashboard: () => set({ dashboard: null }),

      // Nutrition
      meals: [],
      mealTotals: { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 },
      setMeals: (meals) => {
        const totals = meals.reduce(
          (acc, m) => ({
            calories: acc.calories + (m.calories || 0),
            protein: acc.protein + (m.proteinG || 0),
            carbs: acc.carbs + (m.carbsG || 0),
            fat: acc.fat + (m.fatG || 0),
            fibre: acc.fibre + (m.fibreG || 0),
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }
        )
        set({ meals, mealTotals: totals })
      },
      addMeal: (meal) => {
        const meals = [...get().meals, meal]
        get().setMeals(meals)
      },

      // Workout
      activeSession: null,
      setActiveSession: (session) => set({ activeSession: session }),
      completedSets: {},
      toggleSet: (setId) =>
        set((s) => ({
          completedSets: { ...s.completedSets, [setId]: !s.completedSets[setId] },
        })),

      // Coach
      chatHistory: [],
      addChatMessage: (msg) =>
        set((s) => ({ chatHistory: [...s.chatHistory, msg] })),
      clearChat: () => set({ chatHistory: [] }),
    }),
    {
      name: 'vitaliq-store',
      partialize: (s) => ({
        user: s.user,
        chatHistory: s.chatHistory.slice(-20), // keep last 20 messages
        completedSets: s.completedSets,
      }),
    }
  )
)
