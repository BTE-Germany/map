import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

declare global {
    // eslint-disable-next-line no-var
    var db: NodePgDatabase | undefined;
}

let db: NodePgDatabase;

if (process.env.NODE_ENV === 'production') {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });
    db = drizzle(pool);
} else {
    if (!globalThis.db) {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
        });
        globalThis.db = drizzle(pool);
    }
    db = globalThis.db!;
}

export default db;
