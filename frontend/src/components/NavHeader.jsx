/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + NavHeader.jsx                                                              +
 +                                                                            +
 + Copyright (c) 2022 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React, {useEffect, useState} from 'react';
import {ActionIcon, Box, Burger, Container, Group, AppShell, Paper, Transition} from "@mantine/core";
import {Link, useLocation} from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import AccountButton from "./AccountButton";
import {useKeycloak} from "@react-keycloak-fork/web";
import {AiOutlineUser, AiOutlineSearch} from "react-icons/ai";
import {openSpotlight} from "@mantine/spotlight";
import {useUser} from "../hooks/useUser";
import {useDisclosure} from "@mantine/hooks";
import classes from "./NavHeader.module.css";
import cx from "classnames";


const HEADER_HEIGHT = 60;


const NavHeader = ({mapRef}) => {

    const {keycloak} = useKeycloak();
    const links = [
        {
            "link": "/",
            "label": "Map"
        },
        {
            "link": "/stats",
            "label": "Stats"
        },
    ];
    const [opened, handlers] = useDisclosure(false);
    let location = useLocation();
    const [active, setActive] = useState("/");


    useEffect(() => {
        setActive(location.pathname);
    }, [location]);

    const items = links.map((link) => (
        <Link
            key={link.label}
            to={link.link}
            className={cx(classes.link, {[classes.linkActive]: active === link.link})}
            onClick={() => {
                setActive(link.link);
                handlers.close();
            }}
        >
            {link.label}
        </Link>
    ));

    return (
        <div>
            <AppShell>
                <AppShell.Header height={HEADER_HEIGHT} className={classes.root}>
                    <Container className={classes.header}>
                        <Box className={classes.logo}>
                            <img src="https://bte-germany.de/logo.gif" alt="" width={35} />
                            <span>BTE Germany Map</span>
                        </Box>
                        <Box className={classes.options}>
                            <Group spacing={5} className={classes.links} mr={"md"}>
                                {items}
                                {
                                    keycloak?.tokenParsed?.realm_access.roles.includes("mapadmin") && <Link
                                        to={"/admin"}
                                        className={cx(classes.link, {[classes.linkActive]: active === "/admin"})}
                                        onClick={() => {
                                            setActive("/admin");
                                            handlers.close();
                                        }}
                                    >
                                        Admin
                                    </Link>
                                }

                            </Group>
                            <ThemeToggle />
                            <Box ml={"md"} style={{display: "flex"}}>
                                <AccountButton />
                                {
                                    mapRef && <ActionIcon ml={"sm"} variant="outline"
                                        onClick={() => openSpotlight()}><AiOutlineSearch /></ActionIcon>
                                }
                            </Box>

                        </Box>

                        <Burger
                            opened={opened}
                            onClick={() => handlers.toggle()}
                            className={classes.burger}
                            size="sm"
                        />

                        <Transition transition="pop-top-right" duration={200} mounted={opened}>
                            {(styles) => (
                                <Paper className={classes.dropdown} withBorder style={styles}>
                                    {items}
                                </Paper>
                            )}
                        </Transition>
                    </Container>
                </AppShell.Header>
            </AppShell>
        </div>
    );
};

export default NavHeader;
