/******************************************************************************
 * SearchController.ts                                                        *
 *                                                                            *
 * Copyright (c) 2022-2023 Robin Ferch                                        *
 * https://robinferch.me                                                      *
 * This project is released under the MIT license.                            *
 ******************************************************************************/

import Core from "../Core.js";
import {MeiliSearch} from "meilisearch";

class S3Controller {

    private core: Core;

    private readonly meiliInstance: MeiliSearch;


    constructor(core: Core) {
        this.core = core;
        this.meiliInstance = new MeiliSearch({host: process.env.MEILISEARCH_HOST, apiKey: process.env.MEILISEARCH_KEY});
        this.core.getLogger().debug("Started Search Controller.")
    }


    public getMeiliInstance(): any {
        return this.meiliInstance;
    }
}


export default S3Controller;
