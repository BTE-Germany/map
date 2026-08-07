export interface PublicRuntimeConfig {
    /**
     * Browser key for the Google Maps JS SDK — Street View, the 3D view and the
     * satellite/hybrid basemaps. Restrict it by HTTP referrer.
     */
    googleMapsApiKey: string;
    /**
     * Cloud map ID with rendering type "vector", used by the styles that ask for
     * vector rendering (see `MAP_STYLES`). Vector is what makes heading and
     * fractional zoom work, so the map follows maplibre exactly instead of
     * snapping to whole zoom levels.
     *
     * Empty is fine: those styles then fall back to Google's raster rendering.
     */
    googleMapsVectorMapId: string;
}

let configPromise: Promise<PublicRuntimeConfig> | null = null;

export function getPublicRuntimeConfig(): Promise<PublicRuntimeConfig> {
    if (typeof window === "undefined") {
        return Promise.reject(
            new Error("Die öffentliche Runtime-Konfiguration ist nur im Browser verfügbar."),
        );
    }

    if (!configPromise) {
        configPromise = fetch("/api/config", { cache: "no-store" })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(
                        `Runtime-Konfiguration konnte nicht geladen werden (${response.status}).`,
                    );
                }

                return response.json() as Promise<PublicRuntimeConfig>;
            })
            .catch((error) => {
                configPromise = null;
                throw error;
            });
    }

    return configPromise;
}
