/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + AdminUsers.jsx                                                             +
 +                                                                            +
 + Copyright (c) 2022 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React, {useEffect} from 'react';
import axios from "axios";
import {useKeycloak} from "@react-keycloak/web";
import {ActionIcon, Badge, Box, Loader, Table, Tooltip} from "@mantine/core";
import {BsFileEarmarkLock2} from "react-icons/bs";
import {BiLockOpen} from "react-icons/bi";


const AdminUsers = props => {
    const [users, setUsers] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const {keycloak} = useKeycloak();

    useEffect(() => {
        getUsers();
    }, []);

    const getUsers = async () => {
        const {data} = await axios.get(`api/v1/admin/user/@list`, {headers: {authorization: "Bearer " + keycloak.token}});
        setUsers(data);
        setIsLoading(false);
    }
    const lockUser = async (user) => {
        await axios.post(`api/v1/admin/user/@lock`, {userId: user}, {headers: {authorization: "Bearer " + keycloak.token}});
        getUsers();
    }

    const unlockUser = async (user) => {
        await axios.post(`api/v1/admin/user/@unlock`, {userId: user}, {headers: {authorization: "Bearer " + keycloak.token}});
        getUsers();
    }

    const rows = users.map((element) => (
        <tr key={element.id}>
            <td>{element.username}</td>
            <td>{element.email}</td>
            <td>{element.emailVerified && <Badge color="lime">Verifizierte Mail</Badge>} {!element.totp &&
                <Badge color="yellow">Kein TOTP</Badge>} {!element.enabled && <Badge color="red">Gesperrt</Badge>}</td>
            <td>
                <Box sx={(theme) => {
                    return {
                        display: "flex",
                        gap: theme.spacing[2],
                    }
                }}>
                    {
                        element.enabled ? <Tooltip label="Sperren">
                            <ActionIcon color="red" variant="light" onClick={() => lockUser(element.id)}>
                                <BsFileEarmarkLock2/>
                            </ActionIcon>
                        </Tooltip> : <Tooltip label="Entsperren">
                            <ActionIcon color="green" variant="light" onClick={() => unlockUser(element.id)}>
                                <BiLockOpen/>
                            </ActionIcon>
                        </Tooltip>
                    }

                </Box>
            </td>
        </tr>
    ));


    return (
        <div>
            {
                isLoading ? <Loader/> :
                    <Table>
                        <thead>
                        <tr>
                            <th>Benutzername</th>
                            <th>E-Mail Adresse</th>
                            <th>Tags</th>
                            <th>Aktionen</th>
                        </tr>
                        </thead>
                        <tbody>{rows}</tbody>
                    </Table>
            }
        </div>
    );
}

export default AdminUsers
