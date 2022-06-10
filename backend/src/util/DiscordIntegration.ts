/******************************************************************************
 * DiscordIntegration.ts                                                      *
 *                                                                            *
 * Copyright (c) 2022 Robin Ferch                                             *
 * https://robinferch.me                                                      *
 * This project is released under the MIT license.                            *
 ******************************************************************************/

import {Client, Intents, MessageEmbed} from "discord.js";
import Core from "../Core";

class DiscordIntegration {
    private core: Core;
    private client: Client;

    constructor(core: Core) {
        this.core = core;
        this.setup();
    }

    setup(): void {
        const client = new Client({intents: [Intents.FLAGS.GUILDS]});
        client.login(process.env.DISCORD_TOKEN).then(r => this.core.getLogger().info("Logged in to Discord"));
        this.client = client;
    }

    async sendReportMessage(regionId: string, reportUserSsoId: string, comment: string, reason: string) {
        const region = await this.core.getPrisma().region.findUnique({
            where: {
                id: regionId
            }
        });
        if (!region) return;

        const kcuser = await this.core.getKeycloakAdmin().getKeycloakAdminClient().users.findOne({
            id: reportUserSsoId
        });

        if (!kcuser) return;

        let reportedBy = kcuser.username;

        const discordIdentity = kcuser.federatedIdentities?.find((fi) => fi.identityProvider === "discord")
        if (discordIdentity) {
            reportedBy = kcuser.username + " (<@" + discordIdentity.userId + ">)";
        }

        const embed = new MessageEmbed()
            .setColor('#c50000')
            .setTitle('New region report')
            .setDescription('There is a new reported region. Please check it!')
            .setThumbnail('https://i.imgur.com/iaGxG9Y.png')
            .addField("Region ID", regionId, true)
            .addField("Link to Region", `[Click here](https://map.bte-germany.de?region=${regionId}&details=true)`, true)
            .addField("Region Owner", region.username, true)
            .addField("Report by", reportedBy, true)
            .addField("Report Reason", reason, true)
            .addField("Comment", comment, true)
            .setTimestamp()

        this.client.channels.fetch(process.env.DISCORD_LOG_CHANNEL)
            .then(channel => {
                if (channel.isText()) {
                    channel.send({embeds: [embed]})
                }
            })

    }
}

export default DiscordIntegration;
