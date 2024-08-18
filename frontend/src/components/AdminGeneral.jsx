/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + AdminGeneral.jsx                                                           +
 +                                                                            +
 + Copyright (c) 2023-2024 Robin Ferch                                        +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React, {useEffect, useState} from 'react';
import {Button, Checkbox, Paper, Progress, Title, Badge, Group, Alert} from "@mantine/core";
import axios from "axios";
import {useKeycloak} from "@react-keycloak-fork/web";
import {IoIosWarning} from "react-icons/io";
import {showNotification} from "@mantine/notifications";
import {useOidc} from "../oidc";

const AdminGeneral = props => {

    const [progress, setProgress] = useState(0);
    const [osmProgress, setOsmProgress] = useState(0);
    const [allCount, setAllCount] = useState(0);
    const [allBuildingsCount, setAllBuildingsCount] = useState(0);
    const [skipOld, setSkipOld] = useState(false);
    const [skipOldOsm, setSkipOldOsm] = useState(false);

    const { isUserLoggedIn, login, logout, oidcTokens } = useOidc();

    useEffect(() => {
        let interval;
        axios.get("/api/v1/stats/general").then(({data: statsData}) => {
            setAllCount(statsData.regionCount)
            setAllBuildingsCount(statsData.totalBuildings)
            interval = setInterval(async () => {
                const {data: progress} = await axios.get(`/api/v1/admin/calculateProgress`,
                    {headers: {authorization: "Bearer " + oidcTokens.accessToken}})
                const {data: progressOsm} = await axios.get(`/api/v1/admin/osmDisplayNameProgress`,
                    {headers: {authorization: "Bearer " + oidcTokens.accessToken}})

                const {data: stats} = await axios.get(`/api/v1/stats/general`)
                setAllBuildingsCount(stats.totalBuildings)
                setProgress(progress / statsData.regionCount * 100)
                setOsmProgress(progressOsm / statsData.regionCount * 100)
            }, 2000)
        })

        return () => clearInterval(interval);

    }, []);

    const start = () => {
        setProgress(0.0000000001);
        axios.get(`/api/v1/admin/recalculateBuildings${skipOld ? "?skipOld=true" : ""}`, {headers: {authorization: "Bearer " + oidcTokens.accessToken}}).then(({data}) => {
            showNotification({
                title: "Ok",
                message: `${data.count} Regionen werden neu berechnet`
            })
        })
    }

    const startOsm = () => {
        setOsmProgress(0.0000000001);
        axios.get(`/api/v1/admin/getOsmDisplayNames${skipOld ? "?skipOld=true" : ""}`, {headers: {authorization: "Bearer " + oidcTokens.accessToken}}).then(({data}) => {
            showNotification({
                title: "Ok",
                message: `Von ${data.count} Regionen werden die OSM Namen geholt.`,
                color: "hreen"
            })
        })
    }

    const syncSearch = async () => {
        showNotification({
            title: 'Ok',
            message: 'Synchronisiere Search-DB',
            color: "green"
        })
        await axios.get(`/api/v1/admin/syncWithSearchDB`, {headers: {authorization: "Bearer " + oidcTokens.accessToken}})
        showNotification({
            title: 'Fertig',
            message: 'Synchronisierung abgeschlossen',
            color: "green"
        })
    }


    return (
        <div>

            <Paper withBorder shadow={"md"} radius={"md"} p={"xl"} mt={"md"}>
                <Group>
                    <Title>Buildings</Title>
                    <Badge>Aktuell {allBuildingsCount} Gebäude</Badge>
                </Group>

                <Button mt={"xl"} loading={progress > 0} onClick={() => start()}>Anzahl der Buildings berechnen</Button>
                <Checkbox label={"Nur neue Regionen (Regionen mit Anzahl > 0 werden übersprungen)"} mt={"md"}
                          value={skipOld} onChange={(event) => setSkipOld(event.currentTarget.checked)}/>
                {
                    progress > 0 &&
                    <Progress value={progress} label={`${Math.round(progress)}%`} animate mt={"xl"} radius="xl"
                              size="xl"/>
                }
            </Paper>

            <Paper withBorder shadow={"md"} radius={"md"} p={"xl"} mt={"md"}>
                <Group>
                    <Title>Search</Title>

                </Group>

                <Alert color={"red"} icon={<IoIosWarning size={18}/>} mt={"sm"}>
                    Der gesamte Index wird gelöscht und danach neu erstellt!
                </Alert>
                <Button color={"red"} mt={"md"} onClick={() => syncSearch()}>Daten neu synchronisieren</Button>
            </Paper>

            <Paper withBorder shadow={"md"} radius={"md"} p={"xl"} mt={"md"}>
                <Group>
                    <Title>OSM Display Name</Title>
                </Group>

                <Button mt={"xl"} loading={osmProgress > 0} onClick={() => startOsm()}>OSM Display Name neu
                    holen</Button>
                <Checkbox label={"Nur neue Regionen (Regionen mit Display Name werden übersprungen)"} mt={"md"}
                          value={skipOldOsm} onChange={(event) => setSkipOldOsm(event.currentTarget.checked)}/>
                {
                    osmProgress > 0 &&
                    <Progress value={osmProgress} label={`${Math.round(osmProgress)}%`} animate mt={"xl"} radius="xl"
                              size="xl"/>
                }
            </Paper>


        </div>
    );
}

export default AdminGeneral
