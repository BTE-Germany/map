/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + Map.jsx                                                                    +
 +                                                                            +
 + Copyright (c) 2022 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React, {forwardRef, useEffect, useImperativeHandle, useRef, useState} from 'react';
import axios from "axios";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {Box, Button, Loader, LoadingOverlay} from "@mantine/core";
import {useClipboard} from "@mantine/hooks";
import {showNotification} from "@mantine/notifications";
import {BsCheck2} from "react-icons/bs";
import "mapbox-gl-style-switcher/styles.css";
import {MapboxStyleSwitcherControl} from "mapbox-gl-style-switcher";
import useQuery from "../hooks/useQuery";
import {centerOfMass, polygon} from "@turf/turf";
import {AiOutlineSearch} from "react-icons/ai";
import {SpotlightProvider, useSpotlight} from "@mantine/spotlight";
import search from "../utils/SearchEngine";
import {BiMapPin} from "react-icons/bi";
import searchInOSM from "../utils/SearchEngine";


const Map = forwardRef(({openDialog, setRegionViewData, updateMap, setUpdateMap}, ref) => {
    mapboxgl.accessToken = 'pk.eyJ1IjoibmFjaHdhaGwiLCJhIjoiY2tta3ZkdXJ2MDAwbzJ1cXN3ejM5N3NkcyJ9.t2yFHFQzb2PAHvPHF16sFw';

    const mapContainer = useRef(null);
    const [map, setMap] = useState(null);
    const [lng, setLng] = useState(10.447683);
    const [lat, setLat] = useState(51.163361);
    const [zoom, setZoom] = useState(5.5);
    const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
    const clipboard = useClipboard();
    const [actions, setActions] = useState([]);

    useImperativeHandle(ref, () => ({

        goto(lat, lng) {
            changeLatLon(lat, lng);
        }

    }));

    const [showSearchLoading, setShowSearchLoading] = useState(false);

    const query = useQuery();

    const styles = [
        {
            title: "Dark",
            uri: "mapbox://styles/nachwahl/cl2nl1qes00bn14ksw5y85arm"
        },
        {
            title: "Light",
            uri: "mapbox://styles/mapbox/light-v9"
        },
        {title: "Outdoors", uri: "mapbox://styles/mapbox/outdoors-v11"},
        {title: "Satellite", uri: "mapbox://styles/mapbox/satellite-streets-v11"},
        {title: "Streets", uri: "mapbox://styles/mapbox/streets-v11"}
    ];


    useEffect(() => {
        if (map) return; // initialize map only once
        const mapInstance = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/nachwahl/cl2nl1qes00bn14ksw5y85arm',
            center: [lng, lat],
            zoom: zoom
        });
        mapInstance.addControl(new mapboxgl.NavigationControl());
        mapInstance.addControl(new MapboxStyleSwitcherControl(styles, {defaultStyle: "Dark"}));
        setMap(mapInstance)

    });

    useEffect(() => {
        if (!map) return;
        if (!updateMap) return;
        updateRegions();
    }, [updateMap])

    const updateRegions = async () => {

        let regions = await axios.get("/api/v1/region/all/geojson")
        map.getSource('regions').setData(regions.data);
        setUpdateMap(false);
    }
    useEffect(() => {
        if (map) {
            map.on('load', () => {
                addLayer().then(() => testQuery());

            })
        }
    }, [map])

    useEffect(() => {
        testQuery();
    }, [query]);

    const testQuery = async () => {
        if (query.get("region")) {
            let regionId = query.get("region");
            const uuidRegexExp = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;
            if (uuidRegexExp.test(regionId)) {
                axios.get(`/api/v1/region/${regionId}`)
                    .then(region => {
                        let coords = JSON.parse(region.data.data);
                        coords.push(coords[0]);
                        let poly = polygon([coords])
                        let centerMass = centerOfMass(poly);
                        changeLatLon(centerMass.geometry.coordinates[0], centerMass.geometry.coordinates[1])
                        if (query.get("details") === "true") {
                            openDialog({id: regionId, userUuid: region.data.userUUID, username: region.data.username});
                        }
                    })


            } else {
                console.error("string in region query is not a valid uuid. maybe a directory climbing attack?")
            }
        }
    }

    const addLayer = async () => {
        let regions = await axios.get("/api/v1/region/all/geojson")
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
                icon: <BsCheck2 size={18}/>,
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

    const handleQueryChange = (query) => {
        if (!query) {
            setActions([])
        }

        const regexForCoords = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/
        if (regexForCoords.test(query)) {
            let coords = query.replace(" ", "").split(",");
            setActions([
                {
                    title: 'Go to coordinates',
                    description: query,
                    onTrigger: () => changeLatLon(coords[0], coords[1]),
                    icon: <BiMapPin size={18}/>,
                },
            ])
            return;
        }

        setShowSearchLoading(true);
        searchInOSM(query, changeLatLon).then(r => {
            setActions(r);
            setShowSearchLoading(false);
        })

    }


    return (
        <SpotlightProvider shortcut={['mod + S']} actions={actions} onQueryChange={handleQueryChange}
                           searchIcon={showSearchLoading ? <Loader size={"xs"}/> : <AiOutlineSearch/>}
                           filter={(query, actions) => actions}>
            <div style={{width: "100%", position: 'relative', flex: 1}}>
                <LoadingOverlay visible={showLoadingOverlay}/>
                <div ref={mapContainer} style={{width: "100%", height: "100%"}}/>
            </div>
        </SpotlightProvider>

    );
});

export default Map
