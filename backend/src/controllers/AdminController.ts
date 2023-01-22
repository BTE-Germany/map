/******************************************************************************
 * AdminController.ts                                                         *
 *                                                                            *
 * Copyright (c) 2022-2023 Robin Ferch                                        *
 * https://robinferch.me                                                      *
 * This project is released under the MIT license.                            *
 ******************************************************************************/

import Core from "../Core";
import axios from "axios";
import {response} from "express";

class AdminController {
    private core: Core;

    private reCalcProgress: number;

    constructor(core: Core) {
        this.core = core;
        this.reCalcProgress = 0;
    }

    public async getAllUsers(req, res) {
        const users = await this.core.getKeycloakAdmin().getKeycloakAdminClient().users.find();
        const dbUser = await this.core.getPrisma().user.findMany();
        // get the count of all users
        let page = req.query.page;
        let size = req.query.size;
        let count = users.length;
        let totalPages = Math.ceil(count / size);
        let resultList = {
            currentPage: page,
            pageSize: size,
            totalUsers: count,
            totalPages: totalPages,
            data: []
        };
        users.slice((page - 1) * size, page * size).forEach(ssoUser => {
            let userData = {
                id: ssoUser.id,
                username: ssoUser.username,
                enabled: ssoUser.enabled,
                totp: ssoUser.totp,
                emailVerified: ssoUser.emailVerified,
                email: ssoUser.email
            };
            const discordIdentity = ssoUser.federatedIdentities?.find((fi) => fi.identityProvider === "discord")
            if (discordIdentity) {
                userData["discordId"] = discordIdentity.userId;
            }
            let user = dbUser.find((e) => e.ssoId === ssoUser.id);
            if (user) {
                userData["isInDB"] = true;
                userData["dbId"] = user.id;
            }
            resultList.data.push(userData);
        });
        res.send(resultList);
    }

    public async lockUser(req, res) {
        const user = await this.core.getKeycloakAdmin().getKeycloakAdminClient().users.findOne({id: req.body.userId});
        if (!user) {
            res.status(404).send("User not found");
            return;
        }
        await this.core.getKeycloakAdmin().getKeycloakAdminClient().users.update({id: req.body.userId}, {enabled: false});
        res.send("User locked");
    }

    public async unlockUser(req, res) {
        const user = await this.core.getKeycloakAdmin().getKeycloakAdminClient().users.findOne({id: req.body.userId});
        if (!user) {
            res.status(404).send("User not found");
            return;
        }
        await this.core.getKeycloakAdmin().getKeycloakAdminClient().users.update({id: req.body.userId}, {enabled: true});
        res.send("User unlocked");
    }

    public async calculateAllBuildings(req, res) {
        if (this.reCalcProgress > 0) {
            response.send("Already started.")
            return;
        }
        let regions = await this.core.getPrisma().region.findMany();
        res.send({status: "ok", count: regions.length})
        for (const [i, region] of regions.entries()) {

            if (req.query?.skipOld === "true" && region.buildings > 0) {
                continue;
            }
            this.core.getLogger().debug("Getting buildings for region " + region.id)
            let poly = "";

            let polyJson = JSON.parse(region.data);
            polyJson.forEach((coord) => {
                poly += ` ${coord[0]} ${coord[1]}`
            })

            let overpassQuery = `
                [out:json][timeout:25];
                (
                    node["building"]["building"!~"grandstand"]["building"!~"roof"]["building"!~"garage"]["building"!~"hut"]["building"!~"shed"](poly: "${poly}");
                    way["building"]["building"!~"grandstand"]["building"!~"roof"]["building"!~"garage"]["building"!~"hut"]["building"!~"shed"](poly: "${poly}");
                    relation["building"]["building"!~"grandstand"]["building"!~"roof"]["building"!~"garage"]["building"!~"hut"]["building"!~"shed"](poly: "${poly}");
                );
                out count;
               `;


            const {data} = await axios.get(`https://overpass.kumi.systems/api/interpreter?data=${overpassQuery.replace("\n", "")}`)

            try {
                await this.core.getPrisma().region.update({
                    where: {
                        id: region.id
                    },
                    data: {
                        buildings: parseInt(data?.elements[0]?.tags?.total) || 0
                    }
                })
            } catch (e) {
                this.core.getLogger().error(e.message)
            }


            this.reCalcProgress = i;
        }
        this.reCalcProgress = 0;
    }

    public async getCalculationProgess(req, res) {
        res.send(this.reCalcProgress.toString());
    }
}


export default AdminController;
