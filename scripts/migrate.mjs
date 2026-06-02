import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required to run database migrations.");
  process.exit(1);
}

function getSslConfig() {
  const value = process.env.DATABASE_SSL?.toLowerCase();
  if (!value || value === "false" || value === "0" || value === "no") {
    return undefined;
  }

  return {
    rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
  };
}

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const pool = new Pool({
  connectionString,
  ssl: getSslConfig(),
});

try {
  console.log(`Running database migrations from ${migrationsFolder}`);
  await migrate(drizzle(pool), { migrationsFolder });
  console.log("Database migrations completed.");
} catch (error) {
  console.error("Database migrations failed.");
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
