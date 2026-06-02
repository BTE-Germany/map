import { getSession } from "@/lib/auth";
import { getRegionLanduseStats } from "@/actions/region/GetRegions";
import { getRegionCountByCreator } from "@/actions/region/GetRegions";
import { LayoutDashboard, LandPlot, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import db from "@/db/drizzle";
import { region } from "@/db/schema";
import { count } from "drizzle-orm";

async function getTotalRegionCount() {
    const res = await db?.select({ count: count() }).from(region);
    return res?.[0]?.count ?? 0;
}

export default async function AdminPage() {
    const [session, landuseStats, totalRegions] = await Promise.all([
        getSession(),
        getRegionLanduseStats(),
        getTotalRegionCount(),
    ]);

    const metadataPct = landuseStats.total > 0
        ? Math.round((landuseStats.withData / landuseStats.total) * 100)
        : 0;

    return (
        <div className="max-w-4xl space-y-8">
            <div>
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Willkommen, {session?.user.preferred_username}
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs uppercase font-medium tracking-wider text-muted-foreground">Regionen gesamt</p>
                        <div className="size-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                            <LandPlot className="size-3.5 text-blue-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold tabular-nums">{totalRegions}</p>
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs uppercase font-medium tracking-wider text-muted-foreground">Mit Flächendaten</p>
                        <div className="size-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <CheckCircle2 className="size-3.5 text-emerald-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold tabular-nums">{landuseStats.withData}</p>
                    <div className="mt-2.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${metadataPct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">{metadataPct}%</span>
                    </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs uppercase font-medium tracking-wider text-muted-foreground">Ohne Flächendaten</p>
                        <div className="size-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                            <AlertCircle className="size-3.5 text-amber-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold tabular-nums">{landuseStats.missing}</p>
                    {landuseStats.missing > 0 && (
                        <Link href="/admin/regions" className="mt-2 text-xs text-amber-400 hover:text-amber-300 transition-colors">
                            Jetzt laden →
                        </Link>
                    )}
                </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="font-semibold mb-1">Schnellaktionen</h2>
                <p className="text-sm text-muted-foreground mb-4">Direkte Verwaltungsaktionen</p>
                <div className="flex flex-wrap gap-3">
                    <Link
                        href="/admin/regions"
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 px-4 py-2 text-sm transition-colors"
                    >
                        <LandPlot className="size-4" />
                        Regionen verwalten
                    </Link>
                </div>
            </div>
        </div>
    );
}
