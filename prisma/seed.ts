// prisma/seed.ts — Seed demo data for development
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { computeAllMetrics } from '../lib/calculations'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding VitalIQ demo data...')

  // Create demo user
  const passwordHash = await bcrypt.hash('demo1234', 12)
  const metrics = computeAllMetrics(82, 178, 26, 'male', 'moderate', 'lose')

  const user = await prisma.user.upsert({
    where: { email: 'demo@vitaliq.app' },
    update: {},
    create: {
      name: 'Arjun Demo',
      email: 'demo@vitaliq.app',
      passwordHash,
      age: 26, sex: 'male', heightCm: 178, weightKg: 82,
      activityLevel: 'moderate', goal: 'lose',
      bmi: metrics.bmi, bmr: metrics.bmr, tdee: metrics.tdee,
      bodyFatPct: metrics.estimatedBodyFat,
      streak: { create: { currentDays: 12, bestDays: 28, lastLogDate: new Date() } },
      badges: {
        create: [
          { badgeId: 'streak_7' },
          { badgeId: 'first_pr' },
          { badgeId: 'macro_master' },
        ],
      },
    },
  })

  console.log(`✓ User: ${user.email}`)

  // Seed 30 days of weight logs
  const weightLogs = Array.from({ length: 30 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (29 - i))
    return {
      userId: user.id,
      date,
      weightKg: parseFloat((85.2 - i * 0.11 + (Math.random() - 0.5) * 0.3).toFixed(1)),
    }
  })

  await prisma.weightLog.createMany({ data: weightLogs, skipDuplicates: true })
  console.log(`✓ Weight logs: ${weightLogs.length} entries`)

  // Seed 7 days of meal logs
  const mealTemplates = [
    { description: 'Oats with banana and almonds', calories: 380, proteinG: 12, carbsG: 64, fatG: 9, fibreG: 6, mealType: 'breakfast' },
    { description: 'Dal rice with sabzi',           calories: 540, proteinG: 22, carbsG: 88, fatG: 12, fibreG: 8, mealType: 'lunch' },
    { description: 'Protein shake and apple',       calories: 248, proteinG: 28, carbsG: 24, fatG: 3,  fibreG: 3, mealType: 'snack' },
    { description: 'Chicken curry with 2 rotis',    calories: 672, proteinG: 34, carbsG: 48, fatG: 18, fibreG: 5, mealType: 'dinner' },
  ]

  for (let d = 6; d >= 0; d--) {
    const logDate = new Date()
    logDate.setDate(logDate.getDate() - d)
    for (const meal of mealTemplates) {
      await prisma.mealLog.create({
        data: {
          userId: user.id,
          loggedAt: logDate,
          ...meal,
          sugarG: 12, sodiumMg: 480, fibreG: meal.fibreG,
        },
      }).catch(() => {}) // skip duplicates
    }
  }
  console.log('✓ Meal logs: 7 days')

  // Seed sleep logs
  const sleepLogs = Array.from({ length: 14 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const hours = 5.5 + Math.random() * 3
    return {
      userId: user.id,
      date,
      bedtimeAt: new Date(date.getTime() - hours * 3600000),
      wakeAt: date,
      totalHours: parseFloat(hours.toFixed(1)),
      deepHours: parseFloat((hours * 0.2).toFixed(1)),
      remHours: parseFloat((hours * 0.25).toFixed(1)),
      lightHours: parseFloat((hours * 0.55).toFixed(1)),
      hrv: Math.round(55 + Math.random() * 20),
      restingHR: Math.round(58 + Math.random() * 8),
      quality: Math.round(5 + Math.random() * 4),
      source: 'manual',
    }
  })

  await prisma.sleepLog.createMany({ data: sleepLogs, skipDuplicates: true })
  console.log(`✓ Sleep logs: ${sleepLogs.length} entries`)

  // Seed mood logs
  const moodLogs = Array.from({ length: 7 }, (_, i) => {
    const loggedAt = new Date()
    loggedAt.setDate(loggedAt.getDate() - i)
    return {
      userId: user.id,
      loggedAt,
      mood: Math.round(6 + Math.random() * 3),
      energy: Math.round(5 + Math.random() * 4),
      stress: Math.round(2 + Math.random() * 4),
      focus: Math.round(6 + Math.random() * 3),
      triggers: [] as string[],
    }
  })

  await prisma.moodLog.createMany({ data: moodLogs, skipDuplicates: true })
  console.log(`✓ Mood logs: ${moodLogs.length} entries`)

  // Seed a workout session
  const workoutSession = await prisma.workoutSession.create({
    data: {
      userId: user.id,
      title: 'Upper Body Strength',
      sessionType: 'push',
      durationMins: 52,
      caloriesBurned: 410,
      aiGenerated: true,
      completedAt: new Date(),
      exercises: {
        create: [
          {
            name: 'Bench Press', orderIndex: 0,
            sets: { create: [
              { setNumber: 1, reps: 8, weightKg: 70, completed: true, rpe: 7 },
              { setNumber: 2, reps: 8, weightKg: 70, completed: true, rpe: 8 },
              { setNumber: 3, reps: 7, weightKg: 70, completed: true, rpe: 9 },
              { setNumber: 4, reps: 6, weightKg: 70, completed: true, rpe: 9 },
            ]},
          },
          {
            name: 'Overhead Press', orderIndex: 1,
            sets: { create: [
              { setNumber: 1, reps: 8, weightKg: 50, completed: true, rpe: 7 },
              { setNumber: 2, reps: 8, weightKg: 50, completed: true, rpe: 8 },
              { setNumber: 3, reps: 7, weightKg: 50, completed: true, rpe: 8 },
            ]},
          },
        ],
      },
    },
  })
  console.log(`✓ Workout session: ${workoutSession.title}`)

  // Seed daily AI insight
  await prisma.insight.create({
    data: {
      userId: user.id,
      type: 'daily_readiness',
      readinessScore: 76,
      headline: 'Good training day ahead',
      body: 'You slept 6.8h last night with an HRV of 62ms — slightly above your 7-day average. Protein intake has been below target for 3 days. Today is a good day for moderate-high intensity training.',
      actionable: 'Add 30g of protein to your next meal — try a chicken breast or protein shake.',
      pillarsUsed: ['sleep', 'nutrition', 'training'],
    },
  })
  console.log('✓ AI insight seeded')

  console.log('\n✅ Seed complete!')
  console.log('   Demo login: demo@vitaliq.app / demo1234')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
