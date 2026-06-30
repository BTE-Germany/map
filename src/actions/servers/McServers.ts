"use server";

import { randomBytes } from "crypto";
import { asc, eq } from "drizzle-orm";
import db from "@/db/drizzle";
import { mcServer } from "@/db/schema";
import { requirePermission } from "@/lib/guards";
import { PERMISSIONS } from "@/lib/permissions";
import { hashToken } from "@/lib/mcAuth";

export interface McServerSummary {
    id: string;
    key: string;
    name: string;
    states: string[];
    hasToken: boolean;
    tokenRotatedAt: string | null;
    createdAt: string;
}

async function requireAdmin(): Promise<void> {
    await requirePermission(PERMISSIONS.SERVERS_MANAGE);
}

const KEY_PATTERN = /^[a-z0-9][a-z0-9-_]{0,62}[a-z0-9]$/;
const STATE_PATTERN = /^[A-Z]{2}$/;

function normalizeStates(states: string[]): string[] {
    return Array.from(new Set(states.map((s) => s.trim().toUpperCase())))
        .filter((s) => STATE_PATTERN.test(s))
        .sort();
}

export async function listServers(): Promise<McServerSummary[]> {
    await requireAdmin();
    const rows = await db!.select().from(mcServer).orderBy(asc(mcServer.name));
    return rows.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        states: r.states ?? [],
        hasToken: !!r.tokenHash,
        tokenRotatedAt: r.tokenRotatedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
    }));
}

export interface CreateServerInput {
    key: string;
    name: string;
    states: string[];
}

export async function createServer(input: CreateServerInput): Promise<{ id: string }> {
    await requireAdmin();
    const key = input.key.trim().toLowerCase();
    const name = input.name.trim();

    if (!KEY_PATTERN.test(key)) throw new Error("Ungültiger Schlüssel (a-z, 0-9, -, _ — 2–64 Zeichen)");
    if (name.length < 1 || name.length > 128) throw new Error("Name muss 1–128 Zeichen lang sein");

    const existing = await db!
        .select({ id: mcServer.id })
        .from(mcServer)
        .where(eq(mcServer.key, key))
        .limit(1);
    if (existing.length > 0) throw new Error("Schlüssel ist bereits vergeben");

    const inserted = await db!
        .insert(mcServer)
        .values({
            key,
            name,
            states: normalizeStates(input.states),
        })
        .returning({ id: mcServer.id });

    return { id: inserted[0].id };
}

export interface UpdateServerInput {
    id: string;
    name: string;
    states: string[];
}

export async function updateServer(input: UpdateServerInput): Promise<void> {
    await requireAdmin();
    const name = input.name.trim();
    if (name.length < 1 || name.length > 128) throw new Error("Name muss 1–128 Zeichen lang sein");

    await db!
        .update(mcServer)
        .set({ name, states: normalizeStates(input.states) })
        .where(eq(mcServer.id, input.id));
}

export async function deleteServer(id: string): Promise<void> {
    await requireAdmin();
    await db!.delete(mcServer).where(eq(mcServer.id, id));
}

/**
 * Generates a fresh bearer token, stores its SHA-256 hash, and returns the
 * plain token to the caller exactly once. The plain value is never persisted
 * anywhere — losing this response means having to rotate again.
 */
export async function rotateServerToken(id: string): Promise<{ token: string }> {
    await requireAdmin();

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);

    const updated = await db!
        .update(mcServer)
        .set({ tokenHash, tokenRotatedAt: new Date() })
        .where(eq(mcServer.id, id))
        .returning({ id: mcServer.id });

    if (updated.length === 0) throw new Error("Server nicht gefunden");
    return { token };
}
