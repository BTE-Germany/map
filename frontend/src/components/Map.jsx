import React, {useEffect, useRef, useState} from 'react';
import axios from "axios";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {Box, Button, LoadingOverlay} from "@mantine/core";
import {useClipboard} from "@mantine/hooks";
import {showNotification} from "@mantine/notifications";
import {BsCheck2} from "react-icons/bs";

const Map = ({openDialog, setRegionViewData}) => {
    mapboxgl.accessToken = 'pk.eyJ1IjoibmFjaHdhaGwiLCJhIjoiY2tta3ZkdXJ2MDAwbzJ1cXN3ejM5N3NkcyJ9.t2yFHFQzb2PAHvPHF16sFw';

    const mapContainer = useRef(null);
    const [map, setMap] = useState(null);
    const [lng, setLng] = useState(10.447683);
    const [lat, setLat] = useState(51.163361);
    const [zoom, setZoom] = useState(5.5);
    const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
    const clipboard = useClipboard();

    useEffect(() => {
        if (map) return; // initialize map only once
        const mapInstance = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/nachwahl/cl2nl1qes00bn14ksw5y85arm',
            center: [lng, lat],
            zoom: zoom
        });
        setMap(mapInstance)


    });

    useEffect(() => {
        if (map) {
            map.on('load', () => {
                addLayer();
            })
        }
    }, [map])

    const addLayer = async () => {
        let regions = await axios.get("http://localhost:8899/api/v1/region/all/geojson")
        setShowLoadingOverlay(false);
        map.addSource('regions', {
            'type': 'geojson',
            'data': regions.data
        });

        map.addLayer({
            'id': 'regions-layer',
            'type': 'fill',
            'source': 'regions',
            'paint': {
                'fill-color': 'rgba(3,80,203,0.37)',
                'fill-outline-color': 'rgba(1,50,127,0.92)'
            }
        });

        map.addLayer({
            'id': 'outline',
            'type': 'line',
            'source': "regions",
            'layout': {},
            'paint': {
                'line-color': 'rgb(0,90,229)',
                'line-width': 3
            }
        });

        map.on('click', 'regions-layer', (e) => {
            openDialog(e.features[0].properties)
        });

        map.on('mouseenter', 'regions-layer', () => {
            map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', 'regions-layer', () => {
            map.getCanvas().style.cursor = '';
        });

        map.on('contextmenu', (e) => {
            clipboard.copy(e.lngLat.lat + ", " + e.lngLat.lng)
            showNotification({
                title: 'Copied successfully',
                message: 'The coordinates have been copied to your clipboard!',
                icon: <BsCheck2 size={18} />,
                color: "teal"
            })
        })

    }

    const changeLatLon = (lat, lon) => {
        map.flyTo({
            center: [
                lon,
                lat
            ],
            zoom: 16,
            essential: true
        });
    }

    return (
        <div style={{width: "100%", position: 'relative', flex: 1}}>
            <LoadingOverlay visible={showLoadingOverlay}/>
            <div ref={mapContainer} style={{width: "100%", height: "100%"}}/>
        </div>

    );
}

export default Map
