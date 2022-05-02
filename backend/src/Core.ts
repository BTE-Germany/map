import {configure, getLogger, Logger} from 'log4js';
import Web from './web/Web';
import * as Keycloak from "keycloak-connect";
import * as session from "express-session";
import KeycloakAdmin from "./util/KeycloakAdmin";
import {PrismaClient} from "@prisma/client";

class Core {
    web: Web;
    keycloak: Keycloak.Keycloak;
    memoryStore: session.MemoryStore;
    keycloakAdmin: KeycloakAdmin;
    prisma: PrismaClient;


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

    }

    private setUpLogger(): void {
        const logger = this.getLogger();
        logger.level = process.env.LOGLEVEL;
    }

    public getLogger = (): Logger => getLogger();
    public getKeycloak = (): Keycloak.Keycloak => this.keycloak;
    public getKeycloakAdmin = (): KeycloakAdmin => this.keycloakAdmin;
    public getPrisma = (): PrismaClient => this.prisma;
}

export default Core;
