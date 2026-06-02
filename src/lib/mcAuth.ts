import { createHash, timingSafeEqual } from "crypto";
import db from "@/db/drizzle";
import { mcServer } from "@/db/schema";

export interface McAuthContext {
    serverId: string;
    serverKey: string;
    serverName: string;
    serverStates: string[];
}

export function hashToken(plain: string): string {
    return createHash("sha256").update(plain, "utf8").digest("hex");
}

function safeHexEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    try {
        return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
    } catch {
        return false;
    }
}

/**
 * Env-var fallback for migration/recovery. A server with `key = "ost"` can
 * still authenticate with `MC_API_TOKEN_OST=...` if its DB row has no hash
 * yet. Once a token has been rotated via the admin UI the env var is ignored.
 */
function envTokenFor(serverKey: string): string | null {
    const direct = process.env[`MC_API_TOKEN_${serverKey.toUpperCase()}`];
    if (direct && direct.length > 0) return direct;

    const mapJson = process.env.MC_API_TOKENS;
    if (mapJson) {
        try {
            const parsed = JSON.parse(mapJson) as Record<string, string>;
            const v = parsed[serverKey];
            if (v) return v;
        } catch {
            // ignore — bad JSON shouldn't lock everyone out
        }
    }
    return null;
}

function constantTimeEquals(a: string, b: string): boolean {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    try {
        return timingSafeEqual(ba, bb);
    } catch {
        return false;
    }
}

export async function verifyMcToken(plain: string | null | undefined): Promise<McAuthContext | null> {
    if (!plain) return null;
    const presentedHash = hashToken(plain);

    const servers = await db!.select().from(mcServer);
    for (const s of servers) {
        if (s.tokenHash) {
            if (!safeHexEqual(presentedHash, s.tokenHash)) continue;
        } else {
            const envToken = envTokenFor(s.key);
            if (!envToken || !constantTimeEquals(plain, envToken)) continue;
        }
        return {
            serverId: s.id,
            serverKey: s.key,
            serverName: s.name,
            serverStates: s.states ?? [],
        };
    }
    return null;
}

export function bearerFromRequest(req: Request): string | null {
    const h = req.headers.get("authorization") ?? req.headers.get("x-mc-token");
    if (!h) return null;
    if (h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
    return h.trim();
}

export async function requireMcAuth(req: Request): Promise<McAuthContext> {
    const ctx = await verifyMcToken(bearerFromRequest(req));
    if (!ctx) {
        throw new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
        });
    }
    return ctx;
}

/**
 * Optional: enforce that the calling proxy/CDN already validated a client
 * cert. Set `MC_REQUIRE_MTLS_HEADER=1` and configure your reverse proxy to
 * forward `X-SSL-Client-Verify: SUCCESS` when it has accepted a client cert.
 * Optionally pin the expected subject DN via `MC_MTLS_EXPECTED_SUBJECT`.
 */
export function checkMtlsHeader(req: Request): { ok: true } | { ok: false; reason: string } {
    if (process.env.MC_REQUIRE_MTLS_HEADER !== "1") return { ok: true };

    const verify = req.headers.get("x-ssl-client-verify");
    if (verify?.toUpperCase() !== "SUCCESS") {
        return { ok: false, reason: "missing X-SSL-Client-Verify=SUCCESS" };
    }

    const expected = process.env.MC_MTLS_EXPECTED_SUBJECT;
    if (expected) {
        const subject = req.headers.get("x-ssl-client-s-dn") ?? "";
        if (subject !== expected) {
            return { ok: false, reason: "client cert subject mismatch" };
        }
    }
    return { ok: true };
}
