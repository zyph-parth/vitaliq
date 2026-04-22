-- Harden Supabase-exposed public tables.
--
-- VitalIQ uses NextAuth sessions and server-side Prisma queries for application
-- access. The browser should not read or write these tables directly through
-- Supabase's PostgREST roles.
--
-- RLS is enabled without policies, so anon/authenticated Supabase API requests
-- cannot access rows. Prisma migrations and server-side Prisma access continue
-- to use the configured database owner/service connection.

ALTER TABLE IF EXISTS public."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."weight_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."meal_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."workout_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."exercise_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."exercise_sets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."sleep_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."mood_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."biomarkers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."insights" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."streaks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."user_badges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE
      public."users",
      public."weight_logs",
      public."meal_logs",
      public."workout_sessions",
      public."exercise_logs",
      public."exercise_sets",
      public."sleep_logs",
      public."mood_logs",
      public."biomarkers",
      public."insights",
      public."streaks",
      public."user_badges",
      public."_prisma_migrations"
    FROM anon;

    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      REVOKE ALL PRIVILEGES ON TABLES FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE
      public."users",
      public."weight_logs",
      public."meal_logs",
      public."workout_sessions",
      public."exercise_logs",
      public."exercise_sets",
      public."sleep_logs",
      public."mood_logs",
      public."biomarkers",
      public."insights",
      public."streaks",
      public."user_badges",
      public."_prisma_migrations"
    FROM authenticated;

    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      REVOKE ALL PRIVILEGES ON TABLES FROM authenticated;
  END IF;
END $$;
