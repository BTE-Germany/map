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

    type MapTypeId = "roadmap" | "satellite" | "hybrid" | "terrain";

    interface CameraOptions {
        center: LatLngLiteral;
        zoom: number;
        heading?: number;
        tilt?: number;
    }

    interface MapOptions {
        center?: LatLngLiteral;
        zoom?: number;
        mapTypeId?: MapTypeId;
        /** A vector Cloud map ID — what heading and fractional zoom would need. */
        mapId?: string;
        disableDefaultUI?: boolean;
        gestureHandling?: "none" | "greedy" | "cooperative" | "auto";
        keyboardShortcuts?: boolean;
        tilt?: number;
        heading?: number;
        backgroundColor?: string;
    }

    class Map {
        constructor(container: HTMLElement, options?: MapOptions);
        /** Optional: older releases of the SDK don't have it. */
        moveCamera?(camera: CameraOptions): void;
        setCenter(center: LatLngLiteral): void;
        setZoom(zoom: number): void;
        setMapTypeId(mapTypeId: MapTypeId): void;
        getMapTypeId(): MapTypeId | undefined;
        addListener(eventName: string, handler: () => void): MapsEventListener;
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
