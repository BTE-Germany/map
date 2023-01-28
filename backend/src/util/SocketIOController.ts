/******************************************************************************
 * SocketIOController.ts                                                      *
 *                                                                            *
 * Copyright (c) 2022-2023 Robin Ferch                                        *
 * https://robinferch.me                                                      *
 * This project is released under the MIT license.                            *
 ******************************************************************************/
import Core from "../Core.js";
import * as Http from "http";
import {Server, Socket} from "socket.io";


interface AuthenticatedSocket extends Socket {
    authenticated: boolean
}

interface Player {
    uuid: string,
    lat: number,
    lon: number,
    username: string
}

class SocketIOController {

    private httpServer: Http.Server;

    private io: Server;

    private core: Core;

    private players: Player[] = [];

    constructor(core: Core) {
        this.core = core;

        this.httpServer = this.core.getWeb().getHttpServer();

        this.startSocketServer();
    }

    private startSocketServer() {

        this.core.getLogger().info("Starting Socket.IO server.");

        this.io = new Server(this.httpServer, {
            cors: {
                origin: "*"
            },
            transports: ['websocket', 'polling']
        });

        this.io.use(authMiddleware);

        this.io.on('connect', (socket: AuthenticatedSocket) => {
            this.core.getLogger().debug("New socket connection! auth=" + socket.authenticated)

            if (socket.authenticated) {
                socket.join("mcServers")
            } else {
                socket.join("clients")
            }

            socket.on('playerLocationUpdate', (data) => {
                if (socket.authenticated) {
                    let usersFromServer = [];
                    data = data.replace("[", "")
                    data = data.replace("]", "")
                    let split = data.split(", ")
                    split.forEach((u) => {
                        let decodedMsg = u.split(";")
                        const data = {
                            "uuid": decodedMsg[0],
                            "lat": parseFloat(decodedMsg[1]),
                            "lon": parseFloat(decodedMsg[2]),
                            "username": decodedMsg[3],
                        }
                        usersFromServer.push(data)
                    })
                    usersFromServer.forEach((p) => {
                        if (this.players.findIndex((pl) => pl.uuid === p.uuid) != -1) {
                            let idx = this.players.findIndex((pl) => pl.uuid === p.uuid);
                            this.players[idx] = p;
                        } else {
                            this.players.push(p);
                        }
                    })

                    let features = [];

                    this.players.forEach((player) => {
                        features.push({
                            "type": "Feature",
                            "properties": {
                                "username": player.username,
                                "uuid": player.uuid
                            },
                            "geometry": {
                                "type": "Point",
                                "coordinates": [
                                    player.lat,
                                    player.lon
                                ]
                            }
                        })
                    })

                    this.io.to("clients").emit("playerLocations", JSON.stringify({
                        "type": "FeatureCollection",
                        "features": features
                    }));
                }
            })

            socket.on('playerDisconnect', (data) => {
                if (socket.authenticated) {
                    if (this.players.findIndex((pl) => pl.uuid === data) != -1) {
                        let idx = this.players.findIndex((pl) => pl.uuid === data);
                        this.players.splice(idx, 1);
                        this.core.getLogger().debug("Removed player " + data)
                    }
                }
            });


            socket.emit("playerLocations", JSON.stringify({
                "type": "FeatureCollection",
                "features": []
            }))
        });

    }

    public sendTeleportRequest(coords: Array<number>, uuid: string) {
        this.core.getLogger().debug(`Sending tp request: ${JSON.stringify(coords)}`)
        this.io.to('mcServers').emit('teleportPlayer', JSON.stringify({coords, uuid}))
    }
}

const authMiddleware = (socket: AuthenticatedSocket, next) => {
    if (socket.handshake.auth && socket.handshake.auth.token) {
        if (socket.handshake.auth.token === process.env.MINECRAFT_PLUGIN_TOKEN) {
            socket.authenticated = true;
            next();
        } else {
            socket.authenticated = false;
            next();
        }
    } else {
        socket.authenticated = false;
        next();
    }
}


export default SocketIOController;
