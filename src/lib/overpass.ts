import axios from "axios";
import { getErrorMessage } from "@/lib/errors";

/**
 * Overpass returns 504 (gateway timeout) / 502 / 503 / 429 when the instance is
 * overloaded or a query queues behind others — these are transient, so a short
 * retry with exponential backoff recovers most of them instead of dropping the
 * region. Persistent failures (a genuinely too-heavy query) still throw after
 * the attempts are exhausted.
 */
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

function isRetryable(err: unknown): boolean {
    if (axios.isAxiosError(err)) {
        // No response → network error / client timeout (ECONNABORTED, ETIMEDOUT…).
        if (!err.response) return true;
        return RETRYABLE_STATUS.has(err.response.status);
    }
    return false;
}

export interface OverpassOptions {
    /** Per-attempt client timeout in ms (default 35s). */
    timeoutMs?: number;
    /** Total attempts including the first (default 3). */
    attempts?: number;
}

/**
 * POST an Overpass QL query and return the parsed JSON body, retrying transient
 * gateway/overload errors with exponential backoff + jitter.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function postOverpassQuery(query: string, opts: OverpassOptions = {}): Promise<any> {
    const url = process.env.OVERPASS_API_URL;
    if (!url) throw new Error("OVERPASS_API_URL is not configured");

    const timeout = opts.timeoutMs ?? 35_000;
    const attempts = Math.max(1, opts.attempts ?? 3);

    let lastErr: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const res = await axios.post(url, `data=${encodeURIComponent(query)}`, {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    apikey: process.env.OVERPASS_API_KEY,
                },
                timeout,
            });
            return res.data;
        } catch (err) {
            lastErr = err;
            if (attempt < attempts && isRetryable(err)) {
                // ~0.6s, 1.2s, 2.4s … plus jitter to avoid synchronized retries.
                const backoff = 600 * 2 ** (attempt - 1) + Math.floor(Math.random() * 300);
                if (process.env.DEBUG_OVERPASS) {
                    console.warn(`[overpass] attempt ${attempt} failed (${getErrorMessage(err)}); retrying in ${backoff}ms`);
                }
                await new Promise((resolve) => setTimeout(resolve, backoff));
                continue;
            }
            throw err;
        }
    }
    throw lastErr;
}
