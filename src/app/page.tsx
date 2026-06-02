"use client"

import Map from "@/components/map/Map";
import { FloatingNavigationBar } from "@/components/common/NavigationBar";
import LegalBar from "@/components/common/LegalBar";
import { MapProvider } from "@vis.gl/react-maplibre";
import MapControls from "@/components/map/Controls";
import RegionPane from "@/components/map/region/RegionPane";
import MapContextMenu from "@/components/map/MapContextMenu";
import WelcomeScreen from "@/components/welcome/WelcomeScreen";
import SearchDialog from "@/components/search/SearchDialog";
import SearchShortcut from "@/components/search/SearchShortcut";

export default function Home() {
    return (
        <div className={"h-screen w-screen relative"}>
            <MapProvider>
                <WelcomeScreen />
                <FloatingNavigationBar />
                <Map />
                <RegionPane />
                <MapContextMenu />
                <MapControls />
                <LegalBar />
                <SearchDialog />
                <SearchShortcut />
            </MapProvider>
        </div>
    );
}
