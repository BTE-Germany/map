/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + oidc.jsx                                                                   +
 +                                                                            +
 + Copyright (c) 2024 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import {createReactOidc} from "oidc-spa/react";

export const {
    OidcProvider,
    useOidc,
    getOidc
} = createReactOidc({
    issuerUri: import.meta.env.VITE_OIDC_ISSUER,
    clientId: import.meta.env.VITE_OIDC_CLIENT_ID,
    publicUrl: import.meta.env.BASE_URL,
    decodedIdTokenSchema: {
        parse: (decodedIdToken) => {
            console.log(decodedIdToken);
            return decodedIdToken;
        }
    },

    doEnableDebugLogs: true
});