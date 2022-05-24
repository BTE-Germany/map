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
        if(region) {
            if(region.owner.ssoId === request.kauth.grant.access_token.content.sub) {
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
        if(region) {
            await this.core.getDiscord().sendReportMessage(region.id, request.kauth.grant.access_token.content.sub, request.body.comment, request.body.reason);
            response.send({"success": true});
        } else {
            response.status(404).send("Region not found");
        }
    }

}

export default RegionsController
