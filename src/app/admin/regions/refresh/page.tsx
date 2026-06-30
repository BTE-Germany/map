"use client";

import { useState, useRef } from "react";
import { RefreshCw, AlertCircle, CheckCircle2, Loader2, LandPlot } from "lucide-react";

type LogEntry = { city: string; success: boolean; error?: string };
type Phase = "idle" | "running" | "done";

export default function AdminRegionsPage() {
    const [phase, setPhase] = useState<Phase>("idle");
    const [total, setTotal] = useState(0);
    const [done, setDone] = useState(0);
    const [errors, setErrors] = useState(0);
    const [log, setLog] = useState<LogEntry[]>([]);
    const abortRef = useRef<AbortController | null>(null);
    const logEndRef = useRef<HTMLDivElement>(null);

    async function startRefresh(mode: "all" | "missing" | "stale") {
        if (phase === "running") return;

        setPhase("running");
        setTotal(0);
        setDone(0);
        setErrors(0);
        setLog([]);

        abortRef.current = new AbortController();

        try {
            const res = await fetch("/api/admin/regions/refresh-metadata", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode }),
                signal: abortRef.current.signal,
            });

            if (!res.ok || !res.body) {
                const errText = await res.text().catch(() => `HTTP ${res.status}`);
                setLog([{ city: `Serverfehler: ${errText}`, success: false }]);
                setPhase("idle");
                return;
            }

            const reader = res.body.getReader();
            const dec = new TextDecoder();
            let buf = "";

            while (true) {
                const { done: streamDone, value } = await reader.read();
                if (streamDone) break;

                buf += dec.decode(value, { stream: true });
                const lines = buf.split("\n\n");
                buf = lines.pop() ?? "";

                for (const line of lines) {
                    const dataLine = line.replace(/^data: /, "").trim();
                    if (!dataLine) continue;
                    try {
                        const event = JSON.parse(dataLine);
                        if (event.type === "start") {
                            setTotal(event.total);
                        } else if (event.type === "progress") {
                            setDone(event.done);
                            if (!event.success) setErrors(e => e + 1);
                            setLog(prev => {
                                const next = [{ city: event.city, success: event.success, error: event.error }, ...prev].slice(0, 100);
                                return next;
                            });
                        } else if (event.type === "done") {
                            setDone(event.done);
                            setErrors(event.errors);
                            setPhase("done");
                        }
                    } catch {}
                }
            }
        } catch (e: unknown) {
            if (!(e instanceof Error) || e.name !== "AbortError") {
                const message = e instanceof Error ? e.message : String(e);
                setLog(prev => [{ city: `Verbindungsfehler: ${message}`, success: false }, ...prev]);
                setPhase("idle");
            }
        }
    }

    function stop() {
        abortRef.current?.abort();
        setPhase("idle");
    }

    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    return (
        <div className="max-w-3xl space-y-8">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <LandPlot className="size-5 text-primary" />
                    <h1 className="text-2xl font-bold">Regionen</h1>
                </div>
                <p className="text-muted-foreground text-sm">
                    Flächennutzungs-Metadaten über die Overpass API laden und in der Datenbank speichern.
                </p>
            </div>

            {/* Action buttons */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h2 className="font-semibold">Metadaten neu laden</h2>
                <p className="text-sm text-muted-foreground">
                    Ruft Flächennutzungsdaten (Wald, Wasser, Landwirtschaft, etc.) für jede Region über die Overpass API ab. Große Mengen können mehrere Minuten dauern.
                </p>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => startRefresh("missing")}
                        disabled={phase === "running"}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium transition-colors"
                    >
                        <RefreshCw className={`size-4 ${phase === "running" ? "animate-spin" : ""}`} />
                        Nur fehlende laden
                    </button>
                    <button
                        onClick={() => startRefresh("stale")}
                        disabled={phase === "running"}
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm transition-colors"
                    >
                        <RefreshCw className={`size-4 ${phase === "running" ? "animate-spin" : ""}`} />
                        Veraltete laden
                    </button>
                    <button
                        onClick={() => startRefresh("all")}
                        disabled={phase === "running"}
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm transition-colors"
                    >
                        <RefreshCw className={`size-4 ${phase === "running" ? "animate-spin" : ""}`} />
                        Alle neu laden
                    </button>
                    {phase === "running" && (
                        <button
                            onClick={stop}
                            className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 px-4 py-2 text-sm transition-colors"
                        >
                            Abbrechen
                        </button>
                    )}
                </div>
            </div>

            {/* Progress */}
            {phase !== "idle" && (
                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold">Fortschritt</h2>
                        <span className="text-sm text-muted-foreground tabular-nums">
                            {done} / {total}
                        </span>
                    </div>

                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${pct}%` }}
                        />
                    </div>

                    {phase === "done" && (
                        <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="size-4 text-emerald-400" />
                            <span>Fertig — {done - errors} erfolgreich, {errors} Fehler</span>
                        </div>
                    )}
                    {phase === "running" && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                            <span>Lädt Daten…</span>
                        </div>
                    )}

                    {/* Log */}
                    {log.length > 0 && (
                        <div className="rounded-lg border border-border bg-muted/20 max-h-64 overflow-y-auto p-3 space-y-1 font-mono text-xs">
                            {log.map((entry, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    {entry.success
                                        ? <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                                        : <AlertCircle className="size-3 text-red-400 shrink-0" />
                                    }
                                    <span className={entry.success ? "text-foreground" : "text-red-400"}>
                                        {entry.city}
                                        {entry.error && <span className="text-red-400/60 ml-1">— {entry.error}</span>}
                                    </span>
                                </div>
                            ))}
                            <div ref={logEndRef} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
