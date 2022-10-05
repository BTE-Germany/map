import React, { useEffect } from 'react';
import axios from "axios";
import { useKeycloak } from "@react-keycloak-fork/web";
import { Table, ActionIcon } from '@mantine/core';
import RegionView from "../components/RegionView";
import { BiEdit } from 'react-icons/bi';


const AdminRegions = () => {
    const { keycloak } = useKeycloak();
    const [regions, setRegions] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [openRegionView, setOpenRegionView] = React.useState(false);
    const [updateMap, setUpdateMap] = React.useState(false);
    const [regionViewData, setRegionViewData] = React.useState({
        "id": "",
        "username": "",
        "userUUID": ""
    });

    useEffect(() => { getRegions() }, []);

    const getRegions = async () => {
        const { data } = await axios.get(`api/v1/region/all`, { headers: { authorization: "Bearer " + keycloak.token } });
        setRegions(data);
        setIsLoading(false);
    }

    const rows = regions.map((element) => (
        <tr key={element.id}>
            <td>{element.city}</td>
            <td>{element.area}</td>
            <td>{element.username}</td>
            <td>
                <ActionIcon onClick={() => editRegion(element)}>
                    <BiEdit />
                </ActionIcon> </td>
        </tr>
    ));

    const editRegion = async (regionData) => {
        setOpenRegionView(true);
        setRegionViewData(regionData);
    }

    return (
        <div>
            {
                isLoading ? <p>Loading...</p> :
                    <Table>
                        <thead>
                            <tr>
                                <th>Stadt</th>
                                <th>Fläche</th>
                                <th>Besitzer</th>
                                <th>Aktionen</th>
                            </tr>
                        </thead>
                        <tbody>{rows}</tbody>
                    </Table>
            }
            <RegionView data={regionViewData} setOpen={setOpenRegionView} open={openRegionView} setUpdateMap={setUpdateMap} />
        </div>
    );
};



export default AdminRegions;