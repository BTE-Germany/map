/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + useUser.jsx                                                                +
 +                                                                            +
 + Copyright (c) 2022 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React, {useState, useEffect, useContext, createContext} from "react";
import {useKeycloak} from "@react-keycloak/web";
import axios from "axios";
import {useLocation} from 'react-router-dom';

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
    const {keycloak} = useKeycloak();
    const location = useLocation();

    const updateData = async () => {
        if (keycloak && keycloak.authenticated) {
            axios.get("/api/v1/user/@me", {headers: {authorization: "Bearer " + keycloak.token}})
                .then(({data: user}) => {
                    setData(user);
                })
        }
    }

    useEffect(() => {
        if (keycloak && keycloak.authenticated) {
            axios.get("/api/v1/user/@me", {headers: {authorization: "Bearer " + keycloak.token}})
                .then(({data: user}) => {
                    setData(user);
                })
        }
    }, [keycloak, location]);
    return {
        data,
        updateData
    };
}
