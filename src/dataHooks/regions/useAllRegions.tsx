import { useQuery } from "@tanstack/react-query";
import { getAllRegionsAsGeoJSON, getRegionsForSearch } from "@/actions/region/GetRegions";

// Minimal, public-safe region list for the search box (no creator/builder UUIDs).
const useRegionsForSearch = () => useQuery({
    queryKey: ['regions_search'],
    queryFn: () => getRegionsForSearch()
})

const useAllRegionsAsGeoJSON = () => useQuery({
    queryKey: ['regions_geojson'],
    queryFn: () => getAllRegionsAsGeoJSON()
})

export { useRegionsForSearch, useAllRegionsAsGeoJSON };
