/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + AdminGeneral.jsx                                                           +
 +                                                                            +
 + Copyright (c) 2023 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React, {useEffect, useState} from 'react';
import {Button, Checkbox, Progress, Title} from "@mantine/core";
import axios from "axios";
import {useKeycloak} from "@react-keycloak-fork/web";

const AdminGeneral = props => {

    const [progress, setProgess] = useState(0);
    const [allCount, setAllCount] = useState(0);
    const [allBuildingsCount, setAllBuildingsCount] = useState(0);
    const [skipOld, setSkipOld] = useState(false);

    const {keycloak} = useKeycloak();

    useEffect(() => {
        let interval;
        axios.get("/api/v1/stats/general").then(({data: statsData}) => {
            setAllCount(statsData.regionCount)
            interval = setInterval(async () => {
                console.log("test123")
                const {data: progress} = await axios.get(`/api/v1/admin/calculateProgress`,
                    {headers: {authorization: "Bearer " + keycloak.token}})

                const {data: stats} = await axios.get(`/api/v1/stats/general`)
                setAllBuildingsCount(stats.totalBuildings)
                setProgess(progress / statsData.regionCount * 100)
            }, 2000)
        })

        return () => clearInterval(interval);

    }, []);

    const start = () => {
        setProgess(0.0000000001);
        axios.get(`/api/v1/admin/recalculateBuildings${skipOld ? "?skipOld=true" : ""}`, {headers: {authorization: "Bearer " + keycloak.token}}).then(({data}) => {
            showNotification({
                title: "Ok",
                message: `${data.count} Regionen werden neu berechnet`
            })
        })
    }


    return (
        <div>
            <Button mt={"xl"} loading={progress > 0} onClick={() => start()}>Anzahl der Buildings berechnen</Button>
            <Checkbox label={"Nur neue Regionen (Regionen mit Anzahl > 0 werden übersprungen)"} mt={"md"}
                      value={skipOld} onChange={(event) => setSkipOld(event.currentTarget.checked)}/>
            {
                progress > 0 &&
                <Progress value={progress} label={`${Math.round(progress)}%`} animate mt={"xl"} radius="xl" size="xl"/>
            }
            {
                <Title mt={"xl"}>Aktuell {allBuildingsCount} Gebäude</Title>
            }

        </div>
    );
}

export default AdminGeneral
