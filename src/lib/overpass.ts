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

/**
 * Build a compact one-line diagnostic for a failed Overpass request. The key
 * signals for a 504: `elapsed` (a fast 504 = gateway rejection / dead upstream /
 * rate-limit; a slow one = a real upstream timeout), which `server`/`via`
 * emitted it (nginx vs cloudflare vs Overpass itself), any `retry-after`, and
 * the response body (Overpass errors are usually plain text naming the cause).
 */
function diagnose(err: unknown, elapsedMs: number): string {
    if (axios.isAxiosError(err)) {
        const r = err.response;
        const h = (r?.headers ?? {}) as Record<string, string>;
        let body = "";
        const data = r?.data;
        if (typeof data === "string") body = data.replace(/\s+/g, " ").trim().slice(0, 300);
        else if (data) {
            try { body = JSON.stringify(data).slice(0, 300); } catch { /* ignore */ }
        }
        return [
            `status=${r?.status ?? "(no response)"}`,
            `elapsed=${elapsedMs}ms`,
            err.code ? `code=${err.code}` : "",
            h["server"] ? `server=${h["server"]}` : "",
            h["via"] ? `via=${h["via"]}` : "",
            (h["x-cache"] ?? h["cf-cache-status"]) ? `cache=${h["x-cache"] ?? h["cf-cache-status"]}` : "",
            h["retry-after"] ? `retry-after=${h["retry-after"]}` : "",
            body ? `body="${body}"` : "",
        ].filter(Boolean).join(" ");
    }
    return `${getErrorMessage(err)} elapsed=${elapsedMs}ms`;
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
        const startedAt = Date.now();
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
            const elapsed = Date.now() - startedAt;
            const willRetry = attempt < attempts && isRetryable(err);
            // Always log (not just under DEBUG) so intermittent gateway 504s are
            // traceable — the elapsed time + server/body reveal the real cause.
            console.error(
                `[overpass] request failed (attempt ${attempt}/${attempts}${willRetry ? ", retrying" : ""}): ${diagnose(err, elapsed)}`,
            );
            if (willRetry) {
                // ~0.6s, 1.2s, 2.4s … plus jitter to avoid synchronized retries.
                const backoff = 600 * 2 ** (attempt - 1) + Math.floor(Math.random() * 300);
                await new Promise((resolve) => setTimeout(resolve, backoff));
                continue;
            }
            throw err;
        }
    }
    throw lastErr;
}
