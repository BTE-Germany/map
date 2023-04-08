/******************************************************************************
 * seed.ts                                                                    *
 *                                                                            *
 * Copyright (c) 2022 Robin Ferch                                             *
 * https://robinferch.me                                                      *
 * This project is released under the MIT license.                            *
 ******************************************************************************/

import { PrismaClient } from "@prisma/client";

(async () => {
    const prisma = new PrismaClient();

    console.log("Seeding...");

    // Create example user

    let user = await prisma.user.findFirst({
        where: {
            ssoId: "f5a76963-a3b6-495a-8f22-bb44fcb30bfd"
        }
    })
    if (!user) {
        user = await prisma.user.create({
            data: {
                ssoId: "f5a76963-a3b6-495a-8f22-bb44fcb30bfd",
                discordId: "258975674168115200"
            }
        });
    }


    const region = await prisma.region.create({
        data: {
            data: "[[49.87269951716903, 8.65040317743825],[49.87280587100051, 8.650369200801364],[49.87289338818448, 8.650747203600359],[49.8729749279038, 8.65095298865133],[49.87312864005146, 8.651220758330194],[49.873250057797115, 8.65131459287409],[49.873267428090884, 8.651454826663029],[49.87317246777488, 8.65145681487734],[49.87308781779663, 8.651467657994894],[49.87304440925994, 8.651513920675495],[49.87299422015693, 8.651617017455935],[49.87296465166978, 8.651737823895433],[49.87297401781726, 8.651881626046585],[49.87298677418807, 8.651997011200654],[49.872898733622456, 8.652036270348821],[49.87284473587566, 8.651885465574269],[49.872782734336724, 8.651738230190608],[49.872702279137265, 8.651491603791309],[49.87266075842868, 8.651267973425778],[49.8726601992856, 8.650891551333158],[49.87270196412498, 8.650509706902794]]",
            userUUID: "f80c14f1-a7ac-438e-aea9-8851ed6704df",
            city: "Darmstadt",
            area: 4342,
            username: "Nachwahl",
            description: "",
            ownerID: user.id
        }
    });


    const region2 = await prisma.region.create({
        data: {
            data: "[[52.74174758561812, 12.897911059989415],[52.699096145916464, 13.779780473054009],[52.36368567507763, 13.792393054283247],[52.33293472217935, 12.806713519382583]]",
            userUUID: "f80c14f1-a7ac-438e-aea9-8851ed6704df",
            city: "Berlin",
            isPlotRegion: true,
            area: 4342,
            username: "Nachwahl",
            description: "",
            ownerID: user.id
        }
    });


    const region3 = await prisma.region.create({
        data: {
            data: "[[52.26425978865353, 11.334045485778917],[52.25577490850775, 11.903898558947764],[51.871281145643074, 11.989787489245444],[52.0204949500123, 11.091241059626594]]",
            userUUID: "f80c14f1-a7ac-438e-aea9-8851ed6704df",
            city: "Berlin",
            isPlotRegion: true,
            area: 4342,
            username: "Nachwahl",
            description: "",
            ownerID: user.id
        }
    });

    console.log("Created 3 region: " + region.id + " with owner: " + user.id);


})();
