import {Request, Response} from "express";
import Core from "../Core";

class RegionsController {

    private core: Core;

    constructor(core: Core) {
        this.core = core;
    }

    public async getAllRegions(request: Request, response: Response) {
        let regions = await this.core.getPrisma().region.findMany({
            select: {
                username: true,
                data: true,
                userUUID: true,
                id: true
            }
        });
        response.send(regions)
    }
}

export default RegionsController
