/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + main.jsx                                                                   +
 +                                                                            +
 + Copyright (c) 2022-2024 Robin Ferch                                        +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import {BrowserRouter} from "react-router-dom";
import * as Sentry from "@sentry/react";


Sentry.init({
    dsn: "https://51c842147131436f9255d8f3635c61c1@errors.dachstein.cloud/3",
    integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
        Sentry.feedbackIntegration({
            colorScheme: "system",
            showBranding: false
        }),
    ],
    // Tracing
    tracesSampleRate: 1.0, //  Capture 100% of the transactions
    // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
    tracePropagationTargets: ["localhost", /^https:\/\/maps.bte-germany\.de\/api/],
    // Session Replay
    replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.

});

ReactDOM.createRoot(document.getElementById('root')).render(
    <BrowserRouter>
        <App/>
    </BrowserRouter>
)
