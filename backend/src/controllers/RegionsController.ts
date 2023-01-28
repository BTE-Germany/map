/******************************************************************************
 * RegionsController.ts                                                       *
 *                                                                            *
 * Copyright (c) 2022-2023 Robin Ferch                                        *
 * https://robinferch.me                                                      *
 * This project is released under the MIT license.                            *
 ******************************************************************************/

import {Request, Response} from "express";
import Core from "../Core.js";
import axios from "axios";
import {validationResult} from "express-validator";
import imageminWebp from "imagemin-webp";
import imagemin from "imagemin";

class RegionsController {

    private core: Core;


    constructor(core: Core) {
        this.core = core;
    }

    public async getAllRegions(request, response: Response) {
        let page = request.query.page;
        let size = request.query.size;
        let sortBy = request.query.sort;
        let sortDir = request.query.direction;
        let regions = await this.core.getPrisma().region.findMany({orderBy: {[sortBy]: sortDir}});
        let count = regions.length;
        let totalPages = Math.ceil(count / size);
        let resultList = {
            currentPage: page,
            pageSize: size,
            totalRegions: count,
            totalPages: totalPages,
            data: regions.slice((page - 1) * size, page * size)
        };
        response.send(resultList);
    }

    public async getOneRegion(request: Request, response: Response) {
        const regions = await this.core.getPrisma().region.findUnique({
            where: {
                id: request.params.id
            },
            include: {
                additionalBuilder: true,
                images: true
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
            let regionType = "normal";
            if (r.isEventRegion) {
                regionType = "event";
            }
            if (r.isPlotRegion) {
                regionType = "plot";
            }
            geoJsonFeatures.push({
                "type": "Feature",
                "properties": {
                    id: r.id,
                    username: r.username,
                    userUUID: r.userUUID,
                    regionType: regionType
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
            if (region.owner?.ssoId === request.kauth.grant.access_token.content.sub
                || request.kauth.grant.access_token.content.realm_access.roles.includes("mapadmin")) {
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


    public async editRegion(request: Request, response: Response) {
        let region = await this.core.getPrisma().region.update({
            where: {
                id: request.params.id
            },
            data: {
                username: request.body.username,
                userUUID: request.body.player_id,
                city: request.body.city,
                isEventRegion: request.body.isEventRegion,
                isPlotRegion: request.body.isPlotRegion,
            }
        });
        console.log(region);
        if (region) {
            response.send({"success": true});
        } else {
            response.status(404).send("Region not found");
        }
    }


    public async reportRegion(request: Request, response: Response) {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            return response.status(400).json({errors: errors.array()});
        }

        console.log(request.body)

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
                        minecraftUUID: mcApiData.data.player.id,
                        regionId: region.id
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

    async handleImageUpload(request: Request, response: Response) {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            return response.status(400).json({errors: errors.array()});
        }

        let region = await this.core.getPrisma().region.findUnique({
            where: {
                id: request.params.id
            },
            include: {
                owner: true,
                images: true
            }
        });
        if (region) {
            if (region.owner.ssoId !== request.kauth.grant.access_token.content.sub && !(request.kauth.grant.access_token.content.realm_access.roles.includes("mapadmin"))) {
                response.status(403).send("You are not the owner of this region");
                return;
            }

            if (region.images.length >= 5) {
                response.status(400).send("Upload limit for region reached.");
                return;
            }

            if (!request.files || Object.keys(request.files).length === 0 || !request.files.image) {
                response.status(400).send("No files uploaded");
                return;
            }

            // @ts-ignore
            if (request.files.image?.data) {
                // @ts-ignore
                const webp = await imagemin.buffer(request.files.image.data, {
                    plugins: [
                        imageminWebp({quality: 50})
                    ]
                })
                const image = await this.core.getPrisma().image.create({
                    data: {
                        region: {
                            connect: {
                                id: region.id
                            }
                        },
                        imageData: ""
                    }
                })
                try {
                    // @ts-ignore
                    await this.core.getS3().getMinioInstance().putObject(process.env.S3_BUCKET, `${image.id}-${request.files.image.name}.webp`, webp)
                    await this.core.getPrisma().image.update({
                        where: {
                            id: image.id
                        },
                        data: {
                            // @ts-ignore
                            imageData: `${process.env.S3_PUBLIC_URL}/${process.env.S3_BUCKET}/${image.id}-${request.files.image.name}.webp`
                        }
                    })

                } catch (e) {
                    this.core.getLogger().error(e)
                    response.status(500).send("Error uploading file")
                    return;
                }
            } else {
                for (const imageKey in request.files.image) {
                    const webp = await imagemin.buffer(request.files.image[imageKey].data, {
                        plugins: [
                            imageminWebp({quality: 50})
                        ]
                    })
                    const image = await this.core.getPrisma().image.create({
                        data: {
                            region: {
                                connect: {
                                    id: region.id
                                }
                            },
                            imageData: ""
                        }
                    })
                    try {
                        await this.core.getS3().getMinioInstance().putObject(process.env.S3_BUCKET, `${image.id}-${request.files.image[imageKey].name}.webp`, webp)
                        await this.core.getPrisma().image.update({
                            where: {
                                id: image.id
                            },
                            data: {
                                imageData: `${process.env.S3_PUBLIC_URL}/${process.env.S3_BUCKET}/${image.id}-${request.files.image[imageKey].name}.webp`
                            }
                        })

                    } catch (e) {
                        this.core.getLogger().error(e.message)
                        response.status(500).send("Error uploading file")
                        return;
                    }
                }
            }


            response.send("Uploaded successfully")


        } else {
            response.status(404).send("Region not found");
        }
    }

    async handleImageDelete(request: Request, response: Response) {
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
            if (region.owner.ssoId !== request.kauth.grant.access_token.content.sub && !(request.kauth.grant.access_token.content.realm_access.roles.includes("mapadmin"))) {
                response.status(403).send("You are not the owner of this region");
                return;
            }

            let image = await this.core.getPrisma().image.findUnique({
                where: {
                    id: request.params.imageId
                }
            })

            if (image) {

                try {
                    await this.core.getS3().getMinioInstance().removeObject(
                        process.env.S3_BUCKET,
                        image.imageData.replace(`${process.env.S3_PUBLIC_URL}/${process.env.S3_BUCKET}/`, "")
                    )

                    await this.core.getPrisma().image.delete({
                        where: {
                            id: image.id
                        }
                    })
                    response.send("Image deleted")
                } catch (e) {
                    response.status(500).send("Failed to delete image.")
                }


            } else {
                response.status(404).send("Image not found");
            }
        } else {
            response.status(404).send("Region not found");
        }
    }

    async handleCalculateBuildings(request: Request, response: Response) {
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


            let poly = "";

            let polyJson = JSON.parse(region.data);
            polyJson.forEach((coord) => {
                poly += ` ${coord[0]} ${coord[1]}`
            })

            let overpassQuery = `
                [out:json][timeout:25];
                (
                    node["building"]["building"!~"grandstand"]["building"!~"roof"](poly: "${poly}");
                    way["building"]["building"!~"grandstand"]["building"!~"roof"](poly: "${poly}");
                    relation["building"]["building"!~"grandstand"]["building"!~"roof"](poly: "${poly}");
                );
                out count;
               `;


            const {data} = await axios.get(`https://overpass.kumi.systems/api/interpreter?data=${overpassQuery.replace("\n", "")}`)

            const newRegion = await this.core.getPrisma().region.update({
                where: {
                    id: region.id
                },
                data: {
                    buildings: parseInt(data?.elements[0]?.tags?.total) || 0
                }
            })

            response.send(newRegion)

        } else {
            response.status(404).send("Region not found");
        }
    }


}

export default RegionsController
