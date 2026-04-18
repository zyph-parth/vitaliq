const path = require("path");
const { spawnSync } = require("child_process");
const { loadEnvConfig } = require("@next/env");

const projectRoot = path.resolve(__dirname, "..");
const prismaCliPath = require.resolve("prisma/build/index.js");
const tsNodeCliPath = require.resolve("ts-node/dist/bin.js");

loadEnvConfig(projectRoot);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Add it to .env.local or .env before running database scripts.");
  process.exit(1);
}

const stepsByMode = {
  push: [[prismaCliPath, ["db", "push"]]],
  seed: [[tsNodeCliPath, ["--compiler-options", '{"module":"CommonJS"}', "prisma/seed.ts"]]],
  setup: [
    [prismaCliPath, ["db", "push"]],
    [tsNodeCliPath, ["--compiler-options", '{"module":"CommonJS"}', "prisma/seed.ts"]],
  ],
  reset: [
    [prismaCliPath, ["db", "push", "--force-reset"]],
    [tsNodeCliPath, ["--compiler-options", '{"module":"CommonJS"}', "prisma/seed.ts"]],
  ],
};

const mode = process.argv[2];
const steps = stepsByMode[mode];

if (!steps) {
  console.error("Usage: node scripts/db-runner.cjs <push|seed|setup|reset>");
  process.exit(1);
}

for (const [cliPath, args] of steps) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.signal) {
    process.exit(1);
  }
}
