/******************************************************************************
 * InteractiveBuildingsController.ts                                          *
 *                                                                            *
 * Copyright (c) 2022-2023 Robin Ferch                                        *
 * https://robinferch.me                                                      *
 * This project is released under the MIT license.                            *
 ******************************************************************************/

import Core from "../Core.js";

import {Request, Response} from "express";


class RegionsController {

    private core: Core;

    constructor(core: Core) {
        this.core = core;
    }


    public async getAllBuildings(request: Request, response: Response) {
        let buildings = await this.core.getPrisma().interactiveBuilding.findMany();
        response.send(buildings);
    }

}

export default RegionsController;
