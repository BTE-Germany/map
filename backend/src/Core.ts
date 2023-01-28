/******************************************************************************
 * Core.ts                                                                    *
 *                                                                            *
 * Copyright (c) 2022-2023 Robin Ferch                                        *
 * https://robinferch.me                                                      *
 * This project is released under the MIT license.                            *
 ******************************************************************************/

import Web from './web/Web.js';
import * as session from "express-session";
import KeycloakAdmin from "./util/KeycloakAdmin.js";
import {PrismaClient} from "@prisma/client";
import DiscordIntegration from "./util/DiscordIntegration.js";
import S3Controller from "./util/S3Controller.js";
import SearchController from "./util/SearchController.js";
import {MeiliSearch} from "meilisearch";
import * as winston from "winston";
import Keycloak from "keycloak-connect";

class Core {
    web: Web;
    keycloak: Keycloak.Keycloak;
    memoryStore: session.MemoryStore;
    keycloakAdmin: KeycloakAdmin;
    prisma: PrismaClient;
    discord: DiscordIntegration;
    s3: S3Controller;
    search: SearchController;
    logger: winston.Logger;


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
        this.s3 = new S3Controller(this);
        this.search = new SearchController(this);
    }

    private setUpLogger(): void {
        const logger = winston.createLogger({
            level: process.env.LOGLEVEL,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
            ),
            transports: [
                new winston.transports.File({filename: 'logs/error.log', level: 'error'}),
                new winston.transports.File({filename: 'logs/combined.log'}),
            ],
        });

        if (process.env.NODE_ENV !== 'production') {
            const consoleFormat = winston.format.printf(({level, message, timestamp}) => {
                return `${timestamp} | ${level} » ${message}`;
            });

            logger.add(new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple(),
                    consoleFormat
                ),
            }));
        }

        this.logger = logger;
    }

    public getLogger = (): winston.Logger => this.logger;
    public getKeycloak = (): Keycloak.Keycloak => this.keycloak;
    public getKeycloakAdmin = (): KeycloakAdmin => this.keycloakAdmin;
    public getPrisma = (): PrismaClient => this.prisma;
    public getDiscord = (): DiscordIntegration => this.discord;
    public getWeb = (): Web => this.web;
    public getS3 = (): S3Controller => this.s3;
    public getSearch = (): MeiliSearch => this.search.getMeiliInstance();

}

export default Core;
