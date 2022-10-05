/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + RegionView.jsx                                                             +
 +                                                                            +
 + Copyright (c) 2022 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React, { useEffect, useState } from 'react';
import {
    Accordion, ActionIcon, Alert,
    Box,
    Button,
    Code,
    Drawer,
    Group,
    Image,
    Loader,
    Paper, ScrollArea,
    Table,
    Text,
    Title,
    Tooltip
} from "@mantine/core";
import axios from "axios";
import { useClipboard } from "@mantine/hooks";
import { centerOfMass, polygon } from "@turf/turf";
import StatCard from "./StatCard";
import NewStatCard from "./StatCard";
import { FaCity } from "react-icons/fa";
import { BiArea } from "react-icons/bi";
import { AiFillDelete, AiOutlineDelete, AiOutlineLink } from "react-icons/ai";
import { MdAdd, MdOutlineShareLocation } from "react-icons/md";
import { useModals } from "@mantine/modals";
import { showNotification } from "@mantine/notifications";
import { useKeycloak } from "@react-keycloak-fork/web";
import { FiLock } from "react-icons/fi";
import { useUser } from "../hooks/useUser";
import { IoMdFlag } from "react-icons/io";
import ReportDialog from "./ReportDialog";
import { Link } from "react-router-dom";
import RegionImageView from "./RegionImageView";
import { BsFillPersonFill } from "react-icons/bs";
import { HiUserGroup } from "react-icons/hi";
import AdditionalBuildersDialog from "./AdditionalBuildersDialog";
import { GiPartyPopper, TbFence } from "react-icons/all";

const RegionView = ({ data, open, setOpen, setUpdateMap }) => {

    if (!data) return null;

    const modals = useModals();
    const [loading, setLoading] = useState(true);
    const clipboard = useClipboard({ timeout: 800 });
    const [center, setCenter] = useState([0, 0]);
    const [region, setRegion] = useState(null);
    const [editing, setEditing] = useState(false);

    const { keycloak } = useKeycloak()
    const isAdmin = keycloak?.tokenParsed?.realm_access.roles.includes("mapadmin");

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

    const copyLink = (id) => {
        clipboard.copy(window.location.origin + "?region=" + id + "&details=true")
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
            labels: { confirm: 'Delete region', cancel: "No don't delete it" },
            confirmProps: { color: 'red' },
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
        if (region.ownerID === user?.data?.id) {
            showNotification({
                title: 'Ehhhhh...',
                message: 'You are not able to report your own region, you dummie.',
                color: "red"
            })
            return;
        }
        setOpen(false);
        modals.openModal({
            title: 'Report this region',
            centered: true,
            children: (
                <ReportDialog regionId={region.id} keycloak={keycloak} />
            ),
        });
    }

    const teleportToRegion = async () => {
        await axios.post(`/api/v1/user/teleport`, { coords: center }, { headers: { authorization: "Bearer " + keycloak.token } })
        showNotification({
            title: 'Teleport to region',
            message: 'You will be teleported shortly.',
            color: "green"
        })
    }

    const deleteRegion = async (id) => {
        await axios.delete(`/api/v1/region/${id}`, { headers: { authorization: "Bearer " + keycloak.token } });
        showNotification({
            title: 'Region deleted!',
            message: 'This region has been deleted.',
            color: "red"
        })
        setUpdateMap(true);
    }

    const openAdditionalBuilderModal = () => {
        if (!keycloak.authenticated) {
            showNotification({
                title: 'You need to be logged in!',
                message: 'You need to be logged in to report a region.',
                color: "red"
            })
            return;
        }
        if (region.ownerID !== user?.data?.id) {
            showNotification({
                title: 'Ehhhhh...',
                message: 'You are not the owner of this region.',
                color: "red"
            })
            return;
        }
        setOpen(false);
        modals.openModal({
            title: 'Add Additional Builder',
            centered: true,
            onClose: () => {
                setOpen(true);
                getData();
            },
            children: (
                <AdditionalBuildersDialog regionId={region.id} keycloak={keycloak} />
            ),
        });
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
                    <Loader mt={"xl"} />
                </Box> : <Box>
                    {/* TODO: Wait for Mantine 4.3 to release, where Dropboxes are fixed */}
                    {/*<RegionImageView/>*/}


                    <Group spacing={"md"} cols={1}>
                        {
                            (!region.isEventRegion && !region.isPlotRegion) &&
                            <StatCard title={"Owner"} value={<Box sx={{ display: "flex", alignItems: "center" }}
                            >
                                <Image src={`https://crafatar.com/avatars/${data.userUUID}?size=64`} alt=""
                                    radius={"md"}
                                    style={{ width: 64 }} />
                                <Title ml={"md"} order={3}>{data.username}</Title>
                            </Box>} Icon={BsFillPersonFill} subtitle={""} />
                        }

                        {
                            region.isEventRegion &&
                            <Alert icon={<GiPartyPopper size={16} />} sx={{ width: "100%" }} title="Event Region"
                                color="green">
                                This is an Event Region, which was built as part of a BTE Germany Event. Therefore, it
                                has no owner.
                            </Alert>
                        }

                        {
                            region.isPlotRegion &&
                            <Alert icon={<TbFence size={16} />} sx={{ width: "100%" }} title="Plot Region"
                                color="blue">
                                This is an plot region. Therefore, it has no owner.
                            </Alert>
                        }

                        {
                            (region?.additionalBuilder?.length > 0 && !(region.ownerID === user?.data?.id)) &&
                            <StatCard title={"Additional Builders"} noBigValue={true}
                                value={<AdditionalBuilders showEditButtons={false}
                                    openAdditionalBuilderModal={openAdditionalBuilderModal}
                                    region={region} update={getData} />}
                                Icon={HiUserGroup}
                                subtitle={""} />
                        }

                        {
                            ((region.ownerID === user?.data?.id)) &&
                            <StatCard title={"Additional Builders"} noBigValue={true}
                                value={<AdditionalBuilders showEditButtons={true}
                                    openAdditionalBuilderModal={openAdditionalBuilderModal}
                                    region={region} update={getData}
                                />}
                                Icon={HiUserGroup}
                                subtitle={""} />
                        }
                        <StatCard title={"City"} value={region?.city} Icon={FaCity} subtitle={""}/>
                        <StatCard title={"Area"} value={numberWithCommas(region?.area) + " m²"} Icon={BiArea}
                            subtitle={""} />
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
                                <Button color={"blue"} leftIcon={<MdOutlineShareLocation />} onClick={teleportToRegion}>Teleport
                                    here</Button>
                            }

                            {
                                !user?.data?.minecraftUUID &&
                                <Button color={"blue"} leftIcon={<MdOutlineShareLocation />} component={Link}
                                    to={"/link"}>Teleport
                                    here</Button>
                            }
                        </Group> : <Button leftIcon={<FiLock size={14} />} fullWidth mt={"md"}
                            onClick={() => keycloak.login({ redirectUri: window.location.origin + "?region=" + region.id + "&details=true" })}>Login
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



                    <Box style={{ position: "absolute", bottom: 15, right: 15 }}>
                        {
                            (!user?.data?.blockedFromReports && !region.isPlotRegion && !region.isEventRegion) &&
                            <Tooltip
                                label="Report this region"
                                position="right"
                            >

                                <ActionIcon size="md" variant="light" onClick={openReportModal}>
                                    <IoMdFlag />
                                </ActionIcon>
                            </Tooltip>
                        }

                        <Tooltip
                            label={clipboard.copied ? "Copied" : "Copy a link to this region"}
                            position="right"
                            color={clipboard.copied ? "green" : "gray"}
                            ml={"sm"}
                        >

                            <ActionIcon size="md" variant="light" onClick={() => copyLink(region.id)}>
                                <AiOutlineLink />
                            </ActionIcon>
                        </Tooltip>
                    </Box>


                </Box>
            }


        </Drawer>
    );
}

