import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// CLI-only config (migrate, studio). Uses the DIRECT (non-pooled) connection
// because PgBouncer can't run DDL. The runtime client uses the pooled
// DATABASE_URL via the pg driver adapter in lib/prisma.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
