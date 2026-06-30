import { getPublicRuntimeConfig } from "@/lib/publicRuntimeConfig";

const GOOGLE_MAPS_SCRIPT_ID = "google-maps-javascript-sdk";
const GOOGLE_MAPS_CALLBACK = "__bteGoogleMapsLoaded";

let googleMapsPromise: Promise<typeof google.maps> | null = null;

declare global {
    interface Window {
        [GOOGLE_MAPS_CALLBACK]?: () => void;
    }
}

export function loadGoogleMaps(): Promise<typeof google.maps> {
    if (typeof window === "undefined") {
        return Promise.reject(new Error("Google Maps kann nur im Browser geladen werden."));
    }

    if (window.google?.maps) {
        return Promise.resolve(window.google.maps);
    }

    if (googleMapsPromise) {
        return googleMapsPromise;
    }

    googleMapsPromise = getPublicRuntimeConfig()
        .then(
            ({ googleMapsApiKey }) =>
                new Promise<typeof google.maps>((resolve, reject) => {
                    if (!googleMapsApiKey) {
                        reject(
                            new Error(
                                "Google Maps Browser API-Key ist nicht konfiguriert.",
                            ),
                        );
                        return;
                    }

                    const existingScript = document.getElementById(
                        GOOGLE_MAPS_SCRIPT_ID,
                    ) as HTMLScriptElement | null;

                    window[GOOGLE_MAPS_CALLBACK] = () => {
                        delete window[GOOGLE_MAPS_CALLBACK];
                        if (window.google?.maps) {
                            resolve(window.google.maps);
                        } else {
                            reject(
                                new Error(
                                    "Google Maps wurde nicht korrekt initialisiert.",
                                ),
                            );
                        }
                    };

                    if (existingScript) {
                        existingScript.addEventListener(
                            "error",
                            () =>
                                reject(
                                    new Error(
                                        "Google Maps konnte nicht geladen werden.",
                                    ),
                                ),
                            { once: true },
                        );
                        return;
                    }

                    const script = document.createElement("script");
                    script.id = GOOGLE_MAPS_SCRIPT_ID;
                    script.async = true;
                    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsApiKey)}&v=beta&loading=async&callback=${GOOGLE_MAPS_CALLBACK}`;
                    script.onerror = () => {
                        googleMapsPromise = null;
                        delete window[GOOGLE_MAPS_CALLBACK];
                        reject(
                            new Error("Google Maps konnte nicht geladen werden."),
                        );
                    };
                    document.head.appendChild(script);
                }),
        )
        .catch((error) => {
            googleMapsPromise = null;
            throw error;
        });

    return googleMapsPromise;
}
