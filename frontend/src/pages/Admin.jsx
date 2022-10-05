/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + Admin.jsx                                                                  +
 +                                                                            +
 + Copyright (c) 2022 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React from 'react';
import { Container, Tabs, Title } from "@mantine/core";
import NavHeader from "../components/NavHeader";
import { HiOutlineMap } from "react-icons/hi";
import { FiUsers } from "react-icons/fi";
import AdminUsers from "../components/AdminUsers";

const Admin = props => {
    return (
        <div>
            <NavHeader />
            <Container mt={"md"}>
                <Title>Administration</Title>
                <Tabs mt={"md"}>
                    <Tabs.Tab label="Benutzer" icon={<FiUsers size={14} />}>
                        <AdminUsers />
                    </Tabs.Tab>
                    <Tabs.Tab label="Regionen" icon={<HiOutlineMap size={14}/>}>lander stinkt (mischa auch)</Tabs.Tab>

                </Tabs>
            </Container>
        </div>
    );
}

export default Admin
