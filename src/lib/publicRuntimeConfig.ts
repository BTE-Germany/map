export interface PublicRuntimeConfig {
    /**
     * Browser key for the Google Maps JS SDK (Street View, 3D) *and* the Map
     * Tiles API the satellite/hybrid styles request their tiles from. Restrict
     * it by HTTP referrer — it is visible in every tile URL.
     */
    googleMapsApiKey: string;
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
