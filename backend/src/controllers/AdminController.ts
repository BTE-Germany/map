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
import {centerOfMass, polygon} from "@turf/turf";

class AdminController {
    private core: Core;

    private reCalcProgress: number;
    private osmDisplayNameProgress: number;

    constructor(core: Core) {
        this.core = core;
        this.reCalcProgress = 0;
        this.osmDisplayNameProgress = 0;
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

    public async getCalculationProgress(req, res) {
        res.send(this.reCalcProgress.toString());
    }

    public async getOsmDisplayNames(req, res) {
        if (this.osmDisplayNameProgress > 0) {
            response.send("Already started.")
            return;
        }
        let regions = await this.core.getPrisma().region.findMany();
        res.send({status: "ok", count: regions.length})

        for (const [i, region] of regions.entries()) {
            if (req.query?.skipOld === "true" && region.osmDisplayName !== "") {
                continue;
            }
            let coords = JSON.parse(region.data);
            coords.push(coords[0]);
            let poly = polygon([coords]);
            let centerMass = centerOfMass(poly);
            let center = centerMass.geometry.coordinates;
            try {
                const {data} = await axios.get(`https://nominatim.openstreetmap.org/reverse?lat=${center[0]}&lon=${center[1]}&format=json&accept-language=de`, {headers: {'User-Agent': 'BTEMAP/1.0'}});
                this.core.getLogger().debug(`Got data for ${region.id}`)
                if (data?.display_name) {
                    await this.core.getPrisma().region.update({
                        where: {
                            id: region.id
                        },
                        data: {
                            osmDisplayName: data.display_name
                        }
                    })
                }
            } catch (e) {
                this.core.getLogger().error(e);
            }

            this.osmDisplayNameProgress = i;


        }

        this.osmDisplayNameProgress = 0;

    }


    public async getOsmDisplayNameProgress(req, res) {
        res.send(this.osmDisplayNameProgress.toString());
    }

    public async syncWithSearchDB(req, res) {

        // reset index
        try {
            let oldIndex = await this.core.getSearch().getIndex(process.env.MEILISEARCH_INDEX);
            if (oldIndex) {
                await this.core.getSearch().deleteIndex(process.env.MEILISEARCH_INDEX)
            }
        } catch (e) {

        }


        await this.core.getSearch().createIndex(process.env.MEILISEARCH_INDEX);
        await this.core.getSearch().index(process.env.MEILISEARCH_INDEX).updateFilterableAttributes(['_geo']);
        await this.core.getSearch().index(process.env.MEILISEARCH_INDEX).updateSortableAttributes(['_geo']);

        const regions = await this.core.getPrisma().region.findMany();

        let formattedRegions = regions.map((region) => {
            let coords = JSON.parse(region.data);
            coords.push(coords[0]);
            let poly = polygon([coords]);
            let centerMass = centerOfMass(poly);
            let center = centerMass.geometry.coordinates;
            return {
                id: region.id,
                city: region.city,
                "_geo": {
                    "lat": center[0],
                    "lng": center[1]
                },
                osmDisplayName: region.osmDisplayName,
                username: region.username
            }
        })

        await this.core.getSearch().index(process.env.MEILISEARCH_INDEX).addDocuments(formattedRegions)

        res.send("ok")


    }
}


export default AdminController;
