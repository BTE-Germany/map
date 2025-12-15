"use client"

import Map from "@/components/map/Map";
import {FloatingNavigationBar} from "@/components/common/NavigationBar";
import LegalBar from "@/components/common/LegalBar";
import {MapProvider} from "@vis.gl/react-maplibre";
import MapControls from "@/components/map/Controls";
import RegionPane from "@/components/map/region/RegionPane";

export default function Home() {
    return (
        <div className={"h-screen w-screen relative"}>
            <MapProvider>
                <FloatingNavigationBar/>
                <Map/>
                <RegionPane />
                <MapControls />
                <LegalBar/>
            </MapProvider>
        </div>
    );
}