const AdditionalBuilders = ({ region, showEditButtons, openAdditionalBuilderModal, update }) => {
    const { keycloak } = useKeycloak();
    const [load, setLoad] = useState(false);
    const removeBuilder = (builder) => {
        setLoad(true);
        axios.delete(`/api/v1/region/${region.id}/additionalBuilder/${builder}`, { headers: { authorization: "Bearer " + keycloak.token } })
            .then(() => {
                showNotification({
                    title: 'Success',
                    message: 'Builder removed',
                    color: "green"
                })
                update();
                setLoad(false);
            })
            .catch((e) => {
                showNotification({
                    title: 'Failed',
                    message: 'An unexpected error occurred.',
                    color: "red"
                })
                setLoad(false);
            })
    }

    return (
        <div style={{ width: "100%" }}>
            {
                region.additionalBuilder &&
                <Box sx={{ width: "100%" }}>
                    {
                        region.additionalBuilder.map((builder, idx) => {
                            return (
                                <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                                    <Box id={idx} sx={{ display: "flex", gap: "10px", alignItems: "center" }}>
                                        <img src={`https://crafatar.com/avatars/${builder.minecraftUUID}?size=20`}
                                            alt=""
                                            width={20} height={20} />
                                        <Text sx={{ fontWeight: "bold" }}>{builder.username}</Text>
                                    </Box>
                                    {
                                        showEditButtons &&
                                        <ActionIcon onClick={() => removeBuilder(builder.id)} loading={load}>
                                            <AiOutlineDelete />
                                        </ActionIcon>
                                    }

                                </Box>
                            )
                        })
                    }
                </Box>
            }

            {
                showEditButtons &&
                <Button color={"blue"} mt={"md"} leftIcon={<MdAdd />} onClick={openAdditionalBuilderModal}>
                    Add Additional Builder
                </Button>
            }
        </div>
    )

};

export default RegionView
