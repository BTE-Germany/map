/******************************************************************************
 * UserController.ts                                                          *
 *                                                                            *
 * Copyright (c) 2022 Robin Ferch                                             *
 * https://robinferch.me                                                      *
 * This project is released under the MIT license.                            *
 ******************************************************************************/

import axios from "axios";
import Core from "../Core";
import {validationResult} from "express-validator";

class UserController {
    private core: Core;

    constructor(core: Core) {
        this.core = core;
    }

    public async getCurrentUser(req, res) {
        const user = await this.core.getPrisma().user.findUnique({
            where: {
                ssoId: req.kauth.grant.access_token.content.sub
            }
        });
        res.json(user);
    }

    public async linkUser(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({errors: errors.array()});
        }

        const code = await this.core.getPrisma().linkCodes.findUnique({
            where: {
                code: req.body.code
            }
        })

        if (code) {
            let username = "";
            const {data: mcApiData} = await axios.get(`https://playerdb.co/api/player/minecraft/${code.playerUUID}`);
            if (mcApiData.success) {
                username = mcApiData.data.player.username;
            }

            await this.core.getPrisma().user.update({
                where: {
                    ssoId: req.kauth.grant.access_token.content.sub
                },
                data: {
                    minecraftUUID: code.playerUUID
                }
            })

            await this.core.getPrisma().linkCodes.delete({
                where: {
                    id: code.id
                }
            })
            res.send({success: true, username});
        } else {
            res.status(404).send("code not found");
        }
    }

    public async unlinkUser(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({errors: errors.array()});
        }
        const user = await this.core.getPrisma().user.findUnique({
            where: {
                ssoId: req.kauth.grant.access_token.content.sub
            }
        });

        if (user.minecraftUUID) {
            await this.core.getPrisma().user.update({
                where: {
                    id: user.id
                },
                data: {
                    minecraftUUID: ""
                }
            })
            res.send("ok")
        } else {
            res.status(400).send("not liked yet")
        }


    }

    public async teleportTo(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({errors: errors.array()});
        }

        const user = await this.core.getPrisma().user.findUnique({
            where: {
                ssoId: req.kauth.grant.access_token.content.sub
            }
        });

        if (user) {
            if (user.minecraftUUID) {
                this.core.getWeb().getSocketIO().sendTeleportRequest(req.body.coords, user.minecraftUUID)
                res.send('ok')
            } else {
                res.status(400).send("user has no linked minecraft account")
            }
        }


    }
}

export default UserController;
