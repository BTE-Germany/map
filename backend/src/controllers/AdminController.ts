/******************************************************************************
 * AdminController.ts                                                         *
 *                                                                            *
 * Copyright (c) 2022 Robin Ferch                                             *
 * https://robinferch.me                                                      *
 * This project is released under the MIT license.                            *
 ******************************************************************************/

import Core from "../Core";

class AdminController {
    private core: Core;

    constructor(core: Core) {
        this.core = core;
    }

    public async getAllUsers(req, res) {
        const users = await this.core.getKeycloakAdmin().getKeycloakAdminClient().users.find();
        const dbUser = await this.core.getPrisma().user.findMany();
        let resultList = [];
        users.forEach(ssoUser => {
            let userData = {
                id: ssoUser.id,
                username: ssoUser.username,
                enabled: ssoUser.enabled,
                totp: ssoUser.totp,
                emailVerified: ssoUser.emailVerified,
                email: ssoUser.email
            };
            const discordIdentity = ssoUser.federatedIdentities?.find((fi) => fi.identityProvider === "discord")
            if(discordIdentity) {
                userData["discordId"] = discordIdentity.userId;
            }
            let user = dbUser.find((e) => e.ssoId === ssoUser.id);
            if (user) {
                userData["isInDB"] = true;
                userData["dbId"] = user.id;
            }
            resultList.push(userData);
        });
        res.send(resultList);
    }

    public async lockUser(req, res) {
        const user = await this.core.getKeycloakAdmin().getKeycloakAdminClient().users.findOne({ id: req.body.userId });
        if(!user) {
            res.status(404).send("User not found");
            return;
        }
        await this.core.getKeycloakAdmin().getKeycloakAdminClient().users.update({ id: req.body.userId }, { enabled: false });
        res.send("User locked");
    }

    public async unlockUser(req, res) {
        const user = await this.core.getKeycloakAdmin().getKeycloakAdminClient().users.findOne({ id: req.body.userId });
        if(!user) {
            res.status(404).send("User not found");
            return;
        }
        await this.core.getKeycloakAdmin().getKeycloakAdminClient().users.update({ id: req.body.userId }, { enabled: true });
        res.send("User unlocked");
    }
}


export default AdminController;
