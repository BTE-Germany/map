import {useQuery} from "@tanstack/react-query";
import {getAllRegions, getAllRegionsAsGeoJSON, getRegion} from "@/actions/region/GetRegions";

const useRegion = (regionId: string) => useQuery({
    queryKey: ['region', regionId],
    queryFn: () => {
        if (regionId) {
            return getRegion(regionId)
        } else {
            return Promise.resolve(null)
        }
    }
})


export {useRegion};