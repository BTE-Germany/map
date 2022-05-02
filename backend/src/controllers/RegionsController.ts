import {Request, Response} from "express";
import Core from "../Core";
import * as turf from "@turf/turf";
import Supercluster from "supercluster";

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

}

export default RegionsController
