import { useQuery } from "@tanstack/react-query";

export interface PhotonFeature {
    geometry: {
        type: "Point";
        coordinates: [number, number];
    };
    properties: {
        osm_id?: number;
        osm_type?: string;
        name?: string;
        street?: string;
        housenumber?: string;
        postcode?: string;
        city?: string;
        district?: string;
        state?: string;
        country?: string;
        countrycode?: string;
        type?: string;
        osm_key?: string;
        osm_value?: string;
    };
}

interface PhotonResponse {
    features: PhotonFeature[];
}

async function fetchPhoton(query: string): Promise<PhotonFeature[]> {
    if (!query.trim()) return [];
    const url = `https://photon.komoot.io/api?q=${encodeURIComponent(query)}&lang=de&limit=8`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Photon request failed");
    const data: PhotonResponse = await res.json();
    return data.features ?? [];
}

export const usePhotonSearch = (query: string) =>
    useQuery({
        queryKey: ["photon", query],
        queryFn: () => fetchPhoton(query),
        enabled: query.trim().length >= 2,
        staleTime: 1000 * 60 * 5,
    });

export function formatPhotonLabel(feature: PhotonFeature): string {
    const p = feature.properties;
    const parts: string[] = [];
    const primary = p.name ?? [p.street, p.housenumber].filter(Boolean).join(" ");
    if (primary) parts.push(primary);
    const locality = [p.postcode, p.city ?? p.district].filter(Boolean).join(" ");
    if (locality) parts.push(locality);
    if (p.state) parts.push(p.state);
    if (p.country) parts.push(p.country);
    return parts.join(", ");
}
