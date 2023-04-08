/******************************************************************************
 * Web.ts                                                                     *
 *                                                                            *
 * Copyright (c) 2022-2023 Robin Ferch                                        *
 * https://robinferch.me                                                      *
 * This project is released under the MIT license.                            *
 ******************************************************************************/

import cors from "cors";
import express, { Express } from "express";
import fileUpload from "express-fileupload";
import session from "express-session";
import http from "http";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import Core from '../Core.js';
import SocketIOController from "../util/SocketIOController.js";
import Routes from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Web {
    private app: Express;

    private core: Core;

    private routes: Routes;

    private server: http.Server;

    private socketIO: SocketIOController;


    constructor(core: Core) {
        this.app = express();
        this.server = http.createServer(this.app);
        this.core = core;
    }

    public startWebserver() {
        this.app.use(express.json());
        this.app.use(session({
            secret: process.env.SESSION_SECRET,
            resave: false,
            saveUninitialized: true,
            store: this.core.memoryStore
        }));
        this.app.use(cors())

        this.app.use(
            express.static(path.join(__dirname, "../../../frontend/dist"))
        );

        this.app.use(this.core.getKeycloak().middleware({
            logout: '/logout',
            admin: '/'
        }));
        this.core.getLogger().debug("Enabled keycloak-connect adapter")

        this.app.use(fileUpload({
            limits: { fileSize: 10 * 1024 * 1024 },
        }));


        this.server.listen(this.getPort(), () => {
            this.core.getLogger().info(`Starting webserver on port ${this.getPort()}`);
            this.routes = new Routes(this);

            this.app.get("*", (req, res) => {

                res.sendFile(
                    path.join(__dirname, "../../../frontend/dist/index.html")
                );
            });

            this.socketIO = new SocketIOController(this.core);
        });
    }

    public getPort() {
        return process.env.WEBPORT;
    }

    public getApp(): Express {
        return this.app;
    }

    public getCore(): Core {
        return this.core;
    }

    public getKeycloak() {
        return this.core.getKeycloak();
    }

    public getHttpServer(): http.Server {
        return this.server;
    }

    public getSocketIO(): SocketIOController {
        return this.socketIO;
    }
}

export default Web;
