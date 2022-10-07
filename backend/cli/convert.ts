/******************************************************************************
 * convert.ts                                                                 *
 *                                                                            *
 * Copyright (c) 2022 Robin Ferch                                             *
 * https://robinferch.me                                                      *
 * This project is released under the MIT license.                            *
 ******************************************************************************/

import * as fs from 'fs/promises';
import {PrismaClient} from "@prisma/client";
import axios from "axios";
import {log} from "util";

let prisma = new PrismaClient();

(async () => {
    let regionsBuffer = await fs.readFile("./regions.json")
    let regions = JSON.parse(regionsBuffer.toString());

    let builderBuffer = await fs.readFile("./builders.json")
    let builders = JSON.parse(builderBuffer.toString());

    /*let c = 0;

    await regions.forEach((region) => {
        prisma.region.create({
            data: {
                id: region.uid,
                userUUID: region.useruuid,
                data: region.data,
                username: region.username,
                area: region.area,
                city: region.city,
                description: ""
            }
        }).then((x) => {
            c++;
            console.log(x.id)
        })
            .catch((e) => console.log(e))
    });
    console.log(c)*/

    await builders.forEach((builder) => {
        axios.get(`https://playerdb.co/api/player/minecraft/${builder.username}`)
            .then(({data: account}) => {
                if (account.success) {
                    let uuid = account.data.player.id
                    prisma.additionalBuilder.create({
                        data: {
                            minecraftUUID: uuid,
                            username: builder.username,
                            region: {
                                connect: {
                                    id: builder.regionuid
                                }
                            }
                        }
                    })
                }
            })
            .catch(() => {
            })

    });

})();


