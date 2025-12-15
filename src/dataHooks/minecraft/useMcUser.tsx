import {useQuery} from "@tanstack/react-query";
import {getAllRegions, getAllRegionsAsGeoJSON, getRegion} from "@/actions/region/GetRegions";
import getUser from "@/actions/minecraft/user";

const useMcUser = (mcUuid: string) => useQuery({
    queryKey: ['mcUser', mcUuid],
    queryFn: () => {
        if (mcUuid) {
            return getUser(mcUuid)
        } else {
            return Promise.resolve(null)
        }
    }
})

export {useMcUser};