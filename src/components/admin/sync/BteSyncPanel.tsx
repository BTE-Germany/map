"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import {
    AlertCircle,
    CheckCircle2,
    Link2,
    Loader2,
    PlusCircle,
    RefreshCw,
    RotateCw,
    Search,
    Trash2,
    Upload,
} from "lucide-react";
import {
    getBteSyncOverview,
    retryRegionSync,
    setBteAutoSync,
    type BteSyncOverview,
} from "@/actions/sync/BteSync";

const ENDPOINT = "/api/admin/sync/bte";

/** Must match the phrase the API expects before it wipes the build team. */
const CLEAR_CONFIRMATION = "ALLE CLAIMS LOESCHEN";

type PlanAction = "create" | "update" | "adopt" | "unchanged";
type LogAction = PlanAction | "delete";

interface PlanSummary {
    localTotal: number;
    remoteTotal: number;
    create: number;
    update: number;
    adopt: number;
    unchanged: number;
    deletions: number;
    foreignClaims: number;
}

interface PlanItem {
    key: string;
    label: string;
    action: LogAction;
    reasons: string[];
}

interface LogEntry {
    label: string;
    action: LogAction;
    success: boolean;
    error?: string;
}

type Mode = "plan" | "apply" | "clear";
type Phase = "idle" | "planning" | "planned" | "applying" | "clearing" | "done";

