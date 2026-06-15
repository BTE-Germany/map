const MAPKIT_SCRIPT_ID = "apple-mapkit-js-sdk";
const MAPKIT_SCRIPT_URL = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.core.js";

let mapKitPromise: Promise<MapKitNamespace> | null = null;

async function fetchMapKitToken(): Promise<string> {
    const response = await fetch("/api/maps/apple-token", { cache: "no-store" });
    if (!response.ok) {
        throw new Error("Apple Maps Token konnte nicht geladen werden.");
    }

    const token = await response.text();
    if (!token) {
        throw new Error("Apple Maps Token ist leer.");
    }

    return token;
}

export function loadAppleMapKit(): Promise<MapKitNamespace> {
    if (typeof window === "undefined") {
        return Promise.reject(new Error("Apple MapKit JS kann nur im Browser geladen werden."));
    }

    if (window.mapkit?.loadedLibraries?.includes("look-around")) {
        return Promise.resolve(window.mapkit);
    }

    if (mapKitPromise) {
        return mapKitPromise;
    }

    mapKitPromise = new Promise((resolve, reject) => {
        const initialize = () => {
            const mapkit = window.mapkit;
            if (!mapkit) {
                reject(new Error("Apple MapKit JS wurde nicht korrekt geladen."));
                return;
            }

            try {
                mapkit.init({
                    authorizationCallback: (done) => {
                        void fetchMapKitToken().then(done).catch(reject);
                    },
                    language: "de",
                    libraries: ["look-around"],
                });
            } catch (error) {
                reject(error);
                return;
            }

            const startedAt = Date.now();
            const waitForLookAround = window.setInterval(() => {
                if (mapkit.loadedLibraries?.includes("look-around")) {
                    window.clearInterval(waitForLookAround);
                    resolve(mapkit);
                } else if (Date.now() - startedAt > 15_000) {
                    window.clearInterval(waitForLookAround);
                    reject(new Error("Die Apple Look Around Bibliothek konnte nicht initialisiert werden."));
                }
            }, 50);
        };

        const existingScript = document.getElementById(MAPKIT_SCRIPT_ID) as HTMLScriptElement | null;
        if (existingScript) {
            if (window.mapkit) {
                initialize();
            } else {
                existingScript.addEventListener("load", initialize, { once: true });
                existingScript.addEventListener("error", () => reject(new Error("Apple MapKit JS konnte nicht geladen werden.")), { once: true });
            }
            return;
        }

        const script = document.createElement("script");
        script.id = MAPKIT_SCRIPT_ID;
        script.src = MAPKIT_SCRIPT_URL;
        script.crossOrigin = "anonymous";
        script.async = true;
        script.addEventListener("load", initialize, { once: true });
        script.addEventListener("error", () => {
            mapKitPromise = null;
            reject(new Error("Apple MapKit JS konnte nicht geladen werden."));
        }, { once: true });
        document.head.appendChild(script);
    });

    return mapKitPromise;
}
