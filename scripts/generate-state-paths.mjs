/**
 * Erzeugt aus `src/data/germanStates.json` (BKG/GeoBasis-DE Grenzen der 16
 * Bundesländer) eine vorberechnete SVG-Pfad-Datei für die Deutschlandkarte auf
 * der Statistikseite.
 *
 * Die Rohdaten sind ~150 kB GeoJSON — zu viel, um sie bei jedem Seitenaufruf an
 * den Client zu schicken. Hier werden sie einmalig vereinfacht, nach Web-
 * Mercator projiziert und als fertige `d`-Attribute abgelegt.
 *
 *   node scripts/generate-state-paths.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as turf from "@turf/turf";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

/** Vereinfachungstoleranz in Grad (~0,9 km) — bei realer Anzeigegröße unter 1 px. */
const SIMPLIFY_TOLERANCE = 0.008;
/** Inseln/Exklaven unter dieser Fläche (km²) fallen raus, sonst nur Bildrauschen. */
const MIN_POLYGON_AREA_KM2 = 3;
/** Breite des SVG-Koordinatensystems; die Höhe ergibt sich aus der Projektion. */
const VIEWBOX_WIDTH = 1000;
/** Nachkommastellen der Pfadkoordinaten (1 Einheit ≈ 0,6 km ≈ 0,4 px). */
const PRECISION = 0;

const STATE_NAMES = {
    BW: "Baden-Württemberg",
    BY: "Bayern",
    BE: "Berlin",
    BB: "Brandenburg",
    HB: "Bremen",
    HH: "Hamburg",
    HE: "Hessen",
    MV: "Mecklenburg-Vorpommern",
    NI: "Niedersachsen",
    NW: "Nordrhein-Westfalen",
    RP: "Rheinland-Pfalz",
    SL: "Saarland",
    SN: "Sachsen",
    ST: "Sachsen-Anhalt",
    SH: "Schleswig-Holstein",
    TH: "Thüringen",
};

/**
 * Web-Mercator (unskaliert, im Bogenmaß — x muss dieselbe Einheit haben wie das
 * y aus dem Logarithmus, sonst wird die Karte flachgedrückt). y wächst nach
 * Norden und wird beim Projizieren gespiegelt.
 */
function mercator([lng, lat]) {
    const clamped = Math.max(-85, Math.min(85, lat));
    return [(lng * Math.PI) / 180, Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360))];
}

/**
 * Sucht den Punkt mit dem größten Abstand zum Rand ("pole of inaccessibility").
 * Der Schwerpunkt taugt dafür nicht: bei Brandenburg läge das Kürzel sonst
 * direkt auf Berlin, bei Niedersachsen auf Bremen.
 *
 * Gitterlauf mit dreifacher Verfeinerung — reicht für 16 Polygone in einem
 * einmaligen Build-Schritt und spart eine zusätzliche Abhängigkeit.
 */
function poleOfInaccessibility(polygon) {
    // Außenring und Löcher einzeln — der Abstand zum nächsten Rand zählt.
    const lines = polygon.geometry.coordinates.map((ring) => turf.lineString(ring));

    const score = (coord) => {
        const point = turf.point(coord);
        if (!turf.booleanPointInPolygon(point, polygon)) return -1;
        let min = Infinity;
        for (const line of lines) min = Math.min(min, turf.pointToLineDistance(point, line));
        return min;
    };

    let [minX, minY, maxX, maxY] = turf.bbox(polygon);
    let cellX = (maxX - minX) / 20;
    let cellY = (maxY - minY) / 20;
    let best = null;
    let bestScore = -1;

    for (let pass = 0; pass < 3; pass++) {
        for (let x = minX + cellX / 2; x < maxX; x += cellX) {
            for (let y = minY + cellY / 2; y < maxY; y += cellY) {
                const value = score([x, y]);
                if (value > bestScore) {
                    bestScore = value;
                    best = [x, y];
                }
            }
        }
        if (!best) break;
        [minX, minY, maxX, maxY] = [best[0] - cellX, best[1] - cellY, best[0] + cellX, best[1] + cellY];
        cellX /= 5;
        cellY /= 5;
    }

    // Fallback: irgendein Punkt auf der Fläche ist besser als gar keiner.
    return { coord: best ?? turf.pointOnFeature(polygon).geometry.coordinates, radiusKm: Math.max(0, bestScore) };
}

