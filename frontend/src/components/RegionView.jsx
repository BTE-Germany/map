import React, {useEffect, useState} from 'react';
import {Accordion, Box, Code, Drawer, Group, Image, Loader, Paper, Table, Title, Tooltip} from "@mantine/core";
import axios from "axios";
import {useClipboard} from "@mantine/hooks";
import {centerOfMass, polygon} from "@turf/turf";
import StatCard from "./StatCard";
import {FaCity} from "react-icons/fa";
import {BiArea} from "react-icons/bi";

const RegionView = ({data, open, setOpen}) => {

    if(!data) return null;

    const [loading, setLoading] = useState(true);
    const clipboard = useClipboard({timeout: 800});
    const [center, setCenter] = useState([0, 0]);
    const [region, setRegion] = useState(null);

    const numberWithCommas = (x) => {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    useEffect(() => {
        setLoading(true);
        getData();
    }, [data]);

    const getData = async () => {
        const region = await axios.get(`http://localhost:8899/api/v1/region/${data.id}`)
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
                    <Paper shadow="md" p="md" withBorder sx={{display: "flex", alignItems: "center"}} mt={"xl"} radius={"md"} mb={"md"}>
                        <Image src={`https://crafatar.com/avatars/${data.userUuid}?size=64`} alt="" radius={"md"}
                               style={{width: 64}}/>
                        <Title ml={"md"} order={3}>{data.username}</Title>
                    </Paper>

                    <Group spacing={"md"} cols={1} >
                        <StatCard title={"City"} value={region?.city} Icon={FaCity} subtitle={""} />
                        <StatCard title={"Area"} value={numberWithCommas(region?.area) + " m²"} Icon={BiArea} subtitle={""}/>
                    </Group>


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

                </Box>
            }


        </Drawer>
    );
}

export default RegionView
