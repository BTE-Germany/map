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
import S3Controller from "./util/S3Controller";

class Core {
    web: Web;
    keycloak: Keycloak.Keycloak;
    memoryStore: session.MemoryStore;
    keycloakAdmin: KeycloakAdmin;
    prisma: PrismaClient;
    discord: DiscordIntegration;
    s3: S3Controller;


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
    public getWeb = (): Web => this.web;
    public getS3 = (): S3Controller => this.s3;

}

export default Core;
