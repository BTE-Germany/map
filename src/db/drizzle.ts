import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

declare global {
    // eslint-disable-next-line no-var
    var db: NodePgDatabase | undefined;
}

let db: NodePgDatabase;

function getSslConfig() {
    const value = process.env.DATABASE_SSL?.toLowerCase();
    if (!value || value === "false" || value === "0" || value === "no") {
        return undefined;
    }

    return {
        rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
    };
}

// Bound the pool and per-statement time so a stuck upstream can't pin
// connections (and long-lived SSE handlers) open indefinitely.
function createPool() {
    return new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: getSslConfig(),
        max: 10,
        connectionTimeoutMillis: 5_000,
        statement_timeout: 15_000,
        query_timeout: 15_000,
    });
}

if (process.env.NODE_ENV === 'production') {
    db = drizzle(createPool());
} else {
    if (!globalThis.db) {
        globalThis.db = drizzle(createPool());
    }
    db = globalThis.db!;
}

export default db;
