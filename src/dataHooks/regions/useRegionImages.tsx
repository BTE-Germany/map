import { useQuery } from "@tanstack/react-query";
import { listRegionImages } from "@/actions/region/RegionImages";

export const useRegionImages = (regionId: string | null | undefined) =>
    useQuery({
        queryKey: ["regionImages", regionId ?? ""],
        queryFn: async () => (regionId ? listRegionImages(regionId) : []),
        enabled: !!regionId,
    });