const ACTION_META: Record<LogAction, { label: string; className: string }> = {
    create: { label: "Neu anlegen", className: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
    update: { label: "Aktualisieren", className: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
    adopt: { label: "Verknüpfen", className: "text-violet-400 border-violet-500/30 bg-violet-500/10" },
    unchanged: { label: "Unverändert", className: "text-muted-foreground border-border bg-muted/30" },
    delete: { label: "Löschen", className: "text-red-400 border-red-500/30 bg-red-500/10" },
};

function ActionBadge({ action }: { action: LogAction }) {
    const meta = ACTION_META[action];
    return (
        <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${meta.className}`}>
            {meta.label}
        </span>
    );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
    return (
        <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase font-medium tracking-wider text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tabular-nums mt-1.5">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
    );
}

export default function BteSyncPanel({ initialOverview }: { initialOverview: BteSyncOverview }) {
    const [overview, setOverview] = useState(initialOverview);
    const [phase, setPhase] = useState<Phase>("idle");
    const [summary, setSummary] = useState<PlanSummary | null>(null);
    const [items, setItems] = useState<PlanItem[]>([]);
    const [log, setLog] = useState<LogEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [done, setDone] = useState(0);
    const [errors, setErrors] = useState(0);
    const [fatal, setFatal] = useState<string | null>(null);
    const [clearConfirmation, setClearConfirmation] = useState("");
    const [togglePending, startToggle] = useTransition();
    const [retrying, setRetrying] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const configured = overview.config.configured;
    const busy = phase === "planning" || phase === "applying" || phase === "clearing";

    const refreshOverview = useCallback(async () => {
        try {
            setOverview(await getBteSyncOverview());
        } catch {
            // Overview is informational — a failed refresh shouldn't surface.
        }
    }, []);

    function toggleAutoSync(next: boolean) {
        startToggle(async () => {
            try {
                await setBteAutoSync(next);
                setOverview((prev) => ({ ...prev, autoSyncEnabled: next }));
            } catch (err) {
                setFatal(err instanceof Error ? err.message : String(err));
            }
        });
    }

    async function run(mode: Mode) {
        if (busy) return;

        setPhase(mode === "plan" ? "planning" : mode === "clear" ? "clearing" : "applying");
        setSummary(null);
        setItems([]);
        setLog([]);
        setTotal(0);
        setDone(0);
        setErrors(0);
        setFatal(null);

        abortRef.current = new AbortController();

        try {
            const res = await fetch(ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    mode === "clear" ? { mode, confirm: clearConfirmation.trim() } : { mode },
                ),
                signal: abortRef.current.signal,
            });

            if (!res.ok || !res.body) {
                setFatal(await res.text().catch(() => `HTTP ${res.status}`));
                setPhase("idle");
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done: streamDone, value } = await reader.read();
                if (streamDone) break;

                buffer += decoder.decode(value, { stream: true });
                const chunks = buffer.split("\n\n");
                buffer = chunks.pop() ?? "";

                for (const chunk of chunks) {
                    const line = chunk.replace(/^data: /, "").trim();
                    if (!line) continue;

                    let event: Record<string, unknown>;
                    try {
                        event = JSON.parse(line);
                    } catch {
                        continue;
                    }

                    switch (event.type) {
                        case "start":
                            setTotal(event.total as number);
                            setSummary(event.summary as PlanSummary);
                            break;
                        case "item":
                            setItems((prev) => [
                                ...prev,
                                {
                                    key: event.regionId as string,
                                    label: event.label as string,
                                    action: event.action as PlanAction,
                                    reasons: (event.reasons as string[]) ?? [],
                                },
                            ]);
                            break;
                        case "deletion":
                            setItems((prev) => [
                                ...prev,
                                {
                                    key: `del-${event.claimId as string}`,
                                    label: event.label as string,
                                    action: "delete",
                                    reasons: ["Region lokal gelöscht"],
                                },
                            ]);
                            break;
                        case "progress":
                            setDone(event.done as number);
                            if (!event.success) setErrors((e) => e + 1);
                            setLog((prev) =>
                                [
                                    {
                                        label: event.label as string,
                                        action: event.action as LogAction,
                                        success: event.success as boolean,
                                        error: event.error as string | undefined,
                                    },
                                    ...prev,
                                ].slice(0, 200),
                            );
                            break;
                        case "done":
                            setDone(event.done as number);
                            setErrors(event.errors as number);
                            setSummary(event.summary as PlanSummary);
                            setPhase(mode === "plan" ? "planned" : "done");
                            break;
                        case "error":
                            setFatal(event.message as string);
                            setPhase("idle");
                            break;
                    }
                }
            }
        } catch (err) {
            if (!(err instanceof Error) || err.name !== "AbortError") {
                setFatal(err instanceof Error ? err.message : String(err));
                setPhase("idle");
            }
        }

        if (mode !== "plan") {
            setClearConfirmation("");
            await refreshOverview();
        }
    }

    async function retry(regionId: string) {
        setRetrying(regionId);
        try {
            await retryRegionSync(regionId);
            await refreshOverview();
        } catch (err) {
            setFatal(err instanceof Error ? err.message : String(err));
        } finally {
            setRetrying(null);
        }
    }

    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const nothingToDo = phase === "planned" && items.length === 0;

    return (
        <div className="max-w-3xl space-y-8">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <Upload className="size-5 text-primary" />
                    <h1 className="text-2xl font-bold">BTE-Sync</h1>
                </div>
                <p className="text-muted-foreground text-sm">
                    Überträgt unsere Regionen als Claims auf die Haupt-Karte von BuildTheEarth.
                </p>
            </div>

            {!configured && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3">
                    <AlertCircle className="size-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-medium text-amber-200">Sync ist nicht konfiguriert</p>
                        <p className="text-amber-200/70 mt-1">
                            Setze <code className="font-mono text-xs">BTE_TEAM_TOKEN</code> und{" "}
                            <code className="font-mono text-xs">BTE_TEAM_SLUG</code> (oder{" "}
                            <code className="font-mono text-xs">BTE_TEAM_ID</code>) in der Umgebung.
                        </p>
                    </div>
                </div>
            )}

            {/* Status */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat label="Regionen" value={overview.regionCount} />
                <Stat label="Synchronisiert" value={overview.syncedCount} />
                <Stat label="Ausstehend" value={overview.pendingCount + overview.neverSyncedCount} />
                <Stat label="Fehler" value={overview.errorCount} />
            </div>

            {/* Auto sync toggle */}
            <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="font-semibold">Automatischer Sync</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Neue Regionen sowie Änderungen an Polygon, Beschreibung, Status, Ersteller und Buildern
                            werden sofort an die BTE-Karte übertragen. Gelöschte Regionen werden dort entfernt.
                        </p>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={overview.autoSyncEnabled}
                        aria-label="Automatischen Sync umschalten"
                        disabled={!configured || togglePending}
                        onClick={() => toggleAutoSync(!overview.autoSyncEnabled)}
                        className={`relative shrink-0 h-6 w-11 rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            overview.autoSyncEnabled
                                ? "bg-primary border-primary"
                                : "bg-muted border-border"
                        }`}
                    >
                        <span
                            className={`absolute top-0.5 size-4.5 rounded-full bg-background transition-transform ${
                                overview.autoSyncEnabled ? "translate-x-5.5" : "translate-x-0.5"
                            }`}
                        />
                    </button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                    Status:{" "}
                    <span className={overview.autoSyncEnabled ? "text-emerald-400" : "text-muted-foreground"}>
                        {overview.autoSyncEnabled ? "aktiv" : "deaktiviert"}
                    </span>
                    {overview.lastSyncedAt && (
                        <> · Zuletzt übertragen: {new Date(overview.lastSyncedAt).toLocaleString("de-DE")}</>
                    )}
                </p>
            </div>

            {/* Manual sync */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h2 className="font-semibold">Manueller Abgleich</h2>
                <p className="text-sm text-muted-foreground">
                    Lädt alle Claims unseres Teams von der BTE-API und vergleicht sie mit unseren Regionen.
                    Regionen, die dort bereits exakt so existieren, werden übersprungen; ein Claim ohne
                    Verknüpfung, der dieselbe Fläche beschreibt, wird verknüpft statt doppelt angelegt.
                    Claims, deren Region bei uns nicht mehr existiert, werden gelöscht.
                </p>

                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => run("plan")}
                        disabled={!configured || busy}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium transition-colors"
                    >
                        {phase === "planning" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                        Abgleich prüfen
                    </button>
                    <button
                        onClick={() => run("apply")}
                        disabled={!configured || busy}
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm transition-colors"
                    >
                        {phase === "applying" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                        Jetzt synchronisieren
                    </button>
                    {busy && (
                        <button
                            onClick={() => {
                                abortRef.current?.abort();
                                setPhase("idle");
                            }}
                            className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 px-4 py-2 text-sm transition-colors"
                        >
                            Abbrechen
                        </button>
                    )}
                </div>

                {fatal && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 flex gap-2">
                        <AlertCircle className="size-4 shrink-0 mt-0.5" />
                        <span className="break-words">{fatal}</span>
                    </div>
                )}
            </div>

            {/* Plan summary */}
            {summary && (
                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold">Ergebnis des Vergleichs</h2>
                        <span className="text-xs text-muted-foreground tabular-nums">
                            {summary.localTotal} lokal · {summary.remoteTotal} auf der BTE-Karte
                        </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                            <div className="flex items-center gap-1.5 text-emerald-400">
                                <PlusCircle className="size-3.5" />
                                <span className="text-xs">Neu</span>
                            </div>
                            <p className="text-xl font-bold tabular-nums mt-1">{summary.create}</p>
                        </div>
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                            <div className="flex items-center gap-1.5 text-amber-400">
                                <RefreshCw className="size-3.5" />
                                <span className="text-xs">Geändert</span>
                            </div>
                            <p className="text-xl font-bold tabular-nums mt-1">{summary.update}</p>
                        </div>
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                            <div className="flex items-center gap-1.5 text-violet-400">
                                <Link2 className="size-3.5" />
                                <span className="text-xs">Verknüpfen</span>
                            </div>
                            <p className="text-xl font-bold tabular-nums mt-1">{summary.adopt}</p>
                        </div>
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <CheckCircle2 className="size-3.5" />
                                <span className="text-xs">Bereits identisch</span>
                            </div>
                            <p className="text-xl font-bold tabular-nums mt-1">{summary.unchanged}</p>
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                        {summary.deletions > 0 && <>{summary.deletions} verwaiste Claims werden gelöscht · </>}
                        {summary.foreignClaims} fremde Claims auf der BTE-Karte bleiben unangetastet.
                    </p>

                    {nothingToDo && (
                        <div className="flex items-center gap-2 text-sm text-emerald-400">
                            <CheckCircle2 className="size-4" />
                            Alles aktuell — jede Region existiert auf der BTE-Karte bereits genau so.
                        </div>
                    )}

                    {items.length > 0 && (
                        <div className="rounded-lg border border-border bg-muted/20 max-h-72 overflow-y-auto divide-y divide-border">
                            {items.map((item) => (
                                <div key={item.key} className="flex items-center gap-2 px-3 py-2 text-xs">
                                    <ActionBadge action={item.action} />
                                    <span className="truncate">{item.label}</span>
                                    {item.reasons.length > 0 && (
                                        <span className="text-muted-foreground truncate ml-auto pl-2">
                                            {item.reasons.join(", ")}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Apply progress */}
            {(phase === "applying" || phase === "clearing" || phase === "done") && (
                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold">{phase === "clearing" ? "Wird gelöscht" : "Übertragung"}</h2>
                        <span className="text-sm text-muted-foreground tabular-nums">{done} / {total}</span>
                    </div>

                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${pct}%` }}
                        />
                    </div>

                    {phase === "done" ? (
                        <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="size-4 text-emerald-400" />
                            <span>Fertig — {done - errors} erfolgreich, {errors} Fehler</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                            <span>{phase === "clearing" ? "Löscht…" : "Überträgt…"}</span>
                        </div>
                    )}

                    {log.length > 0 && (
                        <div className="rounded-lg border border-border bg-muted/20 max-h-64 overflow-y-auto p-3 space-y-1 font-mono text-xs">
                            {log.map((entry, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    {entry.success
                                        ? <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                                        : <AlertCircle className="size-3 text-red-400 shrink-0" />}
                                    <ActionBadge action={entry.action} />
                                    <span className={entry.success ? "truncate" : "truncate text-red-400"}>
                                        {entry.label}
                                        {entry.error && <span className="text-red-400/60 ml-1">— {entry.error}</span>}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Persistent failures */}
            {overview.failures.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="size-4 text-red-400" />
                        <h2 className="font-semibold">Fehlgeschlagene Übertragungen</h2>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 divide-y divide-border">
                        {overview.failures.map((failure) => (
                            <div key={failure.regionId} className="flex items-start gap-3 px-3 py-2.5 text-xs">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium">{failure.label}</p>
                                    <p className="text-red-400/80 break-words mt-0.5">{failure.error}</p>
                                    {failure.lastAttemptAt && (
                                        <p className="text-muted-foreground mt-0.5">
                                            {new Date(failure.lastAttemptAt).toLocaleString("de-DE")}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => retry(failure.regionId)}
                                    disabled={retrying === failure.regionId}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 hover:bg-muted/60 disabled:opacity-50 px-2 py-1 transition-colors shrink-0"
                                >
                                    {retrying === failure.regionId
                                        ? <Loader2 className="size-3 animate-spin" />
                                        : <RotateCw className="size-3" />}
                                    Erneut
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Danger zone */}
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <Trash2 className="size-4 text-red-400" />
                    <h2 className="font-semibold text-red-200">Alle Claims des Build Teams löschen</h2>
                </div>
                <p className="text-sm text-red-200/70">
                    Entfernt <strong>jeden</strong> Claim unseres Build Teams von der BTE-Karte — auch solche,
                    die dort direkt angelegt wurden und nicht von uns stammen. Lokale Regionen bleiben
                    unberührt; ein anschließender Abgleich legt sie alle neu an. Nicht rückgängig zu machen.
                </p>

                {overview.autoSyncEnabled && (
                    <p className="text-xs text-amber-300/80">
                        Hinweis: Der automatische Sync ist aktiv — neue oder geänderte Regionen landen danach
                        sofort wieder auf der BTE-Karte.
                    </p>
                )}

                <label className="block text-sm">
                    <span className="text-red-200/70">
                        Zum Bestätigen <code className="font-mono text-xs text-red-200">{CLEAR_CONFIRMATION}</code>{" "}
                        eingeben:
                    </span>
                    <input
                        type="text"
                        value={clearConfirmation}
                        disabled={!configured || busy}
                        onChange={(e) => setClearConfirmation(e.target.value)}
                        placeholder={CLEAR_CONFIRMATION}
                        autoComplete="off"
                        spellCheck={false}
                        className="mt-1.5 w-full max-w-xs rounded-lg border border-red-500/30 bg-background px-3 py-2 text-sm font-mono outline-none focus:border-red-500/60 disabled:opacity-50"
                    />
                </label>

                <button
                    onClick={() => run("clear")}
                    disabled={!configured || busy || clearConfirmation.trim() !== CLEAR_CONFIRMATION}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium transition-colors"
                >
                    {phase === "clearing" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    Alle Claims löschen
                </button>
            </div>

            {configured && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Link2 className="size-3" />
                    Team <span className="font-mono">{overview.config.team}</span> · {overview.config.baseUrl}
                </p>
            )}
        </div>
    );
}
