"use client";

import {Layer, Map as Maplibre, Source, useMap} from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import {useAllRegions, useAllRegionsAsGeoJSON} from "@/dataHooks/regions/useAllRegions";
import {useEffect} from "react";
import useRegionPane from "@/stores/RegionPaneStore";
import maplibregl from "maplibre-gl";

export default function Map() {

    const {data: regionGeoJSON, isLoading} = useAllRegionsAsGeoJSON();
    const {mainMap: map} = useMap();
    const regionPane = useRegionPane();

    useEffect(() => {
        if (!map) return;



        map.on('click', 'region-layer', (e) => {
            const features = map.queryRenderedFeatures(e.point, {
                layers: ['region-layer']
            });
            regionPane.openRegion(features[0].properties.id)
        });


        // Change the cursor to a pointer when the mouse is over the states layer.
        map.on('mouseenter', 'region-layer', () => {
            map.getCanvas().style.cursor = 'pointer';
        });

        // Change it back to a pointer when it leaves.
        map.on('mouseleave', 'region-layer', () => {
            map.getCanvas().style.cursor = '';
        });
    }, [map]);

    const layerStyle = {
        id: 'polygon',
        type: 'fill' as const,
        paint: {
            'fill-color': "rgba(0,149,255,0.37)",
        }
    };

    const layerStyleLine = {
        id: 'polygonline',
        type: 'line' as const,
        paint: {
            'line-color': 'rgba(0,149,255,1)',
        }
    };

    return (
        <Maplibre initialViewState={{
            longitude: 10.447683,
            latitude: 51.163361,
            zoom: 6
        }} id={"mainMap"}
                  attributionControl={false}
                  style={{width: "100%", height: "100%", zIndex: 0}}
                  mapStyle={"https://tiles.dachstein.cloud/styles/btedarklight/style.json"}
        >
            {
                !isLoading && <Source id="regions" type="geojson" data={regionGeoJSON as any}>
                    <Layer {...layerStyle} id={"region-layer"} />
                    <Layer {...layerStyleLine} />
                </Source>
            }
        </Maplibre>
    )
}
