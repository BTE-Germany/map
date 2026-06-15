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

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        return Promise.reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ist nicht konfiguriert."));
    }

    googleMapsPromise = new Promise((resolve, reject) => {
        const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null;

        window[GOOGLE_MAPS_CALLBACK] = () => {
            delete window[GOOGLE_MAPS_CALLBACK];
            if (window.google?.maps) {
                resolve(window.google.maps);
            } else {
                reject(new Error("Google Maps wurde nicht korrekt initialisiert."));
            }
        };

        if (existingScript) {
            existingScript.addEventListener("error", () => reject(new Error("Google Maps konnte nicht geladen werden.")), { once: true });
            return;
        }

        const script = document.createElement("script");
        script.id = GOOGLE_MAPS_SCRIPT_ID;
        script.async = true;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=beta&loading=async&callback=${GOOGLE_MAPS_CALLBACK}`;
        script.onerror = () => {
            googleMapsPromise = null;
            delete window[GOOGLE_MAPS_CALLBACK];
            reject(new Error("Google Maps konnte nicht geladen werden."));
        };
        document.head.appendChild(script);
    });

    return googleMapsPromise;
}
