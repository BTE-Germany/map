/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + RegionView.jsx                                                             +
 +                                                                            +
 + Copyright (c) 2022-2025 Robin Ferch                                        +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React, {useEffect, useState} from 'react';
import {
    Accordion,
    ActionIcon,
    Alert,
    Box,
    Button,
    Checkbox,
    Code,
    Drawer,
    Group,
    Loader,
    Radio, ScrollArea,
    Table,
    Text,
    Tooltip
} from "@mantine/core";
import axios from "axios";
import {useClipboard} from "@mantine/hooks";
import {centerOfMass, polygon} from "@turf/turf";
import {RichTextEditor} from '@mantine/rte';
import StatCard from "./StatCard";
import {FaCity} from "react-icons/fa";
import {BiArea, BiBuilding} from "react-icons/bi";
import {AiFillDelete, AiOutlineDelete, AiOutlineLink} from "react-icons/ai";
import {MdAdd, MdOutlineShareLocation, MdConstruction, MdDescription} from "react-icons/md";
import {useModals} from "@mantine/modals";
import {showNotification} from "@mantine/notifications";
import {FiLock} from "react-icons/fi";
import {useUser} from "../hooks/useUser";
import {IoMdFlag} from "react-icons/io";
import ReportDialog from "./ReportDialog";
import {Link, useNavigate} from "react-router-dom";
import {BsFillPersonFill} from "react-icons/bs";
import {HiUserGroup} from "react-icons/hi";
import AdditionalBuildersDialog from "./AdditionalBuildersDialog";
import {GiPartyPopper} from "react-icons/gi";
import {TbFence} from "react-icons/tb";
import RegionImageView from "./RegionImageView";
import {useOidc} from "../oidc";
import * as Sentry from "@sentry/react";