function polygonsOf(geometry) {
    if (geometry.type === "Polygon") return [geometry.coordinates];
    if (geometry.type === "MultiPolygon") return geometry.coordinates;
    return [];
}

const geojson = JSON.parse(readFileSync(resolve(ROOT, "src/data/germanStates.json"), "utf8"));

// 1. Vereinfachen + Splitterpolygone verwerfen.
const simplified = geojson.features.map((feature) => {
    const code = feature.properties.id.replace(/^DE-/, "");
    const simple = turf.simplify(feature, { tolerance: SIMPLIFY_TOLERANCE, highQuality: true });

    const rings = polygonsOf(simple.geometry).filter((rings) => {
        const area = turf.area(turf.polygon(rings)) / 1_000_000;
        return area >= MIN_POLYGON_AREA_KM2;
    });

    if (rings.length === 0) throw new Error(`Keine Polygone übrig für ${code}`);
    return { code, rings };
});

// 2. Gemeinsame Bounding-Box aller Länder im projizierten Raum.
let minX = Infinity;
let maxX = -Infinity;
let minY = Infinity;
let maxY = -Infinity;
for (const { rings } of simplified) {
    for (const polygon of rings) {
        for (const ring of polygon) {
            for (const coord of ring) {
                const [x, y] = mercator(coord);
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
}

const scale = VIEWBOX_WIDTH / (maxX - minX);
const viewBoxHeight = Math.round((maxY - minY) * scale);

/** Projiziert eine WGS84-Koordinate in das SVG-Koordinatensystem. */
function project(coord) {
    const [x, y] = mercator(coord);
    return [(x - minX) * scale, (maxY - y) * scale];
}

function round(n) {
    return Number(n.toFixed(PRECISION));
}

function toPath(rings) {
    const parts = [];
    for (const polygon of rings) {
        for (const ring of polygon) {
            // Letzter Punkt wiederholt den ersten — "Z" schließt den Ring.
            const points = ring.slice(0, -1).map((coord) => {
                const [x, y] = project(coord);
                return `${round(x)},${round(y)}`;
            });

            // Nach dem Runden fallen Nachbarpunkte teils zusammen; doppelte
            // Koordinaten blähen den Pfad nur auf.
            const deduped = points.filter((point, i) => point !== points[i - 1]);
            if (deduped.length > 1 && deduped[deduped.length - 1] === deduped[0]) deduped.pop();
            if (deduped.length < 3) continue;

            parts.push(`M${deduped.join("L")}Z`);
        }
    }
    return parts.join("");
}

// 3. Pfade + ein garantiert innenliegender Ankerpunkt fürs Label.
const states = simplified
    .map(({ code, rings }) => {
        const largest = rings.reduce((best, polygon) => {
            const area = turf.area(turf.polygon(polygon));
            return area > best.area ? { area, polygon } : best;
        }, { area: -1, polygon: null }).polygon;

        const pole = poleOfInaccessibility(turf.polygon(largest));
        const [labelX, labelY] = project(pole.coord);

        // Radius des größten einbeschriebenen Kreises in viewBox-Einheiten: die
        // Karte entscheidet daran, ob das Kürzel in die Fläche passt.
        const north = project([pole.coord[0], pole.coord[1]]);
        const south = project(turf.destination(turf.point(pole.coord), pole.radiusKm, 180).geometry.coordinates);

        return {
            code,
            name: STATE_NAMES[code] ?? code,
            path: toPath(rings),
            labelX: round(labelX),
            labelY: round(labelY),
            labelRadius: round(Math.abs(south[1] - north[1])),
        };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

const out = {
    viewBox: { width: VIEWBOX_WIDTH, height: viewBoxHeight },
    states,
};

const target = resolve(ROOT, "src/data/germanStatePaths.json");
writeFileSync(target, `${JSON.stringify(out)}\n`, "utf8");

const bytes = Buffer.byteLength(JSON.stringify(out));
console.log(`${states.length} Bundesländer → ${target}`);
console.log(`viewBox 0 0 ${VIEWBOX_WIDTH} ${viewBoxHeight}, ${(bytes / 1024).toFixed(1)} kB`);
