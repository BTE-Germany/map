/******************************************************************************
 * S3Controller.ts                                                            *
 *                                                                            *
 * Copyright (c) 2022-2023 Robin Ferch                                        *
 * https://robinferch.me                                                      *
 * This project is released under the MIT license.                            *
 ******************************************************************************/

import Core from "../Core";
import * as Minio from "minio";

class S3Controller {

    private core: Core;

    private minioInstance: any;


    constructor(core: Core) {
        this.core = core;
        this.minioInstance = new Minio.Client({
            endPoint: process.env.S3_HOST,
            port: 443,
            useSSL: true,
            accessKey: process.env.S3_ACCESS_KEY,
            secretKey: process.env.S3_SECRET_KEY
        });
        this.core.getLogger().debug("Started S3 Controller.")
    }


    public getMinioInstance(): any {
        return this.minioInstance;
    }
}


export default S3Controller;
