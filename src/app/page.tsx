"use client"

import { Suspense } from "react";
import Map from "@/components/map/Map";
import { FloatingNavigationBar } from "@/components/common/NavigationBar";
import LegalBar from "@/components/common/LegalBar";
import { MapProvider } from "@vis.gl/react-maplibre";
import MapControls from "@/components/map/Controls";
import RegionPane from "@/components/map/region/RegionPane";
import MapContextMenu from "@/components/map/MapContextMenu";
import RegionQueryParamSync from "@/components/map/RegionQueryParamSync";
import WelcomeScreen from "@/components/welcome/WelcomeScreen";
import MapSearchNavigation from "@/components/search/MapSearchNavigation";
import StreetLevelFeature from "@/components/map/street-level/StreetLevelFeature";

export default function Home() {
    return (
        // `fixed inset-0` instead of `h-screen w-screen`: on mobile `100vh` is
        // the viewport with the browser chrome hidden, so the page ends up
        // taller than what's visible and the whole document scrolls under the
        // map. Pinning to the viewport leaves the document nothing to scroll.
        <div className={"fixed inset-0 overflow-hidden overscroll-none"}>
            <MapProvider>
                <WelcomeScreen />
                <FloatingNavigationBar />
                <Map />
                <RegionPane />
                <MapContextMenu />
                <MapControls />
                <LegalBar />
                <MapSearchNavigation />
                <Suspense fallback={null}>
                    <RegionQueryParamSync />
                </Suspense>
                <StreetLevelFeature />
            </MapProvider>
        </div>
    );
}
