/******************************************************************************
 * KeycloakAdmin.ts                                                           *
 *                                                                            *
 * Copyright (c) 2022-2023 Robin Ferch                                        *
 * https://robinferch.me                                                      *
 * This project is released under the MIT license.                            *
 ******************************************************************************/


import Core from "../Core.js";
import KcAdminClient from '@keycloak/keycloak-admin-client';


class KeycloakAdmin {
    private kcAdminClient: KcAdminClient;
    private core: Core;

    constructor(core: Core) {
        this.core = core;
        this.kcAdminClient = new KcAdminClient({
            baseUrl: process.env.KEYCLOAK_URL,
            realmName: process.env.KEYCLOAK_REALM
        })

    }

    public getKeycloakAdminClient() {
        return this.kcAdminClient;
    }

    public async authKcClient() {

        setInterval(() => this.kcAdminClient.auth({
            grantType: "client_credentials",
            clientId: process.env.KEYCLOAK_CLIENTID,
            clientSecret: process.env.KEYCLOAK_CLIENTSECRET,
        }), 58 * 1000);
        return await this.kcAdminClient.auth({
            grantType: "client_credentials",
            clientId: process.env.KEYCLOAK_CLIENTID,
            clientSecret: process.env.KEYCLOAK_CLIENTSECRET,
        });
    }
}

export default KeycloakAdmin;
