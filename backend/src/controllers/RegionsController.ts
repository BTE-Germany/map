/******************************************************************************
 * RegionsController.ts                                                       *
 *                                                                            *
 * Copyright (c) 2022 Robin Ferch                                             *
 * https://robinferch.me                                                      *
 * This project is released under the MIT license.                            *
 ******************************************************************************/

import {Request, Response} from "express";
import Core from "../Core";
import * as turf from "@turf/turf";
import axios from "axios";
import {validationResult} from "express-validator";

class RegionsController {

    private core: Core;

    constructor(core: Core) {
        this.core = core;
    }

    public async getAllRegions(request: Request, response: Response) {
        const regions = await this.core.getPrisma().region.findMany();
        response.send(regions);
    }

    public async getOneRegion(request: Request, response: Response) {
        const regions = await this.core.getPrisma().region.findUnique({
            where: {
                id: request.params.id
            },
            include: {
                additionalBuilder: true
            }
        });
        response.send(regions);
    }

    public async getAllRegionsAsGeoJSON(request: Request, response: Response) {
        const regions = await this.core.getPrisma().region.findMany();
        let geoJsonFeatures = [];
        regions.forEach((r) => {
            let coords = [];
            JSON.parse(r.data).forEach((d) => {
                coords.push([d[1], d[0]]);
            });
            coords.push([JSON.parse(r.data)[0][1], JSON.parse(r.data)[0][0]]);
            geoJsonFeatures.push({
                "type": "Feature",
                "properties": {
                    id: r.id,
                    username: r.username,
                    userUuid: r.userUUID
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        coords
                    ]
                }
            })
        })

        let geoJson = {
            "type": "FeatureCollection",
            "features": geoJsonFeatures
        }

        response.send(geoJson);
    }

    public async deleteRegion(request: Request, response: Response) {
        let region = await this.core.getPrisma().region.findUnique({
            where: {
                id: request.params.id
            },
            include: {
                owner: true
            }
        });
        if (region) {
            if (region.owner.ssoId === request.kauth.grant.access_token.content.sub) {
                await this.core.getPrisma().region.delete({
                    where: {
                        id: region.id
                    }
                });
                response.send({"success": true});
            } else {
                response.status(403).send("You are not the owner of this region");
            }
        } else {
            response.status(404).send("Region not found");
        }
    }

    public async reportRegion(request: Request, response: Response) {
        let region = await this.core.getPrisma().region.findUnique({
            where: {
                id: request.params.id
            }
        });
        if (region) {
            await this.core.getDiscord().sendReportMessage(region.id, request.kauth.grant.access_token.content.sub, request.body.comment, request.body.reason);
            response.send({"success": true});
        } else {
            response.status(404).send("Region not found");
        }
    }

    public async addAdditionalBuilder(request: Request, response: Response) {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            return response.status(400).json({errors: errors.array()});
        }


        let region = await this.core.getPrisma().region.findUnique({
            where: {
                id: request.params.id
            },
            include: {
                owner: true
            }
        });
        if (region) {

            if (region.owner.ssoId !== request.kauth.grant.access_token.content.sub) {
                response.status(403).send("You are not the owner of this region");
                return;
            }

            const {data: mcApiData} = await axios.get(`https://playerdb.co/api/player/minecraft/${request.body.username}`)
            if (mcApiData.code === "player.found") {
                let additionalBuilder = await this.core.getPrisma().additionalBuilder.findFirst({
                    where: {
                        minecraftUUID: mcApiData.data.player.id
                    }
                })

                if (additionalBuilder) {
                    response.status(400).send("Builder already exists");
                    return;
                }

                let b = await this.core.getPrisma().additionalBuilder.create({
                    data: {
                        minecraftUUID: mcApiData.data.player.id,
                        username: mcApiData.data.player.username,
                        region: {
                            connect: {
                                id: region.id
                            }
                        }
                    }
                })
                this.core.getLogger().debug(b);
                response.send({"success": true});
            } else {
                response.status(400).send("Minecraft user doesn't exist");
            }

        } else {
            response.status(404).send("Region not found");
        }
    }

    async removeAdditionalBuilder(request: Request, response: Response) {

        let region = await this.core.getPrisma().region.findUnique({
            where: {
                id: request.params.id
            },
            include: {
                owner: true
            }
        });
        if (region) {

            if (region.owner.ssoId !== request.kauth.grant.access_token.content.sub) {
                response.status(403).send("You are not the owner of this region");
                return;
            }

            let additionalBuilder = await this.core.getPrisma().additionalBuilder.findUnique({
                where: {
                    id: request.params.builderId
                }
            })

            if (additionalBuilder) {
                await this.core.getPrisma().additionalBuilder.delete({
                    where: {
                        id: additionalBuilder.id
                    }
                });
                response.send({"success": true});
            } else {
                response.status(404).send("Additional builder not found");
            }

        } else {
            response.status(404).send("Region not found");
        }
    }
}

export default RegionsController
