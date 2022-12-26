import React, {useEffect} from 'react';
import axios from "axios";
import {useKeycloak} from "@react-keycloak-fork/web";
import {Table, ActionIcon, Group, Select, Pagination, Box, Text} from '@mantine/core';
import {RegionView} from "../components/RegionView";
import {BiEdit} from 'react-icons/bi';
import {MdDelete} from 'react-icons/md';
import {useModals} from "@mantine/modals";
import {showNotification} from "@mantine/notifications";


const AdminRegions = () => {
    const {keycloak} = useKeycloak();
    const modals = useModals();
    const [regions, setRegions] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [openRegionView, setOpenRegionView] = React.useState(false);
    const [updateMap, setUpdateMap] = React.useState(false);
    const [regionViewData, setRegionViewData] = React.useState({
        "id": "",
        "username": "",
        "userUUID": ""
    });
    const [activePage, setPage] = React.useState(1);
    const [currentPageSize, setPageSize] = React.useState(25);
    const [totalPages, setTotalPages] = React.useState(12);

    useEffect(() => {getRegions();}, []);

    const pageSwitch = (page) => {
        setPage(page);
        getRegions(page, currentPageSize);
    };

    const pageSizeChange = (size) => {
        setPageSize(size);
        getRegions(activePage, size);
    };

    const getRegions = async (currentPage, pageSize) => {
        currentPage = currentPage === undefined ? activePage : currentPage;
        pageSize = pageSize === undefined ? currentPageSize : pageSize;
        const {data} = await axios.get(`api/v1/region/all`, {
            headers: {authorization: "Bearer " + keycloak.token},
            params: {page: currentPage, size: pageSize}
        });
        setRegions(data.data);
        setIsLoading(false);
        setTotalPages(data.totalPages);
    };

    const showDeleteConfirmation = (region) => {
        modals.openConfirmModal({
            title: 'Delete this region?',
            centered: true,
            children: (
                <Text size="sm">
                    Are you sure you want to delete this region? <b>This process is irreversible.</b>
                </Text>
            ),
            labels: {confirm: 'Delete region', cancel: "No don't delete it"},
            confirmProps: {color: 'red'},
            onConfirm: () => {
                deleteRegion(region.id);
            },
        });
    };

    const deleteRegion = async (id) => {
        await axios.delete(`/api/v1/region/${id}`, {headers: {authorization: "Bearer " + keycloak.token}});
        showNotification({
            title: 'Region deleted!',
            message: 'This region has been deleted.',
            color: "red"
        });
        setIsLoading(true);
        getRegions(activePage, currentPageSize);
    };

    const rows = regions.map((element) => (
        <tr key={element.id}>
            <td>{element.city}</td>
            <td>{element.area}</td>
            <td>{element.username}</td>
            <td >
                <Box sx={{display: "flex"}}>
                    <ActionIcon onClick={() => editRegion(element)}>
                        <BiEdit />
                    </ActionIcon>
                    <ActionIcon onClick={() => showDeleteConfirmation(element)}>
                        <MdDelete />
                    </ActionIcon>
                </Box>
            </td>
        </tr>
    ));

    const editRegion = async (regionData) => {
        setOpenRegionView(true);
        setRegionViewData(regionData);
    };

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
            <Group>
                <Pagination page={activePage} onChange={pageSwitch} total={totalPages} />
                <Select value={currentPageSize} onChange={pageSizeChange} data={[
                    {label: '10', value: 10},
                    {label: '25', value: 25},
                    {label: '50', value: 50},
                    {label: '100', value: 100},
                    {label: '200', value: 200},
                    {label: '500', value: 500},
                    {label: '1000', value: 1000}
                ]} />
            </Group>
        </div>
    );
};



export default AdminRegions;