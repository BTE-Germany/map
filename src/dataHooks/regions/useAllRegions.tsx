import {useQuery} from "@tanstack/react-query";
import {getAllRegions, getAllRegionsAsGeoJSON} from "@/actions/region/GetRegions";

const useAllRegions = () => useQuery({
    queryKey: ['regions'],
    queryFn: () => getAllRegions()
})

const useAllRegionsAsGeoJSON = () => useQuery({
    queryKey: ['regions_geojson'],
    queryFn: () => getAllRegionsAsGeoJSON()
})

export {useAllRegions, useAllRegionsAsGeoJSON};