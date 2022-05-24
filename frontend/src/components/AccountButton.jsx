/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + AccountButton.jsx                                                          +
 +                                                                            +
 + Copyright (c) 2022 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React, {useCallback} from 'react';
import {ActionIcon, Divider, Menu, Tooltip} from "@mantine/core";
import {AiOutlineUser} from "react-icons/ai";
import {FiLock, FiGlobe, FiLink2} from "react-icons/fi";
import {FaDiscord} from "react-icons/fa";
import {useKeycloak} from "@react-keycloak/web";
import {Link} from "react-router-dom";
import {IoMdPaper} from "react-icons/io";
import {MdOutlinePrivacyTip} from "react-icons/md";

const AccountButton = props => {

    const {keycloak} = useKeycloak()

    const login = useCallback(() => {
        keycloak?.login()
    }, [keycloak])

    const logout = useCallback(() => {
        keycloak?.logout()
    }, [keycloak])

    return (
        <div>


            <Menu trigger="hover" delay={500} control={<ActionIcon variant="outline"><AiOutlineUser/></ActionIcon>}>
                <Menu.Label>Account</Menu.Label>
                {
                    keycloak?.authenticated && <Menu.Item icon={<AiOutlineUser size={14}/>}
                                                          disabled>Hey, {keycloak?.tokenParsed.preferred_username}</Menu.Item>
                }
                {
                    keycloak?.authenticated ?
                        <Menu.Item icon={<FiLock size={14}/>} onClick={() => logout()}>Logout</Menu.Item> :
                        <Menu.Item icon={<FiLock size={14}/>} onClick={() => login()}>Login</Menu.Item>
                }

                {
                    keycloak?.authenticated &&
                    <Menu.Item icon={<FiLink2 size={14}/>} component={Link} to={"/link"}>Link Minecraft
                        Account</Menu.Item>
                }

                <Divider/>
                <Menu.Label>About</Menu.Label>
                <a href="https://buildthe.earth/de-d" target={"_blank"}><Menu.Item icon={<FaDiscord size={14}/>}>Discord
                    Server</Menu.Item></a>
                <a href="https://bte-germany.de" target={"_blank"}><Menu.Item
                    icon={<FiGlobe size={14}/>}>Website</Menu.Item></a>
                <a href="https://robinferch.me/legal" target={"_blank"}><Menu.Item
                    icon={<IoMdPaper size={14}/>}>Impressum</Menu.Item></a>
                <a href="https://robinferch.me/privacy" target={"_blank"}><Menu.Item
                    icon={<MdOutlinePrivacyTip size={14}/>}>Privacy policy</Menu.Item></a>


            </Menu>

        </div>
    );
}

export default AccountButton
