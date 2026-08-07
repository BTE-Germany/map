import { useEffect, useState } from "react";
import {
    effectiveGoogleRendering,
    getMapStyleSource,
    type GoogleRendering,
    type MapStyleId,
} from "@/lib/mapStyles";
import { getPublicRuntimeConfig } from "@/lib/publicRuntimeConfig";

/**
 * How Google will actually draw the basemap for `styleId`, or null when the
 * style is not one of Google's.
 *
 * A style can ask for `vector`, but that only happens with a Cloud map ID
 * configured — otherwise Google renders raster, which cannot rotate. Callers
 * decide things like "may the map be rotated" from this, so while the config is
 * still loading the answer is the conservative one.
 */
export function useEffectiveGoogleRendering(styleId: MapStyleId): GoogleRendering | null {
    const [vectorMapId, setVectorMapId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        getPublicRuntimeConfig()
            .then(({ googleMapsVectorMapId }) => {
                if (!cancelled) setVectorMapId(googleMapsVectorMapId.trim());
            })
            .catch(() => {
                if (!cancelled) setVectorMapId("");
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return effectiveGoogleRendering(getMapStyleSource(styleId), vectorMapId);
}
