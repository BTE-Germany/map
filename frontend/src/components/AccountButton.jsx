/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + AccountButton.jsx                                                          +
 +                                                                            +
 + Copyright (c) 2022 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React, {useCallback} from 'react';
import {ActionIcon, Menu} from "@mantine/core";
import {AiOutlineUser} from "react-icons/ai";
import {FiGlobe, FiLink2, FiLock} from "react-icons/fi";
import {FaDiscord} from "react-icons/fa";
import {useKeycloak} from "@react-keycloak-fork/web";
import {Link} from "react-router-dom";
import {IoMdPaper} from "react-icons/io";
import {MdOutlinePrivacyTip} from "react-icons/md";
import {useUser} from "../hooks/useUser";
import {showNotification} from "@mantine/notifications";
import axios from "axios";
import {BiDotsVerticalRounded} from "react-icons/all";

const AccountButton = props => {

    const {keycloak} = useKeycloak()
    const user = useUser();


    const login = useCallback(() => {
        keycloak?.login()
    }, [keycloak])

    const logout = useCallback(() => {
        keycloak?.logout()
    }, [keycloak])

    const unlinkUser = async () => {
        await axios.post(`/api/v1/user/unlink`, {}, {headers: {authorization: "Bearer " + keycloak.token}})
        await user.updateData();
        showNotification({
            title: 'Unlink successful', message: 'Your account was unlinked successfully.', color: "green"
        })
    }

    return (<div>
            <Menu trigger="hover" delay={500}>
                <Menu.Target>
                    <ActionIcon variant="outline"><BiDotsVerticalRounded/></ActionIcon>
                </Menu.Target>

                <Menu.Dropdown>
                    <Menu.Label>Account</Menu.Label>
                    {keycloak?.authenticated && <Menu.Item icon={<AiOutlineUser size={14}/>}
                                                           disabled>Hey, {keycloak?.tokenParsed.preferred_username}</Menu.Item>}
                    {keycloak?.authenticated ?
                        <Menu.Item icon={<FiLock size={14}/>} onClick={() => logout()}>Logout</Menu.Item> :
                        <Menu.Item icon={<FiLock size={14}/>} onClick={() => login()}>Login</Menu.Item>}

                    {(keycloak?.authenticated && !user?.data?.minecraftUUID) &&
                        <Menu.Item icon={<FiLink2 size={14}/>} component={Link} to={"/link"}>Link Minecraft
                            Account</Menu.Item>}

                    {(keycloak?.authenticated && user?.data?.minecraftUUID) &&
                        <Menu.Item icon={<FiLink2 size={14}/>} onClick={unlinkUser}>Unlink Minecraft
                            Account</Menu.Item>}

                    <Menu.Divider/>
                    <Menu.Label>About</Menu.Label>
                    <Menu.Item component={"a"} href="https://buildthe.earth/de-d" target={"_blank"}
                               icon={<FaDiscord size={14}/>}>Discord
                        Server</Menu.Item>
                    <Menu.Item component={"a"} href="https://bte-germany.de" target={"_blank"}
                               icon={<FiGlobe size={14}/>}>Website</Menu.Item>
                    <Menu.Item component={"a"} href="https://robinferch.me/legal" target={"_blank"}
                               icon={<IoMdPaper size={14}/>}>Impressum</Menu.Item>
                    <Menu.Item component={"a"} href="https://robinferch.me/privacy" target={"_blank"}
                               icon={<MdOutlinePrivacyTip size={14}/>}>Privacy policy</Menu.Item>
                </Menu.Dropdown>
            </Menu>


        </div>);
}

export default AccountButton
