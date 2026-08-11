"use client";

import { useMemo, useRef, useState } from "react";
import { Building2, LandPlot, Map as MapIcon, MousePointerClick } from "lucide-react";
import statePaths from "@/data/germanStatePaths.json";
import type { StateStats } from "@/lib/stateStats";
import StateDetailPanel from "./StateDetailPanel";
import {
    HEAT_EMPTY,
    HEAT_STEPS,
    METRIC_ORDER,
    STATE_METRICS,
    formatAreaShort,
    formatCoverage,
    formatNumber,
    heatColor,
    heatIndex,
    type MetricKey,
} from "./stateMetrics";

/**
 * Ab diesem einbeschriebenen Radius (viewBox-Einheiten) passt das Länderkürzel
 * in die Fläche. Die drei Stadtstaaten liegen darunter — sie bleiben
 * unbeschriftet und werden über Tooltip und Tabelle identifiziert.
 */
const LABEL_MIN_RADIUS = 30;

const METRIC_ICONS: Record<MetricKey, React.ReactNode> = {
    area: <LandPlot className="size-3.5" />,
    buildings: <Building2 className="size-3.5" />,
    regions: <MapIcon className="size-3.5" />,
};

type Hovered = { code: string; x: number; y: number; below: boolean } | null;

/**
 * Halbe geschätzte Tooltipbreite. Der Tooltip wird um seine Mitte positioniert;
 * ohne diesen Rand würde er am Kartenrand vom `overflow-hidden` der Section
 * abgeschnitten.
 */
const TOOLTIP_MARGIN = 110;
/** Darüber ist über dem Zeiger kein Platz mehr — der Tooltip klappt nach unten. */
const TOOLTIP_FLIP_Y = 90;

