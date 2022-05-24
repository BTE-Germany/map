/******************************************************************************
 * UserController.ts                                                          *
 *                                                                            *
 * Copyright (c) 2022 Robin Ferch                                             *
 * https://robinferch.me                                                      *
 * This project is released under the MIT license.                            *
 ******************************************************************************/

import Core from "../Core";

class UserController {
    private core: Core;

    constructor(core: Core) {
        this.core = core;
    }

    public async getCurrentUser(req, res) {
        const user = await this.core.getPrisma().user.findUnique({
            where: {
                ssoId: req.kauth.grant.access_token.content.sub
            }
        });
        res.json(user);
    }

    public async linkUser(req, res) {
        res.send("test")
    }
}

export default UserController;
