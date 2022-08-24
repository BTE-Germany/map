/******************************************************************************
 * StatsController.ts                                                         *
 *                                                                            *
 * Copyright (c) 2022 Robin Ferch                                             *
 * https://robinferch.me                                                      *
 * This project is released under the MIT license.                            *
 ******************************************************************************/

import Core from "../Core";
import {Request, Response} from "express";
import {validationResult} from "express-validator";


export default class StatsController {
    private core: Core;

    constructor(core: Core) {
        this.core = core;
    }

    public async getGeneralStats(request: Request, response: Response) {
        const regionCount = await this.core.getPrisma().region.count();
        const {_sum: regionSum} = await this.core.getPrisma().region.aggregate({
            _sum: {
                area: true
            }
        })
        const totalArea = regionSum.area;
        response.send({regionCount, totalArea});
    }

    public async getLeaderboard(request: Request, response: Response) {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            return response.status(400).json({errors: errors.array()});
        }

        const groupUsers = await this.core.getPrisma().region.groupBy({
            by: ['username'],
            _sum: {
                area: true,
            },
        })
        let count = groupUsers.length;

        const groupUsersPage = await this.core.getPrisma().region.groupBy({
            by: ['username'],
            _sum: {
                area: true,
            },
            skip: parseInt(<string>request.query.page) * 10,
            take: 10,
            orderBy: {
                _count: {
                    area: 'asc',
                },
            },
        })


        const leaderboard = groupUsersPage.map((u) => {
            return {
                username: u.username,
                area: u._sum.area,
            }
        });

        const answer = {
            count,
            leaderboard,
        }

        response.send(answer);
    }


}
