
/******************************************************************************
 * Core.ts                                                                    *
 *                                                                            *
 * Copyright (c) 2022 Robin Ferch                                             *
 * https://robinferch.me                                                      *
 * This project is released under the MIT license.                            *
 ******************************************************************************/

import {configure, getLogger, Logger} from 'log4js';
import Web from './web/Web';
import * as Keycloak from "keycloak-connect";
import * as session from "express-session";
import KeycloakAdmin from "./util/KeycloakAdmin";
import {PrismaClient} from "@prisma/client";
import DiscordIntegration from "./util/DiscordIntegration";

class Core {
    web: Web;
    keycloak: Keycloak.Keycloak;
    memoryStore: session.MemoryStore;
    keycloakAdmin: KeycloakAdmin;
    prisma: PrismaClient;
    discord: DiscordIntegration;


    constructor() {
        this.setUpLogger();
        this.memoryStore = new session.MemoryStore();
        this.keycloak = new Keycloak({
            store: this.memoryStore
        })
        this.keycloakAdmin = new KeycloakAdmin(this);
        this.keycloakAdmin.authKcClient().then(() => {
            this.getLogger().debug("Keycloak Admin is initialized.")
            this.prisma = new PrismaClient();
            this.web = new Web(this);
            this.web.startWebserver();
        })
        this.discord = new DiscordIntegration(this);

    }

    private setUpLogger(): void {
        const logger = this.getLogger();
        logger.level = process.env.LOGLEVEL;
    }

    public getLogger = (): Logger => getLogger();
    public getKeycloak = (): Keycloak.Keycloak => this.keycloak;
    public getKeycloakAdmin = (): KeycloakAdmin => this.keycloakAdmin;
    public getPrisma = (): PrismaClient => this.prisma;
    public getDiscord = (): DiscordIntegration => this.discord;

}

export default Core;
