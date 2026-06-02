"use client";

import dynamic from "next/dynamic";

const RegionMiniMap = dynamic(() => import("@/components/map/region/RegionMiniMap"), { ssr: false });

export default function RegionMiniMapWrapper({
    polygon,
    finished,
}: {
    polygon: [number, number][];
    finished: boolean;
}) {
    return <RegionMiniMap polygon={polygon} finished={finished} />;
}
