# VitalIQ

VitalIQ is an AI-assisted health workspace built with Next.js. It connects nutrition, training, sleep, mood, hydration, biomarkers, body metrics, readiness scoring, and contextual coaching in one account-scoped application.

The product is designed around a simple idea: health data becomes more useful when signals are connected. VitalIQ does not just log meals or workouts in isolation; it combines daily inputs into practical guidance, trends, and next actions.

## Features

- Secure email/password authentication with NextAuth and bcrypt
- Optional Google OAuth account creation and profile completion
- Personalized onboarding for age, sex, height, weight, activity level, and goal
- Readiness dashboard using sleep, mood, recovery, and training context
- AI meal analysis from text or food photos
- Voice-assisted meal logging where supported by the browser
- Macro targets, calorie tracking, hydration tracking, and meal history
- AI-generated workouts adapted to readiness, goal, environment, and fitness level
- Workout session logging with sets, timer, draft recovery, and streak updates
- AI health coach with user context from dashboard and hydration data
- Progress tracking for weight, sleep, mood, biomarkers, badges, and streaks
- Biomarker history with reference ranges and longevity score
- What-if body composition simulator
- PWA support with install prompt and offline fallback page
- Server-side AI API proxy so provider keys never reach the browser

## Tech Stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 14 App Router |
| UI | React 18, Tailwind CSS |
| State | Zustand |
| Auth | NextAuth, bcrypt |
| Database | PostgreSQL |
| ORM | Prisma |
| AI | Gemini API |
| Rate limiting | Upstash Redis |
| Charts | Recharts |
| Deployment | Vercel |
| Testing | Node test runner scripts with mocked route modules |

## Application Routes

| Route | Purpose |
| --- | --- |
| `/` | Splash and auth-aware entry route |
| `/login` | Sign in and account access |
| `/onboarding` | New account setup and Google profile completion |
| `/dashboard` | Readiness, daily priorities, insights, and pillar summary |
| `/nutrition` | Meal analysis, macro tracking, hydration, and daily meal log |
| `/workout` | AI workout generation and session completion |
| `/coach` | Context-aware AI health coach |
| `/progress` | Weight, sleep, mood, biomarkers, badges, and trends |
| `/foods` | Nutrient explorer and food database |
| `/simulator` | Body composition what-if projection |
| `/settings` | Profile, preferences, PWA install, and account controls |

`/nutrients` permanently redirects to `/foods`.

## API Surface

| Endpoint | Purpose |
| --- | --- |
| `/api/auth/[...nextauth]` | NextAuth handlers |
| `/api/auth/register` | Credentials registration |
| `/api/dashboard` | Account-scoped dashboard aggregate |
| `/api/gemini` | Server-side AI gateway and validation layer |
| `/api/meals` | Meal create/read/delete |
| `/api/workouts` | Workout create/read |
| `/api/sleep` | Sleep create/read/delete |
| `/api/mood` | Mood create/read/delete |
| `/api/weight` | Weight create/read/delete plus profile metric reconciliation |
| `/api/hydration` | Account-scoped daily hydration read/update |
| `/api/biomarkers` | Biomarker read/create |
| `/api/badges` | Read earned badges; badge writes are server-derived |
| `/api/user` | Profile update and metric recomputation |
| `/api/health` | Liveness and optional readiness checks |

All protected app routes and API routes are guarded by `middleware.ts`.

## AI Capabilities

All AI requests go through `/api/gemini`. The browser never receives the Gemini API key.

| Request type | Capability |
| --- | --- |
| `meal_analysis` | Estimate calories, macros, confidence, assumptions, and meal type from text |
| `multipart/form-data` | Analyze food photos |
| `workout_generation` | Generate readiness-aware workouts |
| `coach_chat` | Answer health, fitness, recovery, hydration, and nutrition questions using user context |
| `bmi_recommendations` | Generate onboarding recommendations |
| `daily_insight` | Generate cross-pillar daily insight |
| `meal_swap` | Suggest healthier alternatives |

The AI route includes request type allow-listing, input sanitization, rate limiting, JSON schema validation, model fallback handling, and bounded output sizes.

## Data Model

Core Prisma models include:

- `User`
- `WeightLog`
- `MealLog`
- `WorkoutSession`
- `ExerciseLog`
- `ExerciseSet`
- `SleepLog`
- `MoodLog`
- `HydrationLog`
- `Biomarker`
- `Insight`
- `Streak`
- `UserBadge`

The database is designed for account-scoped health logs. Mutating routes enforce session ownership through server-side session checks and Prisma filters.

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm
- PostgreSQL database
- Gemini API key
- Upstash Redis database for production AI/register rate limiting

### 1. Install dependencies

```bash
npm install
```

### 2. Create environment file

```bash
cp .env.local.example .env.local
```

`.env.local.example` is the deploy-ready template. `.env.example` is a smaller starter template.

### 3. Configure required environment variables

