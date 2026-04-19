# VitalIQ v2.0

VitalIQ is a Next.js 14 health platform that combines nutrition logging, workout planning, sleep and mood tracking, biomarker history, readiness scoring, and an AI coach into one app.

## What it includes

- Credentials auth with NextAuth and bcrypt
- PostgreSQL plus Prisma data layer
- Dashboard readiness scoring across sleep, mood, and training
- Nutrition logging with text, photo, and voice-assisted flows
- AI meal analysis, workout generation, coaching, and meal swaps
- Weight, sleep, mood, biomarker, and badge tracking
- Mobile bottom navigation and desktop sidebar layout

## Tech stack

- Next.js 14 App Router
- React 18
- Prisma plus PostgreSQL
- NextAuth
- Upstash Redis rate limiting
- Gemini API
- Tailwind CSS
- Zustand

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Create your local env file

Use the full template:

```bash
cp .env.local.example .env.local
```

If you only want the smaller starter template, `.env.example` is also available, but `.env.local.example` is the source of truth for deploy-ready config.

### 3. Required environment variables

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

# Gemini model overrides (optional)
GEMINI_MODEL_PRIMARY="gemini-2.5-flash"
# GEMINI_MODEL_FALLBACKS="gemini-2.5-flash-lite"

# Upstash Redis
UPSTASH_REDIS_REST_URL="your_upstash_redis_rest_url"
UPSTASH_REDIS_REST_TOKEN="your_upstash_redis_rest_token"
```

Notes:

- `NEXTAUTH_SECRET` is required in production. The app intentionally fails startup without it.
- `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` must match your actual app URL in production.
- The Gemini route uses Upstash Redis for rate limiting, so the Upstash variables are required if you want `/api/gemini` to work correctly.
- For Vercel + Supabase, use a pooled/runtime `DATABASE_URL` and a direct or session-pooled `DIRECT_URL` for Prisma migrations.

### 4. Set up the database

```bash
npm run db:setup
```

That runs:

```bash
npm run db:push
npm run db:seed
```

The seed creates a demo account:

- Email: `demo@vitaliq.app`
- Password: `demo1234`

### 5. Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Available scripts

```bash
npm run dev
npm run build
npm run start
npm run db:push
npm run db:seed
npm run db:setup
npm run db:studio
npm run db:reset
```

## Project structure

```text
vitaliq/
|- app/
|  |- api/
|  |  |- auth/
|  |  |- badges/
|  |  |- biomarkers/
|  |  |- dashboard/
|  |  |- gemini/
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
|- scripts/
|- .env.example
|- .env.local.example
|- next.config.js
`- vercel.json
```

## Core routes

- `/dashboard` - readiness, targets, charts, and cross-pillar summary
- `/nutrition` - meal logging and macro tracking
- `/foods` - food and nutrient explorer
- `/workout` - AI workout generation and session logging
- `/coach` - AI health coach chat
- `/progress` - trends for weight, sleep, mood, and badges
- `/simulator` - what-if body composition view
- `/settings` - profile and local preferences

There is also a permanent redirect from `/nutrients` to `/foods`.

## AI features

All AI calls are server-side through `/api/gemini`; the browser never receives your Gemini API key.

| Type | Capability |
| --- | --- |
| `meal_analysis` | Text to calorie and macro estimate |
| `multipart/form-data` | Photo to meal analysis |
| `workout_generation` | Readiness-aware workout programming |
| `coach_chat` | Health coaching with user context |
| `bmi_recommendations` | Four onboarding recommendations |
| `daily_insight` | Cross-pillar daily insight generation |
| `meal_swap` | Two healthier meal alternatives |

## Health check

`/api/health` is a lightweight liveness endpoint:

```json
{ "status": "ok", "timestamp": "..." }
```

It does not verify database or Gemini connectivity.

## Deployment

### Vercel

This repo includes `vercel.json` with:

- `buildCommand`: `DATABASE_URL="$DIRECT_URL" prisma migrate deploy && next build`
- extended function durations for the Gemini and dashboard routes

### Deploy checklist

1. Create a PostgreSQL database in Supabase, Neon, or another Postgres host.
2. Create an Upstash Redis database for Gemini rate limiting.
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
4. Make sure `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` exactly match your deployed URL.
5. Deploy:

```bash
vercel
```

### Before calling it production-ready

- Run a production build locally with `npm run build`
- Confirm Prisma migrations apply cleanly against the production database
- Verify login, registration, dashboard loading, and `/api/gemini`
- Add monitoring and error reporting if you need production observability

## Roadmap

- [ ] Apple Health / Google Fit sync
- [ ] Barcode scanner via Open Food Facts
- [ ] Push notifications
- [ ] Stripe Pro tier
- [ ] Weekly PDF health report
- [ ] Biological age estimation from biomarkers
