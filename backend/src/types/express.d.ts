/******************************************************************************
 * express.d.ts                                                               *
 *                                                                            *
 * Copyright (c) 2022-2023 Robin Ferch                                        *
 * https://robinferch.me                                                      *
 * This project is released under the MIT license.                            *
 ******************************************************************************/

import {GrantProperties} from "keycloak-connect";

interface kAuth {
    grant: any;
}

declare global {
    namespace Express {
        interface Request {
            kauth: kAuth
        }
    }
}