```env
# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:PORT/postgres"

# Auth
NEXTAUTH_SECRET="generate-a-random-secret"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Gemini
GEMINI_API_KEY="your_gemini_api_key"
GEMINI_MODEL_PRIMARY="gemini-2.5-flash"
# GEMINI_MODEL_FALLBACKS="gemini-2.5-flash-lite"

# Upstash Redis
UPSTASH_REDIS_REST_URL="your_upstash_redis_rest_url"
UPSTASH_REDIS_REST_TOKEN="your_upstash_redis_rest_token"

# Optional Google OAuth
GOOGLE_CLIENT_ID="your_google_oauth_client_id"
GOOGLE_CLIENT_SECRET="your_google_oauth_client_secret"
```

Important notes:

- `NEXTAUTH_SECRET` is required in production.
- `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` must match the deployed URL exactly.
- Use a pooled/runtime URL for `DATABASE_URL` in serverless environments.
- Use a direct or session-pooled URL for `DIRECT_URL` so Prisma migrations can run safely.
- Upstash variables are required for production rate limiting.

### 4. Set up the database

```bash
npm run db:setup
```

This runs:

```bash
npm run db:push
npm run db:seed
```

The seed script creates a demo account:

```text
Email: demo@vitaliq.app
Password: demo1234
```

### 5. Start development server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start local development server |
| `npm run build` | Build production app |
| `npm run start` | Start production server after build |
| `npm test` | Run local test suite |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:seed` | Seed demo data |
| `npm run db:setup` | Push schema and seed database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Reset database through project runner |
| `npx prisma generate` | Regenerate Prisma client |

## Verification

Before pushing or deploying, run:

```bash
npx prisma generate
npm test
npm run build
git diff --check
```

Expected result:

- Prisma client generation succeeds
- Test suite passes
- Next.js production build succeeds
- Diff check reports no whitespace errors

## Health Checks

Basic liveness:

```http
GET /api/health
```

Example response:

```json
{
  "status": "ok",
  "timestamp": "2026-04-24T00:00:00.000Z"
}
```

Deep readiness:

```http
GET /api/health?deep=1
```

Deep readiness verifies:

- Database connectivity
- `NEXTAUTH_SECRET`
- `GEMINI_API_KEY`
- Upstash Redis configuration

If any required check fails, the endpoint returns `503` with `status: "degraded"`.

## Deployment

### Vercel

This project includes `vercel.json` with:

- Prisma migration deployment before build
- `DATABASE_URL="$DIRECT_URL"` during migration execution
- Extended function duration for AI and dashboard routes

Vercel build command:

```bash
DATABASE_URL="$DIRECT_URL" prisma migrate deploy && next build
```

### Deployment Checklist

1. Create a PostgreSQL database.
2. Create an Upstash Redis database.
3. Add all required environment variables in Vercel:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
   - `NEXT_PUBLIC_APP_URL`
   - `GEMINI_API_KEY`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - optional Gemini model overrides
   - optional Google OAuth credentials
4. Confirm `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` match the production domain.
5. Deploy from GitHub or with the Vercel CLI.
6. After deployment, check `/api/health?deep=1`.

## Security and Privacy Notes

- AI provider keys are server-only.
- Protected routes are guarded by NextAuth middleware.
- Prisma queries are scoped to `session.user.id`.
- Supabase/Postgres RLS hardening migrations are included for public tables.
- Badge writes are server-derived to prevent self-awarding.
- Production startup fails if `NEXTAUTH_SECRET` is missing.
- Uploaded meal photos are analyzed in-memory and are not persisted by the current implementation.

## Project Structure

```text
vitaliq/
|- app/
|  |- api/
|  |  |- auth/
|  |  |- badges/
|  |  |- biomarkers/
|  |  |- dashboard/
|  |  |- gemini/
|  |  |- health/
|  |  |- hydration/
|  |  |- meals/
|  |  |- mood/
|  |  |- sleep/
|  |  |- user/
|  |  |- weight/
|  |  `- workouts/
|  |- coach/
|  |- dashboard/
|  |- foods/
|  |- login/
|  |- nutrition/
|  |- onboarding/
|  |- progress/
|  |- settings/
|  |- simulator/
|  `- workout/
|- components/
|- lib/
|- prisma/
|  |- migrations/
|  |- schema.prisma
|  `- seed.ts
|- public/
|- scripts/
|- tests/
|- types/
|- middleware.ts
|- next.config.js
|- package.json
`- vercel.json
```

## Roadmap

- Apple Health and Google Fit sync
- Barcode scanner through Open Food Facts
- Lab report PDF parsing
- Push notifications
- Weekly health report export
- Stripe-powered Pro tier
- Biological age estimation from biomarkers
- Wearable-driven recovery and training load insights
- Long-term AI coach memory with user controls

## License

This project is proprietary and all rights are reserved. See [LICENSE](./LICENSE).
