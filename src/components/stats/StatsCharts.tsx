"use client";

import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import type { LandUseStats } from "@/db/schema";
import { stateCodeToName } from "@/lib/federalStates";

const TYPE_COLORS: Record<string, string> = {
    default: "#22c55e",
    plot: "#3b82f6",
    event: "#ef4444",
};

const TYPE_LABELS: Record<string, string> = {
    default: "Standard",
    plot: "Plot",
    event: "Event",
};

const LANDUSE_COLORS: Record<keyof LandUseStats, string> = {
    residential: "#f97316",
    forest: "#16a34a",
    farmland: "#a3e635",
    water: "#3b82f6",
    industrial: "#94a3b8",
    park: "#4ade80",
};

const LANDUSE_LABELS: Record<keyof LandUseStats, string> = {
    residential: "Wohngebiet",
    forest: "Wald",
    farmland: "Landwirtschaft",
    water: "Wasser",
    industrial: "Gewerbe",
    park: "Park",
};

function CustomTooltip({ active, payload, label, formatter }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border border-white/10 bg-neutral-950/90 backdrop-blur-md px-3 py-2 text-xs shadow-xl">
            {label !== undefined && (
                <p className="font-semibold text-neutral-300 mb-1">{label}</p>
            )}
            {payload.map((entry: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ backgroundColor: entry.color ?? entry.payload?.fill }} />
                    <span className="text-neutral-400">{entry.name}:</span>
                    <span className="text-white font-medium tabular-nums">
                        {formatter ? formatter(entry.value) : entry.value}
                    </span>
                </div>
            ))}
        </div>
    );
}

export function StateBarChart({
    data,
}: {
    data: Array<{ state: string; count: number; totalArea: number }>;
}) {
    const chartData = data.slice(0, 10).map((d) => ({
        state: d.state,
        label: stateCodeToName(d.state),
        count: d.count,
        area: d.totalArea / 1_000_000,
    }));

    return (
        <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                    dataKey="state"
                    tick={{ fill: "#737373", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                />
                <YAxis
                    tick={{ fill: "#737373", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                />
                <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    content={
                        <CustomTooltip
                            formatter={(v: number) => `${v.toFixed(2)} km²`}
                        />
                    }
                    labelFormatter={(l: string) => stateCodeToName(l)}
                />
                <Bar dataKey="area" name="Fläche" radius={[6, 6, 0, 0]} fill="#6366f1" />
            </BarChart>
        </ResponsiveContainer>
    );
}

export function TypeDonutChart({
    data,
}: {
    data: Array<{ type: string; count: number }>;
}) {
    const chartData = data.map((d) => ({
        name: TYPE_LABELS[d.type] ?? d.type,
        type: d.type,
        value: d.count,
    }));

    const total = chartData.reduce((s, d) => s + d.value, 0);

    return (
        <div className="relative">
            <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                    <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={68}
                        outerRadius={100}
                        strokeWidth={0}
                        paddingAngle={2}
                    >
                        {chartData.map((entry, i) => (
                            <Cell key={i} fill={TYPE_COLORS[entry.type] ?? "#6366f1"} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-3xl font-bold tabular-nums text-white">{total}</p>
                <p className="text-[10px] uppercase tracking-widest text-neutral-500">Regionen</p>
            </div>
        </div>
    );
}

export function TimelineChart({
    data,
}: {
    data: Array<{ month: string; created: number; finished: number }>;
}) {
    const chartData = data.map((d) => {
        const [y, m] = d.month.split("-");
        const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
        return {
            ...d,
            label: date.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }),
        };
    });

    return (
        <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                    dataKey="label"
                    tick={{ fill: "#737373", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                />
                <YAxis
                    tick={{ fill: "#737373", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                    type="monotone"
                    dataKey="created"
                    name="Erstellt"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                />
                <Line
                    type="monotone"
                    dataKey="finished"
                    name="Fertig"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}

export function LanduseStackedBar({ landuse }: { landuse: LandUseStats }) {
    const entries = (Object.keys(LANDUSE_LABELS) as (keyof LandUseStats)[])
        .map((key) => ({
            key,
            label: LANDUSE_LABELS[key],
            color: LANDUSE_COLORS[key],
            value: landuse[key] ?? 0,
        }))
        .filter((e) => e.value > 0);

    const total = entries.reduce((s, e) => s + e.value, 0);
    if (total === 0) {
        return <p className="text-sm text-neutral-500 text-center py-6">Noch keine Landuse-Daten</p>;
    }

    return (
        <div>
            <div className="h-3 w-full rounded-full overflow-hidden flex mb-5" style={{ gap: "2px" }}>
                {entries.map((e) => (
                    <div
                        key={e.key}
                        title={`${e.label}: ${((e.value / total) * 100).toFixed(1)}%`}
                        style={{ width: `${(e.value / total) * 100}%`, backgroundColor: e.color, flexShrink: 0 }}
                    />
                ))}
            </div>
            <div className="grid grid-cols-1 gap-y-2.5 sm:grid-cols-2 sm:gap-x-6">
                {entries.map((e) => {
                    const pct = (e.value / total) * 100;
                    const km2 = e.value / 1_000_000;
                    return (
                        <div key={e.key} className="flex items-center gap-2.5 text-xs">
                            <span
                                className="size-2.5 rounded-[3px] shrink-0"
                                style={{ backgroundColor: e.color }}
                            />
                            <span className="text-neutral-300 flex-1 truncate">{e.label}</span>
                            <span className="text-neutral-600 tabular-nums text-[11px]">
                                {km2 >= 1 ? `${km2.toFixed(2)} km²` : `${(e.value / 10_000).toFixed(1)} ha`}
                            </span>
                            <span className="text-neutral-400 tabular-nums font-medium w-11 text-right">
                                {pct.toFixed(1)}%
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
