/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + AdditionalBuildersDialog.jsx                                               +
 +                                                                            +
 + Copyright (c) 2022 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React, {useEffect, useState} from 'react';
import {Button, Checkbox, Group, Input, Loader, NativeSelect, Textarea} from "@mantine/core";
import {BsFillPersonFill} from "react-icons/bs";
import axios from "axios";
import {showNotification} from "@mantine/notifications";
import {useModals} from "@mantine/modals";

const AdditionalBuildersDialog = ({regionId, keycloak, onUsers}) => {
    const modals = useModals();
    const [loading, setLoading] = useState(false);
    const [username, setUsername] = useState('');
    const [userData, setUserData] = useState(null);
    const [sending, setSending] = useState(false);
    useEffect(() => {
        if (username) {
            searchUser();
        } else {
            setUserData(null)
        }

    }, [username]);

    const searchUser = async () => {
        setLoading(true);
        let {data: userData} = await axios.get('https://playerdb.co/api/player/minecraft/' + username)
            .catch(() => {
                setUserData(null)
                setLoading(false);
            });
        if (!userData.success) {
            setLoading(false);
            setUserData(null)
        } else {
            setUserData(userData.data.player);
            setLoading(false);
        }
    }

    // const addUser = () => {
    //     setSending(true);
    //     axios.post(`/api/v1/region/${regionId}/additionalBuilder`, {
    //         username: username
    //     }, {headers: {authorization: "Bearer " + keycloak.token}})
    //         .then(({data}) => {
    //             showNotification({
    //                 title: 'Success',
    //                 message: 'Builder added',
    //                 color: "green"
    //             })
    //             setSending(false);
    //             setUsername("");
    //             modals.closeAll();
    //         })
    //         .catch((e) => {
    //             setSending(false);
    //             setUsername("");
    //             if (e.response.data === "Builder already exists") {
    //                 showNotification({
    //                     title: 'Error',
    //                     message: 'Builder already exists',
    //                     color: "red"
    //                 })
    //                 return;
    //             }
    //             showNotification({
    //                 title: 'Failed',
    //                 message: 'An unexpected error occurred.',
    //                 color: "red"
    //             })

    //         })
    // }
    return (
        <div>
            <form onSubmit={(e) => {
                e.preventDefault();
                if (userData) {
                    onUsers(username)
                    //addUser();
                }
            }}>
                <Input
                    icon={!userData ? <BsFillPersonFill/> :
                        <img src={`https://crafatar.com/avatars/${userData.id}?size=20`} alt=""/>}
                    placeholder="Minecraft username or UUID"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    rightSection={
                        loading && <Loader width={20}/>
                    }
                    disabled={sending}
                />
                <Button color={"green"} sx={{float: "right"}} mt={"md"} type={"submit"} disabled={!userData || sending}>
                    Add builder
                </Button>
            </form>


        </div>
    );
}

export default AdditionalBuildersDialog
