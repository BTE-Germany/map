"use client";

import dynamic from "next/dynamic";
import type { UserRegionsGeoJSON } from "@/components/profile/ProfileMiniMap";

const ProfileMiniMap = dynamic(() => import("@/components/profile/ProfileMiniMap"), { ssr: false });

export default function ProfileMiniMapWrapper({ geoJSON }: { geoJSON: UserRegionsGeoJSON }) {
    return <ProfileMiniMap geoJSON={geoJSON} />;
}
