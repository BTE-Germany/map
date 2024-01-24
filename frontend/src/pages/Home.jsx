/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + Home.jsx                                                                   +
 +                                                                            +
 + Copyright (c) 2022 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React, {useRef, useState} from 'react';
import Map from "../components/Map";
import NavHeader from "../components/NavHeader";
import {Box, LoadingOverlay} from "@mantine/core";
import {RegionView} from "../components/RegionView";

const Home = props => {

    const [regionViewData, setRegionViewData] = useState({
        "id": "",
        "username": "",
        "userUUID": ""
    });
    const [openRegionView, setOpenRegionView] = useState(false);
    const [updateMap, setUpdateMap] = useState(false);

    const openDialog = (data) => {
        setRegionViewData(data);
        setOpenRegionView(true);
    };

    const mapRef = useRef();

    return (
        <Box sx={{display: "flex", flexDirection: "column", height: "100vh"}}>
            <NavHeader mapRef={mapRef} />
            <RegionView data={regionViewData} setOpen={setOpenRegionView} open={openRegionView}
                setUpdateMap={setUpdateMap} />
            <Map openDialog={openDialog} updateMap={updateMap} setUpdateMap={setUpdateMap} ref={mapRef} />

        </Box>
    );
};

export default Home;
