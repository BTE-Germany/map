/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + Stats.jsx                                                                  +
 +                                                                            +
 + Copyright (c) 2022-2023 Robin Ferch                                        +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React, {useEffect, useState} from 'react';
import NavHeader from "../components/NavHeader";
import {
    Box,
    Container,
    Group,
    Loader,
    Paper,
    Text,
    ThemeIcon,
    Title,
    createStyles,
    Grid,
    Table,
    Pagination
} from "@mantine/core";
import axios from "axios";
import {FiList} from "react-icons/fi";
import {BiArea, BiBuilding} from "react-icons/bi";

const useStyles = createStyles((theme) => ({
    root: {
        padding: theme.spacing.xl * 1.5,
    },

    label: {
        fontFamily: `Greycliff CF, ${theme.fontFamily}`,
    },
}));

const Stats = props => {

    const [generalStats, setGeneralStats] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activePage, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    useEffect(() => {
        getData();
    }, []);

    useEffect(() => {
        getLeaderboard();
    }, [activePage])

    const getData = async () => {
        const {data: generalData} = await axios.get("/api/v1/stats/general")
        const {data: leaderboardData} = await axios.get("/api/v1/stats/leaderboard?page=" + (activePage - 1))
        setGeneralStats(generalData);
        setLeaderboard(leaderboardData.leaderboard);
        setTotalPages(Math.ceil(leaderboardData.count / 10));

        setLoading(false);
    }

    const getLeaderboard = async () => {
        const {data: leaderboardData} = await axios.get("/api/v1/stats/leaderboard?page=" + (activePage - 1))
        setLeaderboard(leaderboardData.leaderboard);
        setTotalPages(Math.ceil(leaderboardData.count / 10));
    }

    const numberWithCommas = (x) => {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }


    return (
        <div>
            <NavHeader/>
            <Container mt={"md"}>
                {
                    loading ? <Loader/> :
                        <Box>
                            <Title mb={"md"}>Stats</Title>
                            <Grid>
                                <Grid.Col sm={12} lg={6}><StatsCard icon={<FiList/>} title={"Total number of regions"}
                                                                    value={parseInt(generalStats.regionCount).toLocaleString()}
                                /></Grid.Col>
                                <Grid.Col sm={12} lg={6}><StatsCard icon={<BiBuilding/>} title={"Finished Buildings"}
                                                                    value={parseInt(generalStats.totalBuildings).toLocaleString()}
                                /></Grid.Col>
                                <Grid.Col sm={12} lg={6}><StatsCard icon={<BiArea/>} title={"Total area of all regions"}
                                                                    value={numberWithCommas(generalStats.totalArea) + " m²"}
                                                                    valueSmall={"this is about " + ((generalStats.totalArea / 357386000000) * 100).toFixed(10).toLocaleString() + "% of Germany's area"}/></Grid.Col>
                            </Grid>

                            <Title my={"md"}>Leaderboard</Title>

                            <Table>
                                <thead>
                                <tr>
                                    <th>Builder</th>
                                    <th>Area</th>
                                    <th>Buildings</th>
                                </tr>
                                </thead>
                                <tbody>
                                {
                                    leaderboard.map((player, idx) => {
                                        return (
                                            <tr key={idx}>
                                                {
                                                    player.username === "BTE Germany Event" || player.username == "Plot Region" ?
                                                        <td style={{display: "flex", alignItems: "center", gap: "5px"}}>
                                                            <img
                                                                src={`https://bte-germany.de/logo.gif`}
                                                                alt="" width={20}/> {player.username}</td> :
                                                        <td style={{display: "flex", alignItems: "center", gap: "5px"}}>
                                                            <img
                                                                src={`https://minotar.net/avatar/${encodeURIComponent(player.username)}/20`}
                                                                alt=""/> {player.username}</td>
                                                }
                                                <td>{player.area} m²</td>
                                                <td>{player.buildings}</td>
                                            </tr>
                                        )
                                    })
                                }
                                </tbody>
                            </Table>
                            <Pagination page={activePage} onChange={setPage} total={totalPages} mt={"md"}/>
                        </Box>
                }
            </Container>

        </div>
    );
}

const StatsCard = ({title, value, icon, valueSmall}) => {
    const {classes} = useStyles();
    return (
        <Paper withBorder p="md" radius="md">
            <Group position="apart">
                <div>
                    <Text
                        color="dimmed"
                        transform="uppercase"
                        weight={700}
                        size="xs"
                        className={classes.label}
                    >
                        {title}
                    </Text>
                    <Text weight={700} size="xl">
                        {value}
                    </Text>
                </div>
                <ThemeIcon
                    color="gray"
                    variant="light"
                    sx={(theme) => ({color: theme.colors.teal[6]})}
                    size={38}
                    radius="md"
                >
                    {icon}
                </ThemeIcon>
            </Group>
            {valueSmall && <Text color="dimmed" size="sm" mt="sm">
                {valueSmall}
            </Text>}

        </Paper>
    )
}

export default Stats
