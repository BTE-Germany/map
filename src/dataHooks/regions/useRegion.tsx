import { useQuery } from "@tanstack/react-query";
import { getRegion } from "@/actions/region/GetRegions";

const useRegion = (regionId: string | null | undefined) => useQuery({
    queryKey: ['region', regionId],
    queryFn: () => getRegion(regionId!),
    enabled: !!regionId,
});

export { useRegion };
