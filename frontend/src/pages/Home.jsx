import React, {useState} from 'react';
import Map from "../components/Map";
import NavHeader from "../components/NavHeader";
import {Box, LoadingOverlay} from "@mantine/core";
import RegionView from "../components/RegionView";

const Home = props => {

    const [regionViewData, setRegionViewData] = useState({
        "id": "",
        "username": "",
        "userUuid": ""
    });
    const [openRegionView, setOpenRegionView] = useState(false);

    const openDialog = (data) => {
        setRegionViewData(data)
        setOpenRegionView(true);
    }
    return (
        <Box sx={{display: "flex", flexDirection: "column", height: "100vh"}}>
            <NavHeader/>
            <RegionView data={regionViewData} setOpen={setOpenRegionView} open={openRegionView}/>
            <Map openDialog={openDialog}/>

        </Box>
    );
}

export default Home
