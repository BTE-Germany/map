import './App.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';
import {useEffect, useRef, useState} from "react";
import {Button, LoadingOverlay} from "@mantine/core";
import axios from "axios";

mapboxgl.accessToken = 'pk.eyJ1IjoibmFjaHdhaGwiLCJhIjoiY2tta3ZkdXJ2MDAwbzJ1cXN3ejM5N3NkcyJ9.t2yFHFQzb2PAHvPHF16sFw';


function App() {
    const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
    const mapContainer = useRef(null);
    const [map, setMap] = useState(null);
    const [lng, setLng] = useState(10.447683);
    const [lat, setLat] = useState(51.163361);
    const [zoom, setZoom] = useState(5.5);

    useEffect(() => {
        if (map) return; // initialize map only once
        const mapInstance = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/dark-v10',
            center: [lng, lat],
            zoom: zoom
        });
        setMap(mapInstance)

    });

    const addLayer = async () => {
        let regions = await axios.get("http://localhost:8899/api/v1/region/all")
        console.log(regions)

        regions.data.forEach((region) => {
            let regnew = [];
            JSON.parse(region.data).forEach((coords) => {
                regnew.push([coords[1], coords[0]])
            })
            map.addSource(region.id, {
                'type': 'geojson',
                'data': {
                    'type': 'Feature',
                    'geometry': {
                        'type': 'Polygon',
// These coordinates outline Maine.
                        'coordinates': [
                            regnew
                        ]
                    }
                }
            });


            map.addLayer({
                'id': region.id,
                'type': 'fill',
                'source': region.id,
                "minzoom": 1,
                "maxzoom": 4,
                'layout': {},
                'paint': {
                    'fill-color': '#0080ff',
                    'fill-opacity': 0.5
                }
            });

            map.addLayer({
                'id': 'outline',
                'type': 'line',
                "minzoom": 1,
                "maxzoom": 4,
                'source': region.id,
                'layout': {},
                'paint': {
                    'line-color': '#0080ff',
                    'line-width': 3
                }
            });

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
        <div>

            <div style={{width: "100vw", position: 'relative'}}>
                <LoadingOverlay visible={showLoadingOverlay} sx={{zIndex: 999}}
                                loaderProps={{size: 'lg', variant: 'bars'}}/>
                <div style={{position: "fixed", top: 0, left: 0, zIndex: 99}}>
                    <Button onClick={() => addLayer()}>aghdsfkhjgfdas</Button>
                </div>
                <div ref={mapContainer} style={{width: "100vw", height: "100vh"}}/>
            </div>

        </div>
    );
}

export default App;
