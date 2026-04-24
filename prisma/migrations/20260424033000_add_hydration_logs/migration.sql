CREATE TABLE "hydration_logs" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "localDate" TEXT NOT NULL,
  "timeZone" TEXT NOT NULL DEFAULT 'UTC',
  "glasses" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "hydration_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hydration_logs_userId_localDate_key" ON "hydration_logs"("userId", "localDate");
CREATE INDEX "hydration_logs_userId_updatedAt_idx" ON "hydration_logs"("userId", "updatedAt");

ALTER TABLE "hydration_logs"
  ADD CONSTRAINT "hydration_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE IF EXISTS public."hydration_logs" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE public."hydration_logs" FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE public."hydration_logs" FROM authenticated;
  END IF;
END $$;
