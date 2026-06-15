type MapKitLookAroundReadyState = "loading" | "complete" | "error" | "destroyed";

interface MapKitCoordinate {
    latitude: number;
    longitude: number;
}

interface MapKitLookAroundScene {
    coordinate?: MapKitCoordinate;
}

interface MapKitLookAroundOptions {
    isNavigationEnabled?: boolean;
    isScrollEnabled?: boolean;
    isZoomEnabled?: boolean;
    showsCloseControl?: boolean;
    showsDialogControl?: boolean;
    showsPointsOfInterest?: boolean;
    showsRoadLabels?: boolean;
}

interface MapKitLookAround extends EventTarget {
    centerCoordinate?: MapKitCoordinate | null;
    readyState: MapKitLookAroundReadyState;
    scene: MapKitLookAroundScene | null;
    destroy(): void;
}

interface MapKitNamespace {
    loadedLibraries: string[];
    init(options: {
        authorizationCallback: (done: (token: string) => void) => void;
        language?: string;
        libraries?: string[];
    }): void;
    Coordinate: new (latitude: number, longitude: number) => MapKitCoordinate;
    LookAround: new (
        parent: HTMLElement,
        location: MapKitCoordinate,
        options?: MapKitLookAroundOptions,
    ) => MapKitLookAround;
}

interface Window {
    mapkit?: MapKitNamespace;
}
