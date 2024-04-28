/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + UserStats.jsx                                                                  +
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
import {useNavigate} from "react-router-dom";

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
    const [username, setUsername] = useState("");
    const [userRegions, setUserRegions] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        getData();
    }, []);

    const getData = async () => {
        const url = new URL(window.location.href);
        const uname = url.pathname.split("/").pop();
        setUsername(uname);

        try {
            const {data: udata} = await axios.get(`https://playerdb.co/api/player/minecraft/${uname}`);
            const {data: userRegions} = await axios.get("/api/v1/user/" + udata.data.player.id + "/regions");
            console.log(userRegions);
            setUserRegions(userRegions);
            const {data: userStats} = await axios.get("/api/v1/user/" + udata.data.player.id + "/stats");
            setGeneralStats(userStats);
            console.log(userStats);
            setLoading(false);
        } catch (error) {
            if (error.response && error.response.status === 400) {
                alert("Bad Request: Invalid username");
                navigate("/");
            } else {
                alert("An error occurred. Please try again later.");
            }
            setLoading(false);
        }
    };

    const getChartData = () => {
        const colors = ["#FF6633", "#FFB399", "#FF33FF", "#FFFF99", "#00B3E6"];
        const data = generalStats.cities.map(city => {
            return {
                name: city.city,
                value: city._count.city,
                color: colors[Math.floor(Math.random() * colors.length)]
            };
        });
        console.log(data);
        return data;
    };

    const numberWithCommas = (x) => {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };


    return (
        <div>
            <NavHeader />
            <Container mt={"md"}>
                {
                    loading ? <Loader /> :
                        <Box>
                            <Title mb={"md"}>Stats of {username}</Title>
                            <Grid>
                                <Grid.Col sm={12} lg={6}><StatsCard icon={<FiList />} title={"Total number of regions"}
                                    value={parseInt(generalStats.regionCount).toLocaleString()} /></Grid.Col>
                                <Grid.Col sm={12} lg={6}><StatsCard icon={<BiBuilding />} title={"Total Buildings (finished / started)"}
                                    value={parseInt(generalStats.totalFinishedBuildings).toLocaleString() + " / " + parseInt(generalStats.totalBuildings).toLocaleString()} /></Grid.Col>
                                <Grid.Col sm={12} lg={6}><StatsCard icon={<BiArea />} title={"Total area of all regions"}
                                    value={numberWithCommas(generalStats.totalArea) + " m²"}
                                    valueSmall={"this is about " + ((generalStats.totalArea / 357386000000) * 100).toFixed(10).toLocaleString() + "% of Germany's area"} /></Grid.Col>
                                <Grid.Col sm={12} lg={6}><StatsCard icon={<BiArea />} title={"finished Area "}
                                    value={numberWithCommas(generalStats.totalFinishedArea) + " m²"}
                                    valueSmall={"this is about " + ((generalStats.totalFinishedArea / 357386000000) * 100).toFixed(10).toLocaleString() + "% of Germany's area"} /></Grid.Col>
                            </Grid>
                            <Title mt={"xl"} mb={"md"}>Regions</Title>

                            {
                                generalStats.regionCount == 0 ?
                                    <Text>No regions found</Text> :
                                    <Grid>

                                        <Table>
                                            <thead>
                                                <tr>
                                                    <th>City</th>
                                                    <th>Area</th>
                                                    <th>Buildings</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {
                                                    userRegions.map((region, index) => {
                                                        return (
                                                            <tr key={index}>
                                                                <td>{region.city}</td>
                                                                <td>{numberWithCommas(region.area)} m²</td>
                                                                <td>{region.buildings}</td>
                                                            </tr>
                                                        );
                                                    })
                                                }
                                            </tbody>
                                        </Table>
                                    </Grid>
                            }
                            <Pagination page={activePage} onChange={setPage} total={totalPages} mt={"md"} />
                        </Box>
                }
            </Container>

        </div>
    );
};

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
    );
};

export default Stats;
