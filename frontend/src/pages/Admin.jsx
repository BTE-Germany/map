/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + Admin.jsx                                                                  +
 +                                                                            +
 + Copyright (c) 2022 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React, {useCallback} from "react";
import {Container, Tabs, Title} from "@mantine/core";
import NavHeader from "../components/NavHeader";
import {HiOutlineMap} from "react-icons/hi";
import {FiUsers} from "react-icons/fi";
import AdminUsers from "../components/AdminUsers";
import AdminRegions from "../components/AdminRegions";
import {useKeycloak} from "@react-keycloak-fork/web";

const Admin = () => {
    //simple admin check
    const {keycloak} = useKeycloak();
    const login = useCallback(() => {
        keycloak?.login();
    }, [keycloak]);

    const isAdmin =
        keycloak?.tokenParsed?.realm_access.roles.includes("mapadmin");
    if (!keycloak?.authenticated) {
        return (
            <h1>
                Not logged in!{" "}
                <u onClick={() => login()}>Click here to login</u>
            </h1>
        );
    }
    if (!isAdmin) {
        return <h1>Not authorized - go back</h1>;
    }

    return (
        <div>
            <NavHeader />
            <Container mt={"md"}>
                <Title>Administration</Title>
                <Tabs defaultValue="Benutzer">
                    <Tabs.List>
                        <Tabs.Tab value="Benutzer" icon={<FiUsers size={14} />}></Tabs.Tab>
                        <Tabs.Tab value="Regionen" icon={<HiOutlineMap size={14} />}></Tabs.Tab>
                    </Tabs.List>
                    <Tabs.Panel value="Benutzer">
                        <AdminUsers />
                    </Tabs.Panel>
                    <Tabs.Panel value="Regionen">
                        <AdminRegions />
                    </Tabs.Panel>
                </Tabs>
            </Container>
        </div>
    );
};

export default Admin;
