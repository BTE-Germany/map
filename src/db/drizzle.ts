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

if (process.env.NODE_ENV === 'production') {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: getSslConfig(),
    });
    db = drizzle(pool);
} else {
    if (!globalThis.db) {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: getSslConfig(),
        });
        globalThis.db = drizzle(pool);
    }
    db = globalThis.db!;
}

export default db;