const RegionView = ({data, open, setOpen, setUpdateMap}) => {

    if (!data) return null;

    const modals = useModals();
    const [loading, setLoading] = useState(true);
    const clipboard = useClipboard({timeout: 800});
    const [center, setCenter] = useState([0, 0]);
    const [region, setRegion] = useState(null);
    const [editing, setEditing] = useState(false);
    const [plotType, setPlotType] = useState("normal");
    const [isFinished, setisFinished] = useState(true);
    const [description, setDescription] = useState("");
    const [additionalBuilders, setAdditionalBuilders] = useState([]);

    const { isUserLoggedIn, login, oidcTokens} = useOidc();
    const isAdmin = oidcTokens?.decodedIdToken.realm_access.roles.includes("mapadmin");

    const user = useUser();
    const navigate = useNavigate();

    const numberWithCommas = (x) => {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    useEffect(() => {
        setLoading(true);
        getData();
    }, [data]);

    const getData = async () => {
        if (!data?.id) return;
        const region_ = await axios.get(`/api/v1/region/${data.id}`);

        if (region_.data.isEventRegion) {
            setPlotType('event');
        } else if (region_.data.isPlotRegion) {
            setPlotType('plot');
        } else {
            setPlotType('normal');
        }
        console.log(region_.data);
        // from the data get the userUUID and get the username from the playerdb api
        try {
            const {data: mcApiData} = await axios.get(`https://playerdb.co/api/player/minecraft/${region_.data.userUUID}`);
            region_.data.username = mcApiData.data.player.username;
        } catch (err) {
            Sentry.captureException(err, {
                tags: {section: 'owner‑lookup'},
                extra: {uuid: region_.data.userUUID, regionId: region_.data.id}
            });
        }

        const tasks = region_.data.additionalBuilder.map(async addBuilder => {
            try {
                const { fetchedName } = (await axios.get(`https://playerdb.co/api/player/minecraft/${addBuilder.minecraftUUID}`)).data.player.username;
                if (fetchedName !== addBuilder.username) addBuilder.username = fetchedName;
            } catch (err) {
                Sentry.captureException(err, {
                    tags:  { section: 'builder‑lookup' },
                    extra: { uuid: addBuilder.minecraftUUID, regionId: region_.data.id}
                });
            }
        });

        await Promise.all(tasks);

        console.log(region_.data);
        setRegion(region_.data);
        setAdditionalBuilders(region_.data.additionalBuilder);

        // use the description only if it contains any words and not only html tags
        if (region_.data.description && region_.data.description.replace(/<[^>]*>/g, '').trim().length > 0) {
            setDescription(region_.data.description);
        }
        else {
            setDescription("");
        }
        let coords = JSON.parse(region_.data.data);
        coords.push(coords[0]);
        let poly = polygon([coords]);
        let centerMass = centerOfMass(poly);
        setCenter(centerMass.geometry.coordinates);
        if ('isFinished' in region_.data) {
            setisFinished(region_.data.isFinished);
        } else {
            setisFinished(true);
        }
        setLoading(false);
    };

    const copyId = (id) => {
        clipboard.copy(id);
    };

    const copyCoords = (coords) => {
        clipboard.copy(coords[0] + "," + coords[1]);
    };

    const copyLink = (id) => {
        clipboard.copy(window.location.origin + "?region=" + id + "&details=true");
    };

    const showDeleteConfirmation = () => {
        setOpen(false);
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
    };

    const openReportModal = () => {
        if (!isUserLoggedIn) {
            showNotification({
                title: 'You need to be logged in!',
                message: 'You need to be logged in to report a region.',
                color: "red"
            });
            return;
        }
        if (region.ownerID === user?.data?.id) {
            showNotification({
                title: 'Ehhhhh...',
                message: 'You are not able to report your own region, you dummie.',
                color: "red"
            });
            return;
        }
        setOpen(false);
        modals.openModal({
            title: 'Report this region',
            centered: true,
            children: (
                <ReportDialog regionId={region.id} token={oidcTokens.accessToken} />
            ),
        });
    };

    const teleportToRegion = async () => {
        await axios.post(`/api/v1/user/teleport`, {coords: center}, {headers: {authorization: "Bearer " + oidcTokens.accessToken}});
        showNotification({
            title: 'Teleport to region',
            message: 'You will be teleported shortly.',
            color: "green"
        });
    };

    const deleteRegion = async (id) => {
        await axios.delete(`/api/v1/region/${id}`, {headers: {authorization: "Bearer " + oidcTokens.accessToken}});
        showNotification({
            title: 'Region deleted!',
            message: 'This region has been deleted.',
            color: "red"
        });
        setUpdateMap(true);
    };

    const addNewBuilder = async (newBuilder) => {
        const {data: mcApiData} = await axios.get(`https://playerdb.co/api/player/minecraft/${newBuilder.username}`);
        newBuilder.minecraftUUID = mcApiData.data.player.id;
        setAdditionalBuilders([...additionalBuilders, newBuilder]);
    };

    const addBuilderToDB = (builder) => {
        axios.post(`/api/v1/region/${region.id}/additionalBuilder`, {
            username: builder.username
        }, {headers: {authorization: "Bearer " + oidcTokens.accessToken}})
            .then(({data}) => {
                showNotification({
                    title: 'Success',
                    message: 'Builder added',
                    color: "green"
                });
            })
            .catch((e) => {
                if (e.response.data === "Builder already exists") {
                    showNotification({
                        title: 'Error',
                        message: 'Builder already exists',
                        color: "red"
                    });
                    return;
                }
                showNotification({
                    title: 'Failed',
                    message: 'An unexpected error occurred.',
                    color: "red"
                });

            });
    };

    const removeBuilder = (builder) => {
        setAdditionalBuilders(additionalBuilders.filter(b => b.id !== builder.id));
    };

    const removeBuilderFromDB = (builder) => {
        axios.delete(`/api/v1/region/${region.id}/additionalBuilder/${builder.id}`, {headers: {authorization: "Bearer " + oidcTokens.accessToken}})
            .then(() => {
                showNotification({
                    title: 'Success',
                    message: 'Builder removed',
                    color: "green"
                });
            })
            .catch((e) => {
                showNotification({
                    title: 'Failed',
                    message: 'An unexpected error occurred.',
                    color: "red"
                });
            });
    };

    const openAdditionalBuilderModal = () => {
        if (!isUserLoggedIn) {
            showNotification({
                title: 'You need to be logged in!',
                message: 'You need to be logged in to report a region.',
                color: "red"
            });
            return;
        }
        if (region.ownerID !== user?.data?.id && !isAdmin) {
            showNotification({
                title: 'Ehhhhh...',
                message: 'You are not the owner of this region.',
                color: "red"
            });
            return;
        }
        setOpen(false);
        modals.openModal({
            title: 'Add Additional Builder',
            centered: true,
            onClose: () => {
                setOpen(true);
            },
            children: (
                <AdditionalBuildersDialog regionId={region.id} token={oidcTokens.accessToken} onUsers={addNewBuilder} />
            ),
        });
    };

    const onSave = async () => {
        const city = document.getElementById('city')?.value ?? region.city;
        const owner = document.getElementById('owner')?.value ?? region.username;
        const addedBuilders = additionalBuilders.filter((item) => !region.additionalBuilder.includes(item));
        const removedBuilders = region.additionalBuilder.filter((item) => !additionalBuilders.includes(item));
        setEditing(false);
        setLoading(true);
        for (let builder of addedBuilders) {
            addBuilderToDB(builder);
        }
        for (let builder of removedBuilders) {
            removeBuilderFromDB(builder);
        }
        try {
            const {data: mcApiData} = await axios.get(`https://playerdb.co/api/player/minecraft/${owner}`);
            const params = {
                city: city,
                player_id: mcApiData.data.player.id,
                username: mcApiData.data.player.username,
                isEventRegion: plotType === 'event',
                isPlotRegion: plotType === 'plot',
                isFinished: isFinished,
                description: description,
                lastModified: new Date(),
            };
            try {
                await axios.post(`api/v1/region/${region.id}/edit`, params, {headers: {authorization: "Bearer " + oidcTokens.accessToken}});
            } catch (error) {
                alert("Region could not be saved.");
                console.error(error);
            }
        } catch (error) {
            alert("Minecraft user could not be validated. Please check the username and try again. Otherwise contact a developer.");
            console.error(error);
        }
        setUpdateMap(true);
        getData();
    };

    return (
        <Drawer
            opened={open}
            onClose={() => setOpen(false)}
            title={`Region Info`}
            padding="xl"
            size="xl"
            overlayBlur={3}
            lockScroll
            styles={{
                body: {
                    height: "100%",
                    paddingBottom: "50px",
                    overflow: "hidden"
                }
            }}
        >
            {loading ?
                <Box sx={{
                    height: "90%",
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center"
                }}>
                    <Loader mt={"xl"} />
                </Box>
                :
                <ScrollArea.Autosize maxHeight={"90vh"} style={{maxHeight: "90vh"}}>
                    <Box sx={{maxHeight: "100%", display: "flex", flexDirection: "column"}}>
                        <RegionImageView regionId={region.id} regionImages={region.images}
                            editable={editing} />

                        <Group spacing={"md"} cols={1}>
                            {plotType == "event" ?
                                <Alert icon={<GiPartyPopper size={16} />} sx={{width: "100%"}} title="Event Region"
                                    color="red">
                                    This is an Event Region. Therefore, it has no owner.
                                </Alert>
                                : plotType == "plot" ?
                                    <Alert icon={<TbFence size={16} />} sx={{width: "100%"}} title="Plot Region"
                                        color="green">
                                        This is a plot region. Therefore, it has no owner.
                                    </Alert>
                                    : !isFinished ?
                                        <Alert icon={<MdConstruction size={16} />} sx={{width: "100%"}} title="Under Construction" color="orange">
                                            This region is still under construction.
                                        </Alert>
                                        : null
                            }
                            {description ?
                                < StatCard title={"DESCRIPTION"} Icon={MdDescription} noBigValue={true} skinny={true}
                                    additionalElement={
                                        <ScrollArea.Autosize maxHeight={"20vh"}>
                                            <RichTextEditor
                                                readOnly={true}
                                                value={description}
                                                sx={{
                                                    backgroundColor: 'transparent',
                                                    border: 'none',
                                                    padding: 0,
                                                    width: '100%',
                                                    lineBreak: 'auto',
                                                }}
                                            />
                                        </ScrollArea.Autosize>
                                    } />
                                : null
                            }

                            {editing ?
                                <StatCard title={"DESCRIPTION"} Icon={MdDescription} noBigValue={true}
                                    additionalElement={
                                        <ScrollArea.Autosize maxHeight={"40vh"}>
                                            <RichTextEditor value={description} onChange={setDescription} controls={[
                                                ['bold', 'italic', 'underline', 'link'],
                                                ['unorderedList', 'h1', 'h2', 'h3'],
                                                ['sup', 'sub'],
                                                ['alignLeft', 'alignCenter', 'alignRight']]}
                                                sx={{
                                                    maxWidth: '400px',
                                                    lineBreak: 'anywhere',
                                                }}
                                            />
                                        </ScrollArea.Autosize>
                                    } visible={editing} />
                                : null
                            }
                            <StatCard title={"Owner"}
                                innerImage={`https://crafatar.com/avatars/${region.userUUID}?size=64`}
                                value={region.username}
                                Icon={BsFillPersonFill}
                                subtitle={""}
                                editable={editing && isAdmin}
                                id={"owner"}
                                visible={plotType == "normal"}
                                onClickFunction={() => navigate(`/stats/${region.username}`)} />
                            <StatCard title={"Additional Builders"} noBigValue={true}
                                Icon={HiUserGroup} subtitle={""} visible={editing | region.additionalBuilder.length > 0 && plotType == "normal"}
                                additionalElement={
                                    <AdditionalBuilders showEditButtons={editing}
                                        openAdditionalBuilderModal={openAdditionalBuilderModal}
                                        additionalBuilders={editing ? additionalBuilders : region.additionalBuilder}
                                        removeBuilder={removeBuilder}
                                    />
                                } key={"additional-builders"} />

                            <StatCard title={"Region Properties"} value={null} Icon={MdConstruction} subtitle={""} visible={editing}
                                additionalElement={
                                    <Box>
                                        {editing && isAdmin ?
                                            <Radio.Group name="type" label="Region Type" value={plotType} onChange={setPlotType}>
                                                <Radio value="normal" label="Normal" />
                                                <Radio value="event" label="Event" />
                                                <Radio value="plot" label="Plot" />
                                            </Radio.Group>
                                            : null
                                        }
                                        <Checkbox checked={isFinished} onChange={(event) => setisFinished(event.currentTarget.checked)} label="mark as finished" mt={20} />
                                    </Box>
                                } showAdditionalElement={true} id={"status"} />

                            <StatCard title={"City"} value={region?.city} Icon={FaCity} subtitle={""} editable={editing && isAdmin}
                                id={"city"} />
                            <StatCard title={"Area"} value={numberWithCommas(region?.area) + " m²"} Icon={BiArea}
                                subtitle={""} />
                            <StatCard title={"Buildings"} value={numberWithCommas(region?.buildings)} Icon={BiBuilding}
                                subtitle={""} />
                        </Group>

                        {isUserLoggedIn ?
                            <Group spacing={"md"} cols={2} grow mt={"md"}>
                                {editing ?
                                    <Button color={"red"} leftIcon={<AiFillDelete />} onClick={showDeleteConfirmation}>Delete
                                        Region</Button>
                                    : null
                                }
                                {user?.data?.minecraftUUID ?
                                    <Button color={"blue"} leftIcon={<MdOutlineShareLocation />}
                                        onClick={teleportToRegion}>Teleport
                                        here</Button>
                                    : null
                                }

                                {!user?.data?.minecraftUUID ?
                                    <Button color={"blue"} leftIcon={<MdOutlineShareLocation />} component={Link}
                                        to={"/link"}>Teleport
                                        here</Button>
                                    : null
                                }
                            </Group>
                            :
                            <Button leftIcon={<FiLock size={14} />} fullWidth mt={"md"}
                                onClick={() =>login({redirectUrl: window.location.origin + "?region=" + region.id + "&details=true"})}>Login
                                to get more features</Button>
                        }

                        {!editing && (isAdmin | region.ownerID === user?.data?.id) ?
                            <Button fullWidth mt={"md"} onClick={() => {
                                setEditing(true);
                            }}>Edit the
                                values</Button> : null}
                        {editing ? <Button fullWidth mt={"md"} onClick={() => onSave()}>Save</Button> : null}
                        {editing ? <Button fullWidth mt={"md"} onClick={() => {setEditing(false);}}>Cancel</Button> : null}

                        <Accordion my={"md"}>
                            <Accordion.Item value="info">
                                <Accordion.Control>More information</Accordion.Control>
                                <Accordion.Panel>
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
                                            <tr>
                                                <td>OSM display name</td>
                                                <td>
                                                    <Tooltip
                                                        label={clipboard.copied ? "Copied" : "Click to copy"}
                                                        position="right"
                                                        color={clipboard.copied ? "green" : "gray"}
                                                        transition="scale"
                                                    >
                                                        <Code onClick={() => copyId(region.osmDisplayName)} sx={{
                                                            cursor: "pointer"
                                                        }}>{region.osmDisplayName}</Code>
                                                    </Tooltip>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>Last modified at: </td>
                                                <td>
                                                    <Tooltip>
                                                        <Code>{new Date(region.lastModified).toLocaleString()}</Code>
                                                    </Tooltip>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>Created at: </td>
                                                <td>
                                                    <Tooltip>
                                                        <Code>{new Date(region.createdAt).toLocaleString()}</Code>
                                                    </Tooltip>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </Table>
                                </Accordion.Panel>
                            </Accordion.Item>
                        </Accordion>
                        <Box style={{flex: 1}}></Box>
                        <Box style={{display: "flex", gap: "5px"}}>
                            <Box style={{flex: 1}}></Box>
                            {(!user?.data?.blockedFromReports && !region.isPlotRegion && !region.isEventRegion) ?
                                <Tooltip
                                    label="Report this region"
                                    position="right">

                                    <ActionIcon size="md" variant="light" onClick={openReportModal}>
                                        <IoMdFlag />
                                    </ActionIcon>
                                </Tooltip>
                                : null
                            }

                            <Tooltip
                                label={clipboard.copied ? "Copied" : "Copy a link to this region"}
                                position="right"
                                color={clipboard.copied ? "green" : "gray"}
                                ml={"sm"}>

                                <ActionIcon size="md" variant="light" onClick={() => copyLink(region.id)}>
                                    <AiOutlineLink />
                                </ActionIcon>
                            </Tooltip>
                        </Box>
                    </Box>
                </ScrollArea.Autosize>

            }
        </Drawer>
    );
};

const AdditionalBuilders = ({showEditButtons, openAdditionalBuilderModal, additionalBuilders, removeBuilder}) => {
    const { isUserLoggedIn, login, logout, oidcTokens, initializationError } = useOidc();

    const [load, setLoad] = useState(false);
    return (
        <div style={{width: "100%"}}>
            {
                additionalBuilders &&
                <Box sx={{width: "100%"}}>
                    {
                        additionalBuilders.map((builder, idx) => {
                            return (
                                <Box sx={{display: "flex", justifyContent: "space-between", width: "100%"}}>
                                    <Box key={idx} sx={{display: "flex", gap: "10px", alignItems: "center"}}>
                                        <img src={`https://crafatar.com/avatars/${builder.minecraftUUID}?size=20`}
                                            alt=""
                                            width={20} height={20} />
                                        <Text sx={{fontWeight: "bold"}}>{builder.username}</Text>
                                    </Box>
                                    {
                                        showEditButtons &&
                                        <ActionIcon onClick={() => removeBuilder(builder)} loading={load}>
                                            <AiOutlineDelete />
                                        </ActionIcon>
                                    }

                                </Box>
                            );
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
    );

};

export {RegionView};
