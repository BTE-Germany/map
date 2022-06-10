/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + RegionView.jsx                                                             +
 +                                                                            +
 + Copyright (c) 2022 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React, {useEffect, useState} from 'react';
import {
    Accordion, ActionIcon,
    Box,
    Button,
    Code,
    Drawer,
    Group,
    Image,
    Loader,
    Paper,
    Table,
    Text,
    Title,
    Tooltip
} from "@mantine/core";
import axios from "axios";
import {useClipboard} from "@mantine/hooks";
import {centerOfMass, polygon} from "@turf/turf";
import StatCard from "./StatCard";
import {FaCity} from "react-icons/fa";
import {BiArea} from "react-icons/bi";
import {AiFillDelete} from "react-icons/ai";
import {MdOutlineShareLocation} from "react-icons/md";
import {useModals} from "@mantine/modals";
import {showNotification} from "@mantine/notifications";
import {useKeycloak} from "@react-keycloak/web";
import {FiLock} from "react-icons/fi";
import {useUser} from "../hooks/useUser";
import {IoMdFlag} from "react-icons/io";
import ReportDialog from "./ReportDialog";
import {Link} from "react-router-dom";

const RegionView = ({data, open, setOpen, setUpdateMap}) => {

    if (!data) return null;

    const modals = useModals();
    const [loading, setLoading] = useState(true);
    const clipboard = useClipboard({timeout: 800});
    const [center, setCenter] = useState([0, 0]);
    const [region, setRegion] = useState(null);

    const {keycloak} = useKeycloak()

    const user = useUser();

    const numberWithCommas = (x) => {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    useEffect(() => {
        setLoading(true);
        getData();
    }, [data]);

    const getData = async () => {
        if (!data?.id) return;
        const region = await axios.get(`/api/v1/region/${data.id}`)
        setRegion(region.data);
        let coords = JSON.parse(region.data.data);
        coords.push(coords[0]);
        let poly = polygon([coords])
        let centerMass = centerOfMass(poly)
        setCenter(centerMass.geometry.coordinates)
        setLoading(false);
    };

    const copyId = (id) => {
        clipboard.copy(id);
    }

    const copyCoords = (coords) => {
        clipboard.copy(coords[0] + "," + coords[1]);
    }

    const showDeleteConfirmation = () => {
        setOpen(false)
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
            onCancel: () => setOpen(true),
            onConfirm: () => {
                deleteRegion(region.id);
            },
        });
    }

    const openReportModal = () => {
        if (!keycloak.authenticated) {
            showNotification({
                title: 'You need to be logged in!',
                message: 'You need to be logged in to report a region.',
                color: "red"
            })
            return;
        }
        setOpen(false);
        modals.openModal({
            title: 'Report this region',
            centered: true,
            children: (
                <ReportDialog regionId={region.id} keycloak={keycloak}/>
            ),
        });
    }

    const teleportToRegion = async () => {
        await axios.post(`/api/v1/user/teleport`, {coords: center}, {headers: {authorization: "Bearer " + keycloak.token}})
        showNotification({
            title: 'Teleport to region',
            message: 'You will be teleported shortly.',
            color: "green"
        })
    }

    const deleteRegion = async (id) => {
        await axios.delete(`/api/v1/region/${id}`, {headers: {authorization: "Bearer " + keycloak.token}});
        showNotification({
            title: 'Region deleted!',
            message: 'This region has been deleted.',
            color: "red"
        })
        setUpdateMap(true);
    }


    return (
        <Drawer
            opened={open}
            onClose={() => setOpen(false)}
            title={`Region Info`}
            padding="xl"
            size="xl"
            overlayBlur={3}
        >
            {
                loading ? <Box sx={{
                    height: "90%",
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center"
                }}>
                    <Loader mt={"xl"}/>
                </Box> : <Box>
                    <Paper shadow="md" p="md" withBorder sx={{display: "flex", alignItems: "center"}} mt={"xl"}
                           radius={"md"} mb={"md"}>
                        <Image src={`https://crafatar.com/avatars/${data.userUuid}?size=64`} alt="" radius={"md"}
                               style={{width: 64}}/>
                        <Title ml={"md"} order={3}>{data.username}</Title>
                    </Paper>

                    <Group spacing={"md"} cols={1}>
                        <StatCard title={"City"} value={region?.city} Icon={FaCity} subtitle={""}/>
                        <StatCard title={"Area"} value={numberWithCommas(region?.area) + " m²"} Icon={BiArea}
                                  subtitle={""}/>
                    </Group>


                    {
                        keycloak?.authenticated ? <Group spacing={"md"} cols={2} grow mt={"md"}>
                            {
                                (region.ownerID === user?.data?.id) &&
                                <Button color={"red"} leftIcon={<AiFillDelete/>} onClick={showDeleteConfirmation}>Delete
                                    Region</Button>
                            }
                            {
                                user?.data?.minecraftUUID &&
                                <Button color={"blue"} leftIcon={<MdOutlineShareLocation/>} onClick={teleportToRegion}>Teleport
                                    here</Button>
                            }

                            {
                                !user?.data?.minecraftUUID &&
                                <Button color={"blue"} leftIcon={<MdOutlineShareLocation/>} component={Link}
                                        to={"/link"}>Teleport
                                    here</Button>
                            }
                        </Group> : <Button leftIcon={<FiLock size={14}/>} fullWidth mt={"md"}
                                           onClick={() => keycloak.login({redirectUri: window.location.origin + "?region=" + region.id + "&details=true"})}>Login
                            to get more features</Button>
                    }


                    <Accordion iconPosition="right" offsetIcon={false} my={"md"}>
                        <Accordion.Item label="More information">
                            <Table>
                                <tbody>
                                <tr>
                                    <td>ID</td>
                                    <td>
                                        <Tooltip
                                            label={clipboard.copied ? "Copied" : "Click to copy"}
                                            position="right"
                                            color={clipboard.copied ? "green" : "gray"}
                                            transition="scale"
                                        >
                                            <Code onClick={() => copyId(data.id)} sx={{
                                                cursor: "pointer"
                                            }}>{data.id}</Code>
                                        </Tooltip>
                                    </td>
                                </tr>
                                <tr>
                                    <td>Center coordinates</td>
                                    <td>
                                        <Tooltip
                                            label={clipboard.copied ? "Copied" : "Click to copy"}
                                            position="right"
                                            color={clipboard.copied ? "green" : "gray"}
                                            transition="scale"
                                        >
                                            <Code onClick={() => copyCoords(center)} sx={{
                                                cursor: "pointer"
                                            }}>{center[0]}, {center[1]}</Code>
                                        </Tooltip>
                                    </td>
                                </tr>
                                </tbody>
                            </Table>
                        </Accordion.Item>
                    </Accordion>

                    {
                        !user?.data?.blockedFromReports &&
                        <Box style={{position: "absolute", bottom: 15, right: 15}}>
                            <Tooltip
                                label="Report this region"
                                position="right"
                            >

                                <ActionIcon size="md" variant="light" onClick={openReportModal}>
                                    <IoMdFlag/>
                                </ActionIcon>
                            </Tooltip>
                        </Box>
                    }


                </Box>
            }


        </Drawer>
    );
}

export default RegionView
