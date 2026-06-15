declare namespace google.maps {
    type LatLngLiteral = {
        lat: number;
        lng: number;
    };

    interface LatLng {
        lat(): number;
        lng(): number;
    }

    interface MapsEventListener {
        remove(): void;
    }

    interface StreetViewLocation {
        latLng?: LatLng | null;
        pano?: string | null;
    }

    interface StreetViewResponse {
        data: {
            location?: StreetViewLocation | null;
        };
    }

    interface StreetViewPanoramaOptions {
        addressControl?: boolean;
        clickToGo?: boolean;
        disableDefaultUI?: boolean;
        fullscreenControl?: boolean;
        linksControl?: boolean;
        motionTracking?: boolean;
        motionTrackingControl?: boolean;
        panControl?: boolean;
        scrollwheel?: boolean;
        showRoadLabels?: boolean;
        zoomControl?: boolean;
    }

    class StreetViewPanorama {
        constructor(container: HTMLElement, options?: StreetViewPanoramaOptions);
        addListener(eventName: string, handler: () => void): MapsEventListener;
        getPosition(): LatLng | null;
        setPano(pano: string | undefined): void;
        setPosition(position: LatLngLiteral): void;
        setVisible(visible: boolean): void;
    }

    class StreetViewService {
        getPanorama(request: {
            location: LatLngLiteral;
            radius?: number;
            preference?: string;
            source?: string;
        }): Promise<StreetViewResponse>;
    }

    interface StreetViewLibrary {
        StreetViewPanorama: typeof StreetViewPanorama;
        StreetViewService: typeof StreetViewService;
        StreetViewPreference: {
            NEAREST: string;
        };
        StreetViewSource: {
            OUTDOOR: string;
        };
    }

    function importLibrary(libraryName: "streetView"): Promise<StreetViewLibrary>;
    function importLibrary(libraryName: string): Promise<unknown>;
}

interface Window {
    google: {
        maps: typeof google.maps;
    };
}
