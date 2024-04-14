/******************************************************************************
 * StatsController.ts                                                         *
 *                                                                            *
 * Copyright (c) 2022-2023 Robin Ferch                                        *
 * https://robinferch.me                                                      *
 * This project is released under the MIT license.                            *
 ******************************************************************************/

import Core from "../Core.js";
import { Request, Response } from "express";
import { validationResult } from "express-validator";


export default class StatsController {
    private core: Core;

    constructor(core: Core) {
        this.core = core;
    }

    public async getGeneralStats(request: Request, response: Response) {
        const regionCount = await this.core.getPrisma().region.count();
        const { _sum: sums } = await this.core.getPrisma().region.aggregate({
            _sum: {
                area: true,
                buildings: true
            }
        });
        const totalArea = sums.area;
        const totalBuildings = sums.buildings;

        const { _sum: plotSums } = await this.core.getPrisma().region.aggregate({
            _sum: {
                area: true,
                buildings: true
            },
            where: {
                isPlotRegion: true
            }
        });
        const totalPlotArea = plotSums.area;
        const totalPlotBuildings = plotSums.buildings;

        const { _sum: eventSums } = await this.core.getPrisma().region.aggregate({
            _sum: {
                area: true,
                buildings: true
            },
            where: {
                isEventRegion: true
            }
        });
        const totalEventArea = eventSums.area;
        const totalEventBuildings = eventSums.buildings;

        const { _sum: finishedSums } = await this.core.getPrisma().region.aggregate({
            _sum: {
                area: true,
                buildings: true
            },
            where: {
                isFinished: true
            }
        });
        const totalFinishedArea = finishedSums.area;
        const totalFinishedBuildings = finishedSums.buildings;

        response.send({ regionCount, totalArea, totalBuildings, totalPlotArea, totalPlotBuildings, totalEventArea, totalEventBuildings, totalFinishedArea, totalFinishedBuildings });
    }
    public async getLeaderboard(request: Request, response: Response) {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            return response.status(400).json({ errors: errors.array() });
        }

        const groupUsers = await this.core.getPrisma().region.groupBy({
            by: ['username'],
            _sum: {
                area: true,
                buildings: true,
            },
            where: {
                isEventRegion: false,
                isPlotRegion: false,
            }
        })
        let count = groupUsers.length;

        const groupUsersPage = await this.core.getPrisma().region.groupBy({
            by: ['userUUID', 'username'],
            _sum: {
                area: true,
                buildings: true
            },
            orderBy: {
                _sum: {
                    area: 'desc'
                },
            },
            skip: parseInt(<string>request.query.page) * 10,
            take: 10,
            where: {
                isEventRegion: false,
                isPlotRegion: false
            }
        })


        const leaderboard = groupUsersPage.map((u) => {
            return {
                username: u.username,
                area: u._sum.area,
                buildings: u._sum.buildings,
            }
        });

        const answer = {
            count,
            leaderboard,
        }

        response.send(answer);
    }


}
