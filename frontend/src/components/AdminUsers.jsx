/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + AdminUsers.jsx                                                             +
 +                                                                            +
 + Copyright (c) 2022-2024 Robin Ferch                                        +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React, {useEffect} from "react";
import axios from "axios";
import {useKeycloak} from "@react-keycloak-fork/web";
import {ActionIcon, Badge, Box, Group, Loader, Select, Table, Tooltip, Pagination} from "@mantine/core";
import {BsFileEarmarkLock2} from "react-icons/bs";
import {BiLockOpen} from "react-icons/bi";
import {useOidc} from "../oidc";

const AdminUsers = (props) => {
    const [users, setUsers] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [activePage, setPage] = React.useState(1);
    const [currentPageSize, setPageSize] = React.useState(25);
    const [totalPages, setTotalPages] = React.useState(12);
    const { isUserLoggedIn, login, logout, oidcTokens } = useOidc();


    useEffect(() => {
        getUsers();
    }, []);

    const pageSwitch = (page) => {
        setPage(page);
        getUsers(page, currentPageSize);
    };

    const pageSizeChange = (size) => {
        setPageSize(size);
        getUsers(activePage, size);
    };

    const getUsers = async (currentPage, pageSize) => {
        //check if current page is undefined
        currentPage = currentPage === undefined ? activePage : currentPage;
        pageSize = pageSize === undefined ? currentPageSize : pageSize;
        const {data} = await axios.get(`api/v1/admin/user/@list`, {
            headers: {authorization: "Bearer " + oidcTokens.accessToken},
            params: {page: currentPage, size: pageSize}
        });
        setTotalPages(data.totalPages);
        setUsers(data.data);
        setIsLoading(false);
    };
    const lockUser = async (user) => {
        await axios.post(
            `api/v1/admin/user/@lock`,
            {userId: user},
            {headers: {authorization: "Bearer " + oidcTokens.accessToken}}
        );
        getUsers();
    };

    const unlockUser = async (user) => {
        await axios.post(
            `api/v1/admin/user/@unlock`,
            {userId: user},
            {headers: {authorization: "Bearer " + oidcTokens.accessToken}}
        );
        getUsers();
    };

    const rows = users.map((element) => (
        <tr key={element.id}>
            <td>{element.username}</td>
            <td>{element.email}</td>
            <td>
                {element.emailVerified && (
                    <Badge color="lime">Verifizierte Mail</Badge>
                )}{" "}
                {!element.totp && <Badge color="yellow">Kein 2FA</Badge>}{" "}
                {!element.enabled && <Badge color="red">Gesperrt</Badge>}
            </td>
            <td>
                <Box
                    sx={(theme) => {
                        return {
                            display: "flex",
                            gap: theme.spacing[2],
                        };
                    }}
                >
                    {element.enabled ? (
                        <Tooltip label="Sperren">
                            <ActionIcon
                                color="red"
                                variant="light"
                                onClick={() => lockUser(element.id)}
                            >
                                <BsFileEarmarkLock2 />
                            </ActionIcon>
                        </Tooltip>
                    ) : (
                        <Tooltip label="Entsperren">
                            <ActionIcon
                                color="green"
                                variant="light"
                                onClick={() => unlockUser(element.id)}
                            >
                                <BiLockOpen />
                            </ActionIcon>
                        </Tooltip>
                    )}
                </Box>
            </td>
        </tr>
    ));

    return (
        <div>
            {isLoading ? (
                <Loader />
            ) : (
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
            )}
            <Group>
                <Pagination page={activePage} onChange={pageSwitch} total={totalPages} />
                <Select value={currentPageSize} onChange={pageSizeChange} data={[
                    {label: '10', value: 10},
                    {label: '25', value: 25},
                    {label: '50', value: 50},
                    {label: '100', value: 100},
                    {label: '200', value: 200},
                    {label: '500', value: 500},
                    {label: '1000', value: 1000}
                ]} />
            </Group>
        </div>
    );
};

export default AdminUsers;
