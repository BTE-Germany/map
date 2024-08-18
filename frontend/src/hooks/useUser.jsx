/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + useUser.jsx                                                                +
 +                                                                            +
 + Copyright (c) 2022-2024 Robin Ferch                                        +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React, {useState, useEffect, useContext, createContext} from "react";
import {useKeycloak} from "@react-keycloak-fork/web";
import axios from "axios";
import {useLocation} from 'react-router-dom';
import {useOidc} from "../oidc";

const authContext = createContext();


export function ProvideAuth({children}) {
    const auth = useProvideAuth();
    return <authContext.Provider value={auth}>{children}</authContext.Provider>;
}

export const useUser = () => {
    return useContext(authContext);
};

function useProvideAuth() {
    const [data, setData] = useState(null);
    const { isUserLoggedIn, login, logout, oidcTokens } = useOidc();
    const location = useLocation();

    const updateData = async () => {
        if (isUserLoggedIn) {
            axios.get("/api/v1/user/@me", {headers: {authorization: "Bearer " + oidcTokens.accessToken}})
                .then(({data: user}) => {
                    setData(user);
                })
        }
    }

    useEffect(() => {
        if (isUserLoggedIn) {
            axios.get("/api/v1/user/@me", {headers: {authorization: "Bearer " + oidcTokens.accessToken}})
                .then(({data: user}) => {
                    setData(user);
                })
        }
    }, [isUserLoggedIn, location]);
    return {
        data,
        updateData
    };
}