function MetricTabs({
    active,
    onChange,
}: {
    active: MetricKey;
    onChange: (key: MetricKey) => void;
}) {
    return (
        <div
            role="group"
            aria-label="Kennzahl der Heatmap"
            className="grid w-full grid-cols-3 gap-1 rounded-xl border border-white/[0.06] bg-white/[0.04] p-1 sm:inline-flex sm:w-auto"
        >
            {METRIC_ORDER.map((key) => {
                const metric = STATE_METRICS[key];
                const isActive = key === active;
                return (
                    <button
                        key={key}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => onChange(key)}
                        className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${isActive ? "bg-white/[0.09] text-white" : "text-neutral-400 hover:text-neutral-200"
                            }`}
                    >
                        <span className={isActive ? "text-sky-300" : ""}>{METRIC_ICONS[key]}</span>
                        {metric.label}
                    </button>
                );
            })}
        </div>
    );
}

function Legend({ max, format, legendLabel }: { max: number; format: (v: number) => string; legendLabel: string }) {
    return (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-neutral-600">wenig</span>
                <div className="flex gap-[2px]">
                    {HEAT_STEPS.map((color, i) => {
                        // Umkehrung der Wurzelskala: so steht am Feld, ab welchem
                        // Wert seine Farbe gilt.
                        const from = max * ((i / HEAT_STEPS.length) ** 2);
                        const to = max * (((i + 1) / HEAT_STEPS.length) ** 2);
                        return (
                            <span
                                key={color}
                                title={`${format(from)} – ${format(to)}`}
                                className="h-2.5 w-6 rounded-[2px] ring-1 ring-inset ring-white/[0.06]"
                                style={{ backgroundColor: color }}
                            />
                        );
                    })}
                </div>
                <span className="text-[10px] uppercase tracking-widest text-neutral-600">viel</span>
            </div>

            <p className="text-[11px] tabular-nums text-neutral-500">
                Maximum: <span className="text-neutral-300">{format(max)}</span> {legendLabel}
            </p>

            <div className="flex items-center gap-1.5">
                <span
                    className="h-2.5 w-6 rounded-[2px] ring-1 ring-inset ring-white/10"
                    style={{ backgroundColor: HEAT_EMPTY }}
                />
                <span className="text-[11px] text-neutral-500">keine Regionen</span>
            </div>
        </div>
    );
}

export default function GermanyHeatmap({ states }: { states: StateStats[] }) {
    const [metricKey, setMetricKey] = useState<MetricKey>("area");
    const [hovered, setHovered] = useState<Hovered>(null);
    const [focusedCode, setFocusedCode] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const metric = STATE_METRICS[metricKey];

    const byCode = useMemo(() => new Map(states.map((s) => [s.code, s])), [states]);

    // Vorauswahl: das Land mit der meisten Fläche — so ist die Detailansicht nie
    // leer und zeigt gleich, was ein Klick bringt.
    const [selectedCode, setSelectedCode] = useState(() => {
        const busiest = [...states].sort((a, b) => b.totalArea - a.totalArea)[0];
        return busiest?.code ?? "BE";
    });

    const max = useMemo(
        () => states.reduce((m, s) => Math.max(m, metric.value(s)), 0),
        [states, metric],
    );

    const ranked = useMemo(
        () => [...states].sort((a, b) => metric.value(b) - metric.value(a)),
        [states, metric],
    );

    const selected = byCode.get(selectedCode) ?? states[0];
    const hoveredState = hovered ? byCode.get(hovered.code) : undefined;

    const smallSelected = statePaths.states.find(
        (geo) => geo.code === selectedCode && geo.labelRadius < LABEL_MIN_RADIUS,
    );

    function handlePointer(code: string, event: React.PointerEvent) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        setHovered({
            code,
            x: Math.min(Math.max(x, TOOLTIP_MARGIN), Math.max(TOOLTIP_MARGIN, rect.width - TOOLTIP_MARGIN)),
            y,
            below: y < TOOLTIP_FLIP_Y,
        });
    }

    return (
        <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.04] px-5 py-3.5">
                <div className="flex items-center gap-2">
                    <MapIcon className="size-4 text-neutral-400" />
                    <div>
                        <p className="text-sm font-medium text-white">Aktivität nach Bundesland</p>
                        <p className="text-[11px] text-neutral-500">
                            Ein Klick auf ein Bundesland zeigt die Details darunter
                        </p>
                    </div>
                </div>
                <MetricTabs active={metricKey} onChange={setMetricKey} />
            </div>

            <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-6">
                {/* Karte */}
                <div className="flex flex-col gap-4">
                    <div ref={containerRef} className="relative" onPointerLeave={() => setHovered(null)}>
                        <svg
                            viewBox={`0 0 ${statePaths.viewBox.width} ${statePaths.viewBox.height}`}
                            className="h-auto w-full max-h-[62vh]"
                            role="group"
                            aria-label="Deutschlandkarte der Bundesländer"
                        >
                            {statePaths.states.map((geo) => {
                                const stats = byCode.get(geo.code);
                                const value = stats ? metric.value(stats) : 0;
                                const isSelected = geo.code === selectedCode;
                                // Tastaturfokus wird wie Hover behandelt, damit die
                                // Hervorhebung nicht nur an der Maus hängt.
                                const isActive = hovered?.code === geo.code || focusedCode === geo.code;

                                return (
                                    <path
                                        key={geo.code}
                                        d={geo.path}
                                        fillRule="evenodd"
                                        fill={heatColor(value, max)}
                                        stroke={isSelected ? "#ffffff" : isActive ? "rgba(255,255,255,0.55)" : "#0a0a0a"}
                                        strokeWidth={isSelected ? 2 : 1}
                                        strokeLinejoin="round"
                                        vectorEffect="non-scaling-stroke"
                                        role="button"
                                        tabIndex={0}
                                        aria-pressed={isSelected}
                                        aria-label={`${geo.name}: ${metric.format(value)} ${metric.legend}`}
                                        onClick={() => setSelectedCode(geo.code)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                setSelectedCode(geo.code);
                                            }
                                        }}
                                        onPointerEnter={(event) => handlePointer(geo.code, event)}
                                        onPointerMove={(event) => handlePointer(geo.code, event)}
                                        onFocus={() => setFocusedCode(geo.code)}
                                        onBlur={() => setFocusedCode(null)}
                                        className="cursor-pointer outline-none transition-[filter] duration-150"
                                        style={{
                                            filter: [
                                                isSelected ? "drop-shadow(0 0 6px rgba(255,255,255,0.35))" : "",
                                                isActive ? "brightness(1.25)" : "",
                                            ]
                                                .filter(Boolean)
                                                .join(" ") || undefined,
                                        }}
                                    />
                                );
                            })}

                            {statePaths.states
                                .filter((geo) => geo.labelRadius >= LABEL_MIN_RADIUS)
                                .map((geo) => (
                                    <text
                                        key={geo.code}
                                        x={geo.labelX}
                                        y={geo.labelY}
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        fontSize={26}
                                        fontWeight={600}
                                        fill="rgba(255,255,255,0.92)"
                                        stroke="rgba(0,0,0,0.55)"
                                        strokeWidth={3}
                                        paintOrder="stroke"
                                        className="pointer-events-none select-none"
                                    >
                                        {geo.code}
                                    </text>
                                ))}

                            {/* Die Stadtstaaten sind so klein, dass die Auswahlkontur
                                allein nicht auffällt — ein Ring zeigt, wo sie liegen. */}
                            {smallSelected && (
                                <circle
                                    cx={smallSelected.labelX}
                                    cy={smallSelected.labelY}
                                    r={46}
                                    fill="none"
                                    stroke="rgba(255,255,255,0.7)"
                                    strokeWidth={1.5}
                                    vectorEffect="non-scaling-stroke"
                                    className="pointer-events-none"
                                />
                            )}
                        </svg>

                        {hovered && hoveredState && (
                            <div
                                className={`pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-neutral-950/95 px-3 py-2 text-xs shadow-xl backdrop-blur-md ${hovered.below ? "translate-y-3" : "-translate-y-[calc(100%+12px)]"
                                    }`}
                                style={{ left: hovered.x, top: hovered.y }}
                            >
                                <p className="font-semibold text-white">{hoveredState.name}</p>
                                <p className="mt-0.5 flex items-center gap-1.5 text-neutral-400">
                                    <span
                                        className="size-2 rounded-full"
                                        style={{ backgroundColor: heatColor(metric.value(hoveredState), max) }}
                                    />
                                    <span className="tabular-nums text-white">
                                        {metric.format(metric.value(hoveredState))}
                                    </span>
                                    {metric.legend}
                                </p>
                                <p className="mt-0.5 text-[11px] tabular-nums text-neutral-500">
                                    {formatNumber(hoveredState.regions)} Regionen ·{" "}
                                    {formatCoverage(
                                        hoveredState.officialArea
                                            ? (hoveredState.finishedArea / hoveredState.officialArea) * 100
                                            : 0,
                                    )}{" "}
                                    fertig
                                </p>
                            </div>
                        )}
                    </div>

                    <Legend max={max} format={metric.format} legendLabel={metric.legend} />
                </div>

                {/* Detailansicht des ausgewählten Landes */}
                {selected && <StateDetailPanel state={selected} />}
            </div>

            {/* Tabellenansicht: dieselben Zahlen im Klartext — die Karte allein
                trägt die Werte nur über Farbe, das reicht nicht. */}
            <div className="border-t border-white/[0.04] px-2 pb-4 pt-2 sm:px-5">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[34rem] border-collapse text-sm">
                        <caption className="sr-only">
                            Alle Bundesländer, sortiert nach {metric.label}
                        </caption>
                        <thead>
                            <tr className="text-[10px] uppercase tracking-widest text-neutral-600">
                                <th scope="col" className="px-2 py-2 text-left font-semibold">
                                    Bundesland
                                </th>
                                <th scope="col" className="px-2 py-2 text-right font-semibold">
                                    Fertig
                                </th>
                                <th scope="col" className="px-2 py-2 text-right font-semibold">
                                    Im Bau
                                </th>
                                <th scope="col" className="px-2 py-2 text-right font-semibold">
                                    Gebäude
                                </th>
                                <th scope="col" className="px-2 py-2 text-right font-semibold">
                                    Regionen
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {ranked.map((state) => {
                                const isSelected = state.code === selectedCode;
                                const index = heatIndex(metric.value(state), max);
                                return (
                                    <tr
                                        key={state.code}
                                        onClick={() => setSelectedCode(state.code)}
                                        className={`cursor-pointer border-t border-white/[0.04] transition-colors ${isSelected ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"
                                            }`}
                                    >
                                        <th scope="row" className="px-2 py-2 text-left font-normal">
                                            <button
                                                type="button"
                                                aria-pressed={isSelected}
                                                onClick={() => setSelectedCode(state.code)}
                                                className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
                                            >
                                                {/* Farbstufe wie auf der Karte — der Titel nennt
                                                    den Wert, nach dem gerade eingefärbt wird. */}
                                                <span
                                                    title={`${metric.label}: ${metric.format(metric.value(state))}`}
                                                    className="size-2.5 shrink-0 rounded-[3px] ring-1 ring-inset ring-white/10"
                                                    style={{ backgroundColor: index < 0 ? HEAT_EMPTY : HEAT_STEPS[index] }}
                                                />
                                                <span className={isSelected ? "font-semibold text-white" : "text-neutral-300"}>
                                                    {state.name}
                                                </span>
                                            </button>
                                        </th>
                                        <td className="px-2 py-2 text-right tabular-nums text-neutral-300">
                                            {formatAreaShort(state.finishedArea)}
                                        </td>
                                        <td className="px-2 py-2 text-right tabular-nums text-neutral-500">
                                            {formatAreaShort(state.inProgressArea)}
                                        </td>
                                        <td className="px-2 py-2 text-right tabular-nums text-neutral-300">
                                            {formatNumber(state.buildings)}
                                        </td>
                                        <td className="px-2 py-2 text-right tabular-nums text-neutral-500">
                                            {formatNumber(state.regions)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <p className="mt-3 flex items-center gap-1.5 px-2 text-[11px] text-neutral-600">
                    <MousePointerClick className="size-3" />
                    Karte oder Zeile anklicken, um ein Bundesland auszuwählen.
                </p>
            </div>
        </section>
    );
}
