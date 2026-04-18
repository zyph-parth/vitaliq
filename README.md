# VitalIQ v2.0 — Intelligent Health OS

A fully merged, production-grade health platform combining **VitalIQ's** full-stack backend, auth, and UI design system with **Vitro's** AI-powered calorie photo tracking, nutrient explorer, and voice logging.

---

## ✨ What's merged

| Feature | Source | Status |
|---|---|---|
| Auth (NextAuth + bcrypt) | VitalIQ | ✅ |
| PostgreSQL + Prisma schema | VitalIQ | ✅ |
| Readiness score algorithm | VitalIQ | ✅ |
| Sleep / Mood / Biomarker tracking | VitalIQ | ✅ |
| AI Workout generator | VitalIQ | ✅ |
| Body Simulator | VitalIQ | ✅ |
| Design system (Clash Display, Satoshi, glassmorphism) | VitalIQ | ✅ |
| **📸 Photo calorie logging (Gemini Vision)** | Vitro | ✅ NEW |
| **🎙 Voice meal logging (Speech API)** | Vitro | ✅ NEW |
| **🥦 Nutrient Explorer (24-food DB + AI insights)** | Vitro | ✅ NEW |
| **🖥 Desktop sidebar navigation** | Merged | ✅ NEW |
| **🍽 AI food analysis result card** | Vitro | ✅ NEW |

---

## 🚀 Quick start

### 1. Install
```bash
npm install
```

### 2. Set environment variables
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
# PostgreSQL (use Supabase, Neon, or local)
DATABASE_URL=postgresql://user:password@host:5432/vitaliq

# NextAuth
NEXTAUTH_SECRET=your-random-secret-32-chars
NEXTAUTH_URL=http://localhost:3000

# Google Gemini (free at https://aistudio.google.com)
GEMINI_API_KEY=your_gemini_api_key
```

### 3. Set up database
```bash
npm run db:setup   # creates tables + seeds demo user: demo@vitaliq.app / demo1234
# or run them individually:
npm run db:push
npm run db:seed
```

### 4. Run
```bash
npm run dev
# → http://localhost:3000
```

---

## 🏗️ Project structure

```
vitaliq/
├── app/
│   ├── (auth)          login, onboarding
│   ├── dashboard/      home with readiness ring, pillars, charts
│   ├── nutrition/      ★ photo/voice/text meal logging + macros
│   ├── nutrients/      ★ nutrient explorer (24 foods, AI insights)
│   ├── workout/        AI workout generator + live timer
│   ├── simulator/      body composition what-if projector
│   ├── coach/          AI chat coach (Gemini, full user context)
│   ├── progress/       weight trend, sleep, mood, badges
│   ├── settings/       integrations, notifications, profile
│   └── api/
│       ├── gemini/     ★ merged: text + image vision + all AI types
│       ├── meals/      CRUD with Prisma
│       ├── workouts/   session logging
│       ├── sleep/      sleep log API
│       ├── mood/       mood check-in API
│       ├── weight/     weight log API
│       ├── dashboard/  cross-pillar intelligence aggregator
│       └── auth/       NextAuth credentials + register
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx    ★ desktop sidebar + mobile bottom nav
│   │   └── BottomNav.tsx
│   ├── charts/             ReadinessRing, WeeklyCalChart, WeightTrendChart
│   └── ui/                 Button, Card, Input, Chip, ProgressBar, etc.
├── lib/
│   ├── calculations.ts     BMI, BMR, TDEE, readiness score, macros
│   ├── store.ts            Zustand global state
│   └── foods.ts            ★ 24-food nutrient database
└── prisma/
    └── schema.prisma       Full relational schema (User, MealLog, WorkoutSession, SleepLog, MoodLog, WeightLog, Biomarker, Badge, Streak)
```

---

## 📐 Desktop layout

On screens ≥ 1024px:
- A fixed **220px sidebar** replaces the bottom nav
- All 8 pages are accessible from the sidebar
- Content expands to full width (`max-w-3xl`) with comfortable padding
- Charts and cards automatically adapt

On mobile:
- Bottom nav shows 5 core tabs (Home, Nutrition, Train, Coach, Progress)
- Additional pages (Nutrients, Simulator, Settings) via Profile/more

---

## 🧠 AI features

All AI runs **server-side** via `/api/gemini` — your key is never exposed.

| Type | Capability |
|---|---|
| `meal_analysis` | Text → calories + macros + meal type + insight |
| **Image/multipart** | **Photo → Gemini Vision → full nutritional breakdown** |
| `workout_generation` | Readiness-aware AI workout plan with sets/reps/tips |
| `coach_chat` | Contextual chat with full user health data injected |
| `bmi_recommendations` | 4 personalised post-onboarding tips |
| `daily_insight` | Cross-pillar pattern detection |
| `meal_swap` | Healthier alternative suggestions |

---

## 🌐 Deploy

```bash
vercel
# Add env vars in Vercel dashboard
# Use Supabase or Neon for free Postgres
```

---

## 🗺 Roadmap
- [ ] Apple Health / Google Fit sync
- [ ] Barcode scanner (Open Food Facts)
- [ ] Push notifications
- [ ] Stripe Pro tier (₹999/mo)
- [ ] Weekly PDF health report
- [ ] Biological age estimation from biomarkers
